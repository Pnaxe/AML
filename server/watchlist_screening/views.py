from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from django.db.models import Q
from django.conf import settings
from django.utils import timezone
from accounts.models import Customer
from aml_system.configuration_views import _build_config_payload
from .screening_service import ScreeningService
from .models import ScreeningMatch, WatchlistSource
import logging
import json
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

try:
    from kyc.models import KYCProfile
    KYC_AVAILABLE = True
except ImportError:
    KYC_AVAILABLE = False

logger = logging.getLogger(__name__)


class ScreeningViewSet(viewsets.ViewSet):
    """
    ViewSet for watchlist screening operations
    """
    permission_classes = [AllowAny]  # TODO: Change to IsAuthenticated in production

    @staticmethod
    def _has_detections(screening_results):
        return bool(screening_results.get('matches')) or any([
            screening_results.get('pep_match'),
            screening_results.get('sanctions_match'),
            screening_results.get('adverse_media_match'),
            screening_results.get('criminal_match'),
        ])

    def _set_kyc_status(self, source_db, customer, status_value, rejection_reason=''):
        if not KYC_AVAILABLE:
            return
        try:
            defaults = {
                'verification_status': status_value,
                'kyc_risk_level': customer.risk_level,
                'due_diligence_level': 'STANDARD',
            }
            if status_value == 'VERIFIED':
                defaults['verification_date'] = timezone.now()
            if status_value == 'REJECTED' and rejection_reason:
                defaults['rejection_reason'] = rejection_reason

            profile, _ = KYCProfile.objects.using(source_db).get_or_create(
                customer_id=customer.id,
                defaults=defaults
            )
            profile.verification_status = status_value
            if status_value == 'VERIFIED':
                profile.verification_date = timezone.now()
            if status_value == 'REJECTED' and rejection_reason:
                profile.rejection_reason = rejection_reason
            if status_value == 'IN_PROGRESS':
                profile.verification_date = None

            update_fields = ['verification_status', 'updated_at']
            if status_value == 'VERIFIED':
                update_fields.append('verification_date')
            if status_value == 'IN_PROGRESS':
                update_fields.append('verification_date')
            if status_value == 'REJECTED' and rejection_reason:
                update_fields.append('rejection_reason')
            profile.save(using=source_db, update_fields=update_fields)
        except Exception:
            pass

    @staticmethod
    def _configured_screening_api_sources():
        config = _build_config_payload()
        built_in_sources = [
            ('screeningApiKey', 'Screening API'),
            ('watchlistApiKey', 'Watchlist DB API'),
            ('blacklistApiKey', 'Blacklist API'),
        ]
        api_sources = []

        for field, name in built_in_sources:
            key = str(config.get(field) or '').strip()
            api_sources.append({
                'id': field,
                'name': name,
                'type': 'BUILT_IN',
                'status': 'CONNECTED' if key else 'NOT_CONFIGURED',
                'used_for': 'Manual person screening',
                'last_four': key[-4:] if key else '',
            })

        for item in config.get('customApiKeys') or []:
            if not isinstance(item, dict):
                continue
            key = str(item.get('key') or '').strip()
            name = str(item.get('name') or '').strip()
            if not name or not key:
                continue
            api_sources.append({
                'id': str(item.get('id') or name),
                'name': name,
                'type': 'CUSTOM',
                'status': 'CONNECTED',
                'used_for': 'Manual person screening',
                'last_four': key[-4:],
            })

        return api_sources

    @staticmethod
    def _dilisense_key_from_config():
        config = _build_config_payload()
        for item in config.get('customApiKeys') or []:
            if not isinstance(item, dict):
                continue
            name = str(item.get('name') or '').strip().lower()
            key = str(item.get('key') or '').strip()
            if key and any(alias in name for alias in ['dilisense', 'delisence', 'dili sense', 'dili']):
                return key
        return str(config.get('screeningApiKey') or '').strip()

    @staticmethod
    def _safe_join(value):
        if isinstance(value, dict):
            return json.dumps(value, ensure_ascii=False)
        if isinstance(value, list):
            cleaned = []
            for item in value:
                if isinstance(item, dict):
                    cleaned.append(json.dumps(item, ensure_ascii=False))
                elif item:
                    cleaned.append(str(item))
            return ', '.join(cleaned)
        if value is None:
            return ''
        return str(value)

    def _flatten_dilisense_record(self, record):
        details = {}
        for key, value in record.items():
            if value in (None, '', [], {}):
                continue
            details[key] = self._safe_join(value)
        return details

    @staticmethod
    def _source_type_for_match(match):
        raw_type = str(match.get('type') or '').upper()
        if 'SANCTION' in raw_type:
            return 'SANCTIONS'
        if 'PEP' in raw_type:
            return 'PEP'
        if 'CRIMINAL' in raw_type:
            return 'CRIMINAL'
        if 'ADVERSE' in raw_type:
            return 'ADVERSE_MEDIA'
        if 'TERROR' in raw_type:
            return 'TERRORIST'
        if 'FRAUD' in raw_type:
            return 'FRAUD'
        return 'CUSTOM'

    @staticmethod
    def _similarity_for_match(match):
        raw_similarity = match.get('similarity')
        if raw_similarity is None:
            return 0.95 if match.get('source') == 'Dilisense' else 0.85
        try:
            return float(raw_similarity)
        except (TypeError, ValueError):
            return 0.85

    @staticmethod
    def _customer_screening_identity(customer):
        if customer.customer_type == 'INDIVIDUAL':
            customer_name = customer.get_full_name()
        else:
            customer_name = customer.company_name
        entity_type = 'ORGANIZATION' if customer.customer_type == 'CORPORATE' else 'INDIVIDUAL'
        return (customer_name or '').strip(), entity_type

    @staticmethod
    def _match_names_by_type(screening_results, type_fragment):
        names = []
        fragment = type_fragment.upper()
        for match in screening_results.get('matches', []):
            match_type = str(match.get('type') or '').upper()
            matched_name = str(match.get('matched_name') or '').strip()
            if fragment in match_type and matched_name:
                names.append(matched_name)
        return names

    def _merge_dilisense_results(self, screening_results, customer_name, entity_type):
        if not customer_name:
            return [], None

        dilisense_matches, dilisense_source = self._run_dilisense_screening(customer_name, entity_type)
        if not dilisense_matches:
            return dilisense_matches, dilisense_source

        screening_results.setdefault('matches', []).extend(dilisense_matches)
        risk_flags = screening_results.setdefault('risk_flags', [])
        if 'DILISENSE_MATCH' not in risk_flags:
            risk_flags.append('DILISENSE_MATCH')
        if screening_results.get('overall_status') == 'CLEAR':
            screening_results['overall_status'] = 'REVIEW'

        for provider_match in dilisense_matches:
            match_type = str(provider_match.get('type') or '').upper()
            if 'PEP' in match_type:
                screening_results['pep_match'] = True
            if 'SANCTION' in match_type:
                screening_results['sanctions_match'] = True
                screening_results['overall_status'] = 'BLOCK'
            if 'CRIMINAL' in match_type:
                screening_results['criminal_match'] = True
            if 'ADVERSE' in match_type:
                screening_results['adverse_media_match'] = True

        return dilisense_matches, dilisense_source

    def _run_dilisense_screening(self, name, entity_type):
        api_key = self._dilisense_key_from_config()
        provider = {
            'id': 'dilisense',
            'name': 'Dilisense AML Screening API',
            'type': 'EXTERNAL',
            'status': 'NOT_CONFIGURED' if not api_key else 'CONNECTED',
            'used_for': 'Sanctions, PEP, criminal and wanted-list screening',
            'last_four': api_key[-4:] if api_key else '',
        }

        if not api_key:
            return [], provider

        endpoint = 'checkEntity' if entity_type == 'ORGANIZATION' else 'checkIndividual'
        query = urlencode({'names': name, 'fuzzy_search': '1'})
        url = f'https://api.dilisense.com/v1/{endpoint}?{query}'
        request = Request(url, headers={'x-api-key': api_key, 'Accept': 'application/json'})

        try:
            with urlopen(request, timeout=12) as response:
                payload = json.loads(response.read().decode('utf-8'))
            provider['status'] = 'SEARCHED'
        except HTTPError as exc:
            provider['status'] = 'ERROR'
            provider['error'] = f'Dilisense returned HTTP {exc.code}'
            return [], provider
        except (URLError, TimeoutError, ValueError) as exc:
            provider['status'] = 'ERROR'
            provider['error'] = str(exc)
            return [], provider

        matches = []
        for record in payload.get('found_records') or []:
            if not isinstance(record, dict):
                continue
            source_type = record.get('source_type') or 'UNKNOWN'
            matched_name = record.get('name') or record.get('entity_name') or record.get('tl_name') or name
            matches.append({
                'type': source_type,
                'source': 'Dilisense',
                'entry_id': record.get('id') or f"dilisense-{len(matches) + 1}",
                'matched_name': matched_name,
                'similarity': None,
                'details': self._flatten_dilisense_record(record),
            })

        provider['total_hits'] = payload.get('total_hits', len(matches))
        return matches, provider
    
    @action(detail=False, methods=['post'])
    def run_screening(self, request):
        """
        Run screening on all active customers
        Checks PEP, sanctions, adverse media, and criminal watchlists
        """
        try:
            screening_service = ScreeningService()
            customers = Customer.objects.filter(is_active=True)
            
            total_customers = customers.count()
            screened_count = 0
            matches_found = 0
            errors = []
            
            results = {
                'total_customers': total_customers,
                'screened_count': 0,
                'matches_found': 0,
                'auto_approved': 0,
                'awaiting_review': 0,
                'pep_matches': 0,
                'sanctions_matches': 0,
                'adverse_media_matches': 0,
                'criminal_matches': 0,
                'errors': []
            }
            
            for customer in customers:
                try:
                    # Run screening
                    screening_results = screening_service.screen_customer(customer)
                    customer_name, entity_type = self._customer_screening_identity(customer)
                    self._merge_dilisense_results(screening_results, customer_name, entity_type)
                    
                    # Update customer flags based on results
                    if screening_results['pep_match']:
                        customer.is_pep = True
                        customer.pep_details = f"PEP match found: {', '.join(self._match_names_by_type(screening_results, 'PEP'))}"
                        results['pep_matches'] += 1
                    
                    if screening_results['sanctions_match']:
                        customer.is_sanctioned = True
                        customer.sanction_details = f"Sanctions match found: {', '.join(self._match_names_by_type(screening_results, 'SANCTION'))}"
                        results['sanctions_matches'] += 1
                    
                    # Calculate and update risk level
                    if screening_results['sanctions_match']:
                        customer.risk_level = 'CRITICAL'
                        customer.risk_score = 1.0
                    elif screening_results['pep_match'] or screening_results['criminal_match']:
                        customer.risk_level = 'HIGH'
                        customer.risk_score = 0.7
                    elif screening_results['adverse_media_match']:
                        customer.risk_level = 'MEDIUM'
                        customer.risk_score = 0.5

                    # Auto-approve clean profiles. Detected profiles stay for approval/rejection.
                    if self._has_detections(screening_results):
                        customer.kyc_verified = False
                        customer.save()
                        self._set_kyc_status('default', customer, 'IN_PROGRESS')
                        results['awaiting_review'] += 1
                    else:
                        customer.is_pep = False
                        customer.pep_details = ''
                        customer.is_sanctioned = False
                        customer.sanction_details = ''
                        customer.kyc_verified = True
                        customer.kyc_verification_date = timezone.now()
                        customer.save()
                        self._set_kyc_status('default', customer, 'VERIFIED')
                        results['auto_approved'] += 1
                    
                    # Create ScreeningMatch records for each match
                    for match in screening_results.get('matches', []):
                        try:
                            # Get or create watchlist source
                            source, _ = WatchlistSource.objects.get_or_create(
                                name=match.get('source', 'Unknown'),
                                defaults={
                                    'source_type': self._source_type_for_match(match),
                                    'provider': match.get('source', 'Unknown'),
                                    'status': 'ACTIVE',
                                    'is_enabled': True
                                }
                            )
                            
                            # Get or create watchlist entry
                            from .models import WatchlistEntry
                            entry_id = match.get('entry_id', f"{customer.id}-{match.get('type', 'UNKNOWN')}")
                            matched_name = match.get('matched_name', '')
                            
                            watchlist_entry, _ = WatchlistEntry.objects.get_or_create(
                                source=source,
                                entry_id=entry_id,
                                defaults={
                                    'entity_type': 'INDIVIDUAL' if customer.customer_type == 'INDIVIDUAL' else 'ORGANIZATION',
                                    'full_name': matched_name,
                                    'organization_name': matched_name if customer.customer_type == 'CORPORATE' else '',
                                    'listing_reason': match.get('details', {}).get('listing_reason', ''),
                                    'program': match.get('details', {}).get('program', ''),
                                    'is_active': True
                                }
                            )
                            
                            # Determine match type based on similarity
                            similarity = self._similarity_for_match(match)
                            if similarity >= 0.9:
                                match_type = 'EXACT'
                            elif similarity >= 0.8:
                                match_type = 'PROBABLE'
                            else:
                                match_type = 'FUZZY'
                            
                            # Generate unique match_id
                            import uuid
                            match_id = f"MATCH-{uuid.uuid4().hex[:8].upper()}"
                            
                            # Create screening match record
                            ScreeningMatch.objects.create(
                                match_id=match_id,
                                customer=customer,
                                watchlist_entry=watchlist_entry,
                                match_type=match_type,
                                match_score=similarity,
                                confidence_score=similarity,
                                matched_fields={'name': similarity},
                                status='NEW',
                                evidence_data=match.get('details', {})
                            )
                            matches_found += 1
                        except Exception as e:
                            logger.error(f"Error creating screening match: {str(e)}")
                    
                    screened_count += 1
                    
                except Exception as e:
                    error_msg = f"Error screening customer {customer.customer_id}: {str(e)}"
                    logger.error(error_msg)
                    errors.append(error_msg)
                    results['errors'].append(error_msg)
            
            results['screened_count'] = screened_count
            results['matches_found'] = matches_found
            
            return Response({
                'message': f'Screening completed for {screened_count} customer(s)',
                'results': results
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Error running screening: {str(e)}")
            return Response({
                'error': str(e),
                'message': 'Failed to run screening'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['post'])
    def run_selected(self, request):
        """
        Run screening for selected queued profiles.
        Body:
        {
          "profiles": [
            {"customer_id": 1, "source_db": "default"}
          ]
        }
        """
        profiles = request.data.get('profiles', [])
        if not isinstance(profiles, list) or len(profiles) == 0:
            return Response({
                'error': 'profiles list is required'
            }, status=status.HTTP_400_BAD_REQUEST)

        screening_service = ScreeningService()
        screened_count = 0
        matches_found = 0
        auto_approved = 0
        awaiting_review = 0
        errors = []

        for row in profiles:
            try:
                customer_pk = row.get('customer_id')
                source_db = (row.get('source_db') or 'default').strip() or 'default'

                if source_db not in settings.DATABASES:
                    errors.append(f"Unknown database alias: {source_db}")
                    continue

                customer = Customer.objects.using(source_db).get(id=customer_pk, is_active=True)
                screening_results = screening_service.screen_customer(customer)
                customer_name, entity_type = self._customer_screening_identity(customer)
                self._merge_dilisense_results(screening_results, customer_name, entity_type)

                if screening_results.get('pep_match'):
                    customer.is_pep = True
                    customer.pep_details = f"PEP match found: {', '.join(self._match_names_by_type(screening_results, 'PEP'))}"

                if screening_results.get('sanctions_match'):
                    customer.is_sanctioned = True
                    customer.sanction_details = f"Sanctions match found: {', '.join(self._match_names_by_type(screening_results, 'SANCTION'))}"

                if screening_results.get('sanctions_match'):
                    customer.risk_level = 'CRITICAL'
                    customer.risk_score = 1.0
                elif screening_results.get('pep_match') or screening_results.get('criminal_match'):
                    customer.risk_level = 'HIGH'
                    customer.risk_score = 0.7
                elif screening_results.get('adverse_media_match'):
                    customer.risk_level = 'MEDIUM'
                    customer.risk_score = 0.5

                # Auto-approve clean profiles. Detected profiles stay for approval/rejection.
                if self._has_detections(screening_results):
                    customer.kyc_verified = False
                    customer.save(using=source_db)
                    self._set_kyc_status(source_db, customer, 'IN_PROGRESS')
                    awaiting_review += 1
                else:
                    customer.is_pep = False
                    customer.pep_details = ''
                    customer.is_sanctioned = False
                    customer.sanction_details = ''
                    customer.kyc_verified = True
                    customer.kyc_verification_date = timezone.now()
                    customer.save(using=source_db)
                    self._set_kyc_status(source_db, customer, 'VERIFIED')
                    auto_approved += 1

                for match in screening_results.get('matches', []):
                    try:
                        source, _ = WatchlistSource.objects.using(source_db).get_or_create(
                            name=match.get('source', 'Unknown'),
                            defaults={
                                'source_type': self._source_type_for_match(match),
                                'provider': match.get('source', 'Unknown'),
                                'status': 'ACTIVE',
                                'is_enabled': True
                            }
                        )

                        from .models import WatchlistEntry
                        import uuid
                        entry_id = match.get('entry_id', f"{customer.id}-{match.get('type', 'UNKNOWN')}")
                        matched_name = match.get('matched_name', '')
                        watchlist_entry, _ = WatchlistEntry.objects.using(source_db).get_or_create(
                            source=source,
                            entry_id=entry_id,
                            defaults={
                                'entity_type': 'INDIVIDUAL' if customer.customer_type == 'INDIVIDUAL' else 'ORGANIZATION',
                                'full_name': matched_name,
                                'organization_name': matched_name if customer.customer_type == 'CORPORATE' else '',
                                'listing_reason': match.get('details', {}).get('listing_reason', ''),
                                'program': match.get('details', {}).get('program', ''),
                                'is_active': True
                            }
                        )

                        similarity = self._similarity_for_match(match)
                        if similarity >= 0.9:
                            match_type = 'EXACT'
                        elif similarity >= 0.8:
                            match_type = 'PROBABLE'
                        else:
                            match_type = 'FUZZY'

                        ScreeningMatch.objects.using(source_db).create(
                            match_id=f"MATCH-{uuid.uuid4().hex[:8].upper()}",
                            customer=customer,
                            watchlist_entry=watchlist_entry,
                            match_type=match_type,
                            match_score=similarity,
                            confidence_score=similarity,
                            matched_fields={'name': similarity},
                            status='NEW',
                            evidence_data=match.get('details', {})
                        )
                        matches_found += 1
                    except Exception as match_err:
                        errors.append(f"Failed to persist match for {customer.customer_id}: {str(match_err)}")

                screened_count += 1
            except Customer.DoesNotExist:
                errors.append(f"Customer not found: id={row.get('customer_id')} db={row.get('source_db', 'default')}")
            except Exception as err:
                errors.append(f"Error screening id={row.get('customer_id')}: {str(err)}")

        return Response({
            'message': f'Screening completed for {screened_count} selected profile(s)',
            'results': {
                'requested': len(profiles),
                'screened_count': screened_count,
                'matches_found': matches_found,
                'auto_approved': auto_approved,
                'awaiting_review': awaiting_review,
                'errors': errors,
            }
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'])
    def manual_screen(self, request):
        """
        Run manual screening for an ad hoc subject name.
        Body:
        {
          "name": "John Doe",
          "entity_type": "INDIVIDUAL",
          "country": "US",
          "email": ""
        }
        """
        name = (request.data.get('name') or '').strip()
        entity_type = (request.data.get('entity_type') or 'INDIVIDUAL').strip().upper()
        country = (request.data.get('country') or '').strip()
        email = (request.data.get('email') or '').strip()

        if not name:
            return Response({'error': 'name is required'}, status=status.HTTP_400_BAD_REQUEST)
        if entity_type not in {'INDIVIDUAL', 'ORGANIZATION'}:
            return Response({'error': 'entity_type must be INDIVIDUAL or ORGANIZATION'}, status=status.HTTP_400_BAD_REQUEST)

        screening_service = ScreeningService()
        screening_results = screening_service.screen_name(
            name=name,
            entity_type=entity_type,
            country=country,
            email=email,
        )
        api_sources = self._configured_screening_api_sources()
        dilisense_matches, dilisense_source = self._run_dilisense_screening(name, entity_type)
        api_sources = [dilisense_source, *api_sources]
        if dilisense_matches:
            screening_results.setdefault('matches', []).extend(dilisense_matches)
            if 'DILISENSE_MATCH' not in screening_results.setdefault('risk_flags', []):
                screening_results['risk_flags'].append('DILISENSE_MATCH')
            if screening_results.get('overall_status') == 'CLEAR':
                screening_results['overall_status'] = 'REVIEW'
        connected_api_count = len([source for source in api_sources if source.get('status') in {'CONNECTED', 'SEARCHED'}])

        matches = []
        for idx, match in enumerate(screening_results.get('matches', []), start=1):
            similarity = match.get('similarity')
            matches.append({
                'match_id': match.get('entry_id') or f'MANUAL-{idx}',
                'status': 'POTENTIAL_MATCH',
                'match_type': match.get('type', 'UNKNOWN'),
                'match_score': float(similarity) if similarity is not None else None,
                'watchlist_name': match.get('matched_name', ''),
                'source': match.get('source', 'Unknown'),
                'details': match.get('details', {}),
            })

        return Response({
            'query': {
                'name': name,
                'entity_type': entity_type,
                'country': country,
                'email': email,
            },
            'summary': {
                'total_matches': len(matches),
                'risk_flags': screening_results.get('risk_flags', []),
                'overall_status': screening_results.get('overall_status', 'CLEAR'),
                'screening_date': screening_results.get('screening_date'),
                'apis_checked': connected_api_count,
                'total_api_sources': len(api_sources),
            },
            'api_sources': api_sources,
            'matches': matches,
        }, status=status.HTTP_200_OK)
    
    @action(detail=False, methods=['get'])
    def pending_queue(self, request):
        """
        Screening profiles aggregated from all configured DB aliases.
        Includes both waiting and screened statuses.
        """
        search = request.query_params.get('search', '').strip()
        risk_level = request.query_params.get('risk_level', '').strip().upper()
        source_db = request.query_params.get('source_db', '').strip()
        screening_status = request.query_params.get('screening_status', '').strip().upper()

        db_aliases = list(settings.DATABASES.keys())
        if source_db:
            if source_db not in settings.DATABASES:
                return Response({
                    'count': 0,
                    'results': [],
                    'message': f'Unknown database alias: {source_db}'
                }, status=status.HTTP_400_BAD_REQUEST)
            db_aliases = [source_db]

        pending = []
        for alias in db_aliases:
            queryset = Customer.objects.using(alias).filter(is_active=True)
            kyc_status_by_customer = {}

            if KYC_AVAILABLE:
                profiles = KYCProfile.objects.using(alias).filter(
                    verification_status__in=['IN_PROGRESS', 'VERIFIED']
                ).values('customer_id', 'verification_status')
                kyc_status_by_customer = {p['customer_id']: p['verification_status'] for p in profiles}
                queryset = queryset.filter(id__in=kyc_status_by_customer.keys())

            if risk_level:
                queryset = queryset.filter(risk_level=risk_level)

            if search:
                queryset = queryset.filter(
                    Q(customer_id__icontains=search) |
                    Q(first_name__icontains=search) |
                    Q(last_name__icontains=search) |
                    Q(company_name__icontains=search) |
                    Q(email__icontains=search)
                )

            for customer in queryset:
                kyc_status = kyc_status_by_customer.get(customer.id, '')
                if customer.kyc_verified or kyc_status == 'VERIFIED':
                    status_code = 'SCREENED'
                    status_label = 'Screened'
                else:
                    status_code = 'WAITING'
                    status_label = 'Waiting for screening'

                if screening_status and screening_status != status_code:
                    continue

                customer_name = customer.get_full_name() if customer.customer_type == 'INDIVIDUAL' else customer.company_name
                pending.append({
                    'id': customer.id,
                    'customer_id': customer.customer_id,
                    'customer_name': customer_name or '',
                    'email': customer.email or '',
                    'risk_level': customer.risk_level,
                    'screening_status': status_label,
                    'screening_status_code': status_code,
                    'source_database': alias,
                    'last_updated': customer.updated_at.isoformat() if customer.updated_at else None,
                })

        pending.sort(key=lambda x: x.get('last_updated') or '', reverse=True)
        return Response({
            'count': len(pending),
            'results': pending
        })

    @action(detail=False, methods=['get'])
    def customer_report(self, request):
        """
        Full screening report for a specific queued customer.
        """
        customer_id = request.query_params.get('customer_id')
        source_db = request.query_params.get('source_db', 'default').strip() or 'default'

        if not customer_id:
            return Response({'error': 'customer_id is required'}, status=status.HTTP_400_BAD_REQUEST)
        if source_db not in settings.DATABASES:
            return Response({'error': f'Unknown database alias: {source_db}'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            customer = Customer.objects.using(source_db).get(id=customer_id, is_active=True)
        except Customer.DoesNotExist:
            return Response({'error': 'Customer not found'}, status=status.HTTP_404_NOT_FOUND)

        matches = ScreeningMatch.objects.using(source_db).select_related(
            'watchlist_entry',
            'watchlist_entry__source',
        ).filter(customer_id=customer.id).order_by('-detected_at')

        match_rows = []
        for match in matches:
            entry = match.watchlist_entry
            source = entry.source if entry else None
            match_rows.append({
                'match_id': match.match_id,
                'status': match.status,
                'match_type': match.match_type,
                'match_score': float(match.match_score),
                'confidence_score': float(match.confidence_score) if match.confidence_score is not None else None,
                'watchlist_name': entry.full_name if entry and entry.full_name else (entry.organization_name if entry else ''),
                'source': source.name if source else 'Unknown',
                'detected_at': match.detected_at.isoformat() if match.detected_at else None,
                'evidence_data': match.evidence_data,
            })

        risk_flags = []
        if customer.is_pep:
            risk_flags.append('PEP_MATCH')
        if customer.is_sanctioned:
            risk_flags.append('SANCTIONS_MATCH')
        if any(row['source'] == 'Dilisense' for row in match_rows):
            risk_flags.append('DILISENSE_MATCH')
        if customer.risk_level in {'HIGH', 'CRITICAL'} and not risk_flags:
            risk_flags.append(f'{customer.risk_level}_RISK')

        api_sources = self._configured_screening_api_sources()
        dilisense_key = self._dilisense_key_from_config()
        dilisense_hits = sum(1 for row in match_rows if row['source'] == 'Dilisense')
        api_sources = [{
            'id': 'dilisense',
            'name': 'Dilisense AML Screening API',
            'type': 'EXTERNAL',
            'status': 'SEARCHED' if dilisense_hits else ('CONNECTED' if dilisense_key else 'NOT_CONFIGURED'),
            'used_for': 'Sanctions, PEP, criminal and wanted-list screening',
            'last_four': dilisense_key[-4:] if dilisense_key else '',
            'total_hits': dilisense_hits,
        }, *api_sources]
        connected_api_count = len([source for source in api_sources if source.get('status') in {'CONNECTED', 'SEARCHED'}])
        overall_status = 'CLEAR'
        if customer.is_sanctioned or customer.risk_level == 'CRITICAL':
            overall_status = 'BLOCK'
        elif match_rows or customer.is_pep or customer.risk_level in {'HIGH', 'MEDIUM'}:
            overall_status = 'REVIEW'

        customer_name = customer.get_full_name() if customer.customer_type == 'INDIVIDUAL' else customer.company_name
        return Response({
            'customer': {
                'id': customer.id,
                'customer_id': customer.customer_id,
                'name': customer_name or '',
                'email': customer.email or '',
                'customer_type': customer.customer_type,
                'risk_level': customer.risk_level,
                'risk_score': float(customer.risk_score) if customer.risk_score is not None else None,
                'is_pep': customer.is_pep,
                'is_sanctioned': customer.is_sanctioned,
                'kyc_verified': customer.kyc_verified,
                'pep_details': customer.pep_details,
                'sanction_details': customer.sanction_details,
                'last_updated': customer.updated_at.isoformat() if customer.updated_at else None,
                'source_database': source_db,
            },
            'summary': {
                'total_matches': len(match_rows),
                'open_matches': sum(1 for row in match_rows if row['status'] in {'NEW', 'UNDER_REVIEW'}),
                'confirmed_matches': sum(1 for row in match_rows if row['status'] == 'CONFIRMED'),
                'false_positive_matches': sum(1 for row in match_rows if row['status'] == 'FALSE_POSITIVE'),
                'risk_flags': risk_flags,
                'overall_status': overall_status,
                'screening_date': timezone.now().isoformat(),
                'apis_checked': connected_api_count,
                'total_api_sources': len(api_sources),
            },
            'api_sources': api_sources,
            'matches': match_rows,
        })

    @action(detail=False, methods=['post'])
    def accept_profile(self, request):
        """
        Accept screened profile (verify customer).
        """
        customer_id = request.data.get('customer_id')
        source_db = (request.data.get('source_db') or 'default').strip() or 'default'

        if not customer_id:
            return Response({'error': 'customer_id is required'}, status=status.HTTP_400_BAD_REQUEST)
        if source_db not in settings.DATABASES:
            return Response({'error': f'Unknown database alias: {source_db}'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            customer = Customer.objects.using(source_db).get(id=customer_id, is_active=True)
        except Customer.DoesNotExist:
            return Response({'error': 'Customer not found'}, status=status.HTTP_404_NOT_FOUND)

        customer.kyc_verified = True
        customer.kyc_verification_date = timezone.now()
        customer.save(using=source_db, update_fields=['kyc_verified', 'kyc_verification_date', 'updated_at'])

        if KYC_AVAILABLE:
            try:
                profile, _ = KYCProfile.objects.using(source_db).get_or_create(
                    customer_id=customer.id,
                    defaults={
                        'verification_status': 'VERIFIED',
                        'verification_date': timezone.now(),
                        'kyc_risk_level': customer.risk_level,
                        'due_diligence_level': 'STANDARD',
                    }
                )
                if profile.verification_status != 'VERIFIED':
                    profile.verification_status = 'VERIFIED'
                    profile.verification_date = timezone.now()
                    profile.save(using=source_db, update_fields=['verification_status', 'verification_date', 'updated_at'])
            except Exception:
                pass

        return Response({'message': 'Profile accepted', 'customer_id': customer.id, 'source_db': source_db})

    @action(detail=False, methods=['post'])
    def deny_profile(self, request):
        """
        Deny screened profile.
        """
        customer_id = request.data.get('customer_id')
        source_db = (request.data.get('source_db') or 'default').strip() or 'default'
        reason = request.data.get('reason', '').strip()

        if not customer_id:
            return Response({'error': 'customer_id is required'}, status=status.HTTP_400_BAD_REQUEST)
        if source_db not in settings.DATABASES:
            return Response({'error': f'Unknown database alias: {source_db}'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            customer = Customer.objects.using(source_db).get(id=customer_id, is_active=True)
        except Customer.DoesNotExist:
            return Response({'error': 'Customer not found'}, status=status.HTTP_404_NOT_FOUND)

        customer.is_active = False
        customer.kyc_verified = False
        customer.save(using=source_db, update_fields=['is_active', 'kyc_verified', 'updated_at'])

        if KYC_AVAILABLE:
            try:
                profile, _ = KYCProfile.objects.using(source_db).get_or_create(
                    customer_id=customer.id,
                    defaults={
                        'verification_status': 'REJECTED',
                        'rejection_reason': reason,
                        'kyc_risk_level': customer.risk_level,
                        'due_diligence_level': 'STANDARD',
                    }
                )
                if profile.verification_status != 'REJECTED' or reason:
                    profile.verification_status = 'REJECTED'
                    if reason:
                        profile.rejection_reason = reason
                    profile.save(using=source_db, update_fields=['verification_status', 'rejection_reason', 'updated_at'])
            except Exception:
                pass

        return Response({'message': 'Profile denied', 'customer_id': customer.id, 'source_db': source_db, 'reason': reason})

    @action(detail=False, methods=['get'])
    def matches(self, request):
        """
        Get all screening matches
        """
        matches = ScreeningMatch.objects.select_related('customer', 'watchlist_entry', 'watchlist_entry__source').all()
        
        # Apply filters
        match_type = request.query_params.get('match_type', '')
        status_filter = request.query_params.get('status', '')
        search = request.query_params.get('search', '')
        
        if match_type:
            matches = matches.filter(match_type__iexact=match_type)
        
        if status_filter:
            matches = matches.filter(status__iexact=status_filter)
        
        if search:
            matches = matches.filter(
                Q(customer__first_name__icontains=search) |
                Q(customer__last_name__icontains=search) |
                Q(customer__company_name__icontains=search) |
                Q(watchlist_entry__full_name__icontains=search) |
                Q(watchlist_entry__organization_name__icontains=search)
            )
        
        # Serialize matches
        matches_data = []
        for match in matches:
            customer = match.customer
            watchlist_entry = match.watchlist_entry
            source = watchlist_entry.source if watchlist_entry else None
            
            matches_data.append({
                'id': match.id,
                'match_id': match.match_id,
                'customer_id': customer.id,
                'customer_name': customer.get_full_name() if customer.customer_type == 'INDIVIDUAL' else customer.company_name,
                'customer_id_display': customer.customer_id,
                'watchlist_entry': watchlist_entry.full_name if watchlist_entry and watchlist_entry.full_name else (watchlist_entry.organization_name if watchlist_entry else 'N/A'),
                'match_type': match.match_type,
                'status': match.status,
                'match_score': float(match.match_score),
                'source': source.name if source else 'Unknown',
                'source_type': source.source_type if source else 'CUSTOM',
                'created_at': match.detected_at.isoformat() if match.detected_at else None,
                'details': match.evidence_data
            })
        
        return Response({
            'count': len(matches_data),
            'results': matches_data
        })
