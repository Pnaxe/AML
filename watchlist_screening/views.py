from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from django.db.models import Q
from accounts.models import Customer
from .screening_service import ScreeningService
from .models import ScreeningMatch, WatchlistSource
import logging

logger = logging.getLogger(__name__)


class ScreeningViewSet(viewsets.ViewSet):
    """
    ViewSet for watchlist screening operations
    """
    permission_classes = [AllowAny]  # TODO: Change to IsAuthenticated in production
    
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
                    
                    # Update customer flags based on results
                    if screening_results['pep_match']:
                        customer.is_pep = True
                        customer.pep_details = f"PEP match found: {', '.join([m['matched_name'] for m in screening_results['matches'] if m['type'] == 'PEP'])}"
                        results['pep_matches'] += 1
                    
                    if screening_results['sanctions_match']:
                        customer.is_sanctioned = True
                        customer.sanction_details = f"Sanctions match found: {', '.join([m['matched_name'] for m in screening_results['matches'] if m['type'] == 'SANCTIONS'])}"
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
                    
                    customer.save()
                    
                    # Create ScreeningMatch records for each match
                    for match in screening_results.get('matches', []):
                        try:
                            # Get or create watchlist source
                            source, _ = WatchlistSource.objects.get_or_create(
                                name=match.get('source', 'Unknown'),
                                defaults={
                                    'source_type': match.get('type', 'CUSTOM'),
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
                            similarity = match.get('similarity', 0.85)
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
