"""
Automatic Screening Service
Performs PEP, sanctions, adverse media, and other watchlist checks
"""
import logging
from typing import Dict, List, Optional
from django.utils import timezone
from accounts.models import Customer
from .models import WatchlistEntry, WatchlistSource, ScreeningMatch
from difflib import SequenceMatcher

logger = logging.getLogger(__name__)


class ScreeningService:
    """
    Service for automatic screening against watchlists
    """
    
    def __init__(self):
        self.fuzzy_threshold = 0.75  # Minimum similarity score for fuzzy matches
    
    def screen_customer(self, customer: Customer) -> Dict:
        """
        Perform comprehensive screening on a customer
        Returns screening results with matches and risk flags
        """
        results = {
            'pep_match': False,
            'sanctions_match': False,
            'adverse_media_match': False,
            'criminal_match': False,
            'matches': [],
            'risk_flags': [],
            'screening_date': timezone.now().isoformat(),
            'overall_status': 'CLEAR'  # CLEAR, REVIEW, BLOCK
        }
        
        # Get customer search terms
        search_terms = self._get_search_terms(customer)
        
        # Check PEP databases
        pep_results = self._check_pep(customer, search_terms)
        if pep_results['matches']:
            results['pep_match'] = True
            results['matches'].extend(pep_results['matches'])
            results['risk_flags'].append('PEP_MATCH')
        
        # Check sanctions lists
        sanctions_results = self._check_sanctions(customer, search_terms)
        if sanctions_results['matches']:
            results['sanctions_match'] = True
            results['matches'].extend(sanctions_results['matches'])
            results['risk_flags'].append('SANCTIONS_MATCH')
        
        # Check adverse media
        adverse_media_results = self._check_adverse_media(customer, search_terms)
        if adverse_media_results['matches']:
            results['adverse_media_match'] = True
            results['matches'].extend(adverse_media_results['matches'])
            results['risk_flags'].append('ADVERSE_MEDIA')
        
        # Check criminal watchlists
        criminal_results = self._check_criminal(customer, search_terms)
        if criminal_results['matches']:
            results['criminal_match'] = True
            results['matches'].extend(criminal_results['matches'])
            results['risk_flags'].append('CRIMINAL_MATCH')
        
        # Determine overall status
        if results['sanctions_match']:
            results['overall_status'] = 'BLOCK'
        elif results['pep_match'] or results['criminal_match']:
            results['overall_status'] = 'REVIEW'
        elif results['adverse_media_match']:
            results['overall_status'] = 'REVIEW'
        else:
            results['overall_status'] = 'CLEAR'
        
        return results
    
    def _get_search_terms(self, customer: Customer) -> Dict:
        """Extract search terms from customer data"""
        terms = {}
        
        if customer.customer_type == 'INDIVIDUAL':
            terms['name'] = f"{customer.first_name} {customer.last_name}".strip()
            terms['first_name'] = customer.first_name
            terms['last_name'] = customer.last_name
            if customer.date_of_birth:
                terms['date_of_birth'] = customer.date_of_birth
        else:
            terms['name'] = customer.company_name
            terms['company_name'] = customer.company_name
            if customer.registration_number:
                terms['registration_number'] = customer.registration_number
        
        terms['country'] = customer.country
        terms['email'] = customer.email
        
        return terms
    
    def _check_pep(self, customer: Customer, search_terms: Dict) -> Dict:
        """Check against PEP databases"""
        matches = []
        
        try:
            # Get active PEP sources
            pep_sources = WatchlistSource.objects.filter(
                source_type='PEP',
                is_enabled=True,
                status='ACTIVE'
            )
            
            for source in pep_sources:
                # Search by name
                if search_terms.get('name'):
                    entries = WatchlistEntry.objects.filter(
                        source=source,
                        is_active=True,
                        full_name__icontains=search_terms['name']
                    )
                    
                    for entry in entries:
                        similarity = self._calculate_similarity(
                            search_terms['name'].lower(),
                            entry.full_name.lower()
                        )
                        
                        if similarity >= self.fuzzy_threshold:
                            matches.append({
                                'type': 'PEP',
                                'source': source.name,
                                'entry_id': entry.entry_id,
                                'matched_name': entry.full_name,
                                'similarity': similarity,
                                'details': {
                                    'nationality': entry.nationality,
                                    'listing_reason': entry.listing_reason,
                                    'program': entry.program
                                }
                            })
        except Exception as e:
            logger.error(f"Error checking PEP: {str(e)}")
        
        return {'matches': matches}
    
    def _check_sanctions(self, customer: Customer, search_terms: Dict) -> Dict:
        """Check against sanctions lists"""
        matches = []
        
        try:
            # Get active sanctions sources
            sanctions_sources = WatchlistSource.objects.filter(
                source_type='SANCTIONS',
                is_enabled=True,
                status='ACTIVE'
            )
            
            for source in sanctions_sources:
                # Search by name
                if search_terms.get('name'):
                    entries = WatchlistEntry.objects.filter(
                        source=source,
                        is_active=True
                    )
                    
                    for entry in entries:
                        similarity = self._calculate_similarity(
                            search_terms['name'].lower(),
                            (entry.full_name or entry.organization_name or '').lower()
                        )
                        
                        if similarity >= self.fuzzy_threshold:
                            matches.append({
                                'type': 'SANCTIONS',
                                'source': source.name,
                                'entry_id': entry.entry_id,
                                'matched_name': entry.full_name or entry.organization_name,
                                'similarity': similarity,
                                'details': {
                                    'program': entry.program,
                                    'listing_reason': entry.listing_reason,
                                    'listing_date': str(entry.listing_date) if entry.listing_date else None
                                }
                            })
        except Exception as e:
            logger.error(f"Error checking sanctions: {str(e)}")
        
        return {'matches': matches}
    
    def _check_adverse_media(self, customer: Customer, search_terms: Dict) -> Dict:
        """Check against adverse media databases"""
        matches = []
        
        try:
            # Get active adverse media sources
            adverse_sources = WatchlistSource.objects.filter(
                source_type='ADVERSE_MEDIA',
                is_enabled=True,
                status='ACTIVE'
            )
            
            for source in adverse_sources:
                if search_terms.get('name'):
                    entries = WatchlistEntry.objects.filter(
                        source=source,
                        is_active=True,
                        full_name__icontains=search_terms['name']
                    )
                    
                    for entry in entries[:5]:  # Limit to 5 matches
                        matches.append({
                            'type': 'ADVERSE_MEDIA',
                            'source': source.name,
                            'entry_id': entry.entry_id,
                            'matched_name': entry.full_name or entry.organization_name,
                            'details': {
                                'remarks': entry.remarks,
                                'listing_reason': entry.listing_reason
                            }
                        })
        except Exception as e:
            logger.error(f"Error checking adverse media: {str(e)}")
        
        return {'matches': matches}
    
    def _check_criminal(self, customer: Customer, search_terms: Dict) -> Dict:
        """Check against criminal watchlists"""
        matches = []
        
        try:
            # Get active criminal sources
            criminal_sources = WatchlistSource.objects.filter(
                source_type='CRIMINAL',
                is_enabled=True,
                status='ACTIVE'
            )
            
            for source in criminal_sources:
                if search_terms.get('name'):
                    entries = WatchlistEntry.objects.filter(
                        source=source,
                        is_active=True,
                        full_name__icontains=search_terms['name']
                    )
                    
                    for entry in entries:
                        similarity = self._calculate_similarity(
                            search_terms['name'].lower(),
                            entry.full_name.lower()
                        )
                        
                        if similarity >= self.fuzzy_threshold:
                            matches.append({
                                'type': 'CRIMINAL',
                                'source': source.name,
                                'entry_id': entry.entry_id,
                                'matched_name': entry.full_name,
                                'similarity': similarity,
                                'details': {
                                    'listing_reason': entry.listing_reason
                                }
                            })
        except Exception as e:
            logger.error(f"Error checking criminal: {str(e)}")
        
        return {'matches': matches}
    
    def _calculate_similarity(self, str1: str, str2: str) -> float:
        """Calculate similarity between two strings using SequenceMatcher"""
        return SequenceMatcher(None, str1, str2).ratio()

