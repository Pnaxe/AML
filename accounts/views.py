from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django_filters.rest_framework import DjangoFilterBackend

from .models import Customer, DeletedCustomer
from .serializers import CustomerSerializer, CustomerCreateSerializer
from ml_engine.monitoring import CustomerRiskProfiler
from django.utils import timezone

# Import KYCProfile if kyc app exists
try:
    from kyc.models import KYCProfile
    KYC_AVAILABLE = True
except ImportError:
    KYC_AVAILABLE = False

# Import ScreeningService if available
try:
    from watchlist_screening.screening_service import ScreeningService
    SCREENING_AVAILABLE = True
except ImportError:
    SCREENING_AVAILABLE = False


class CustomerViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Customer CRUD and risk profiling
    """
    queryset = Customer.objects.filter(is_active=True)
    # TODO: Change back to [IsAuthenticated] in production
    permission_classes = [AllowAny]  # Temporarily allowing unauthenticated access for development
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = [
        'customer_type', 'risk_level', 'is_pep', 'is_sanctioned',
        'kyc_verified', 'country', 'is_active'
    ]
    search_fields = [
        'customer_id', 'first_name', 'last_name',
        'company_name', 'email'
    ]
    ordering_fields = ['created_at', 'risk_score']
    ordering = ['-created_at']
    
    def get_serializer_class(self):
        if self.action == 'create':
            return CustomerCreateSerializer
        return CustomerSerializer
    
    def perform_create(self, serializer):
        """
        Create customer with auto-generated customer_id and automatically create KYCProfile
        """
        # Get customer type for ID generation
        customer_type = serializer.validated_data.get('customer_type', 'INDIVIDUAL')
        
        # Generate unique customer ID
        customer_id = self._generate_customer_id(customer_type)
        
        # Save customer with auto-generated ID and default risk level (will be updated during screening)
        customer = serializer.save(
            customer_id=customer_id,
            kyc_verified=False,
            risk_level='LOW'  # Default, will be recalculated during screening
        )
        
        # Automatically create KYCProfile for the new customer
        if KYC_AVAILABLE:
            try:
                KYCProfile.objects.get_or_create(
                    customer=customer,
                    defaults={
                        'verification_status': 'PENDING',
                        'kyc_risk_level': customer.risk_level,
                        'due_diligence_level': 'STANDARD',
                    }
                )
            except Exception:
                # If KYCProfile creation fails, continue anyway
                pass
        
        return customer
    
    def _generate_customer_id(self, customer_type):
        """
        Generate a unique customer ID based on customer type
        Format: CUST-IND-0001 or CUST-CORP-0001
        """
        # Get prefix based on customer type
        prefix = 'CUST-IND' if customer_type == 'INDIVIDUAL' else 'CUST-CORP'
        
        # Get existing customer IDs to avoid duplicates
        existing_ids = set(
            Customer.objects.values_list('customer_id', flat=True)
        )
        
        # Find the highest number for this customer type
        max_num = 0
        for existing_id in existing_ids:
            if existing_id.startswith(prefix):
                try:
                    # Extract number from ID (e.g., CUST-IND-1000 -> 1000)
                    num_part = existing_id.split('-')[-1]
                    num = int(num_part)
                    max_num = max(max_num, num)
                except (ValueError, IndexError):
                    continue
        
        # Generate new ID starting from max_num + 1
        base_num = max_num + 1
        customer_id = f"{prefix}-{base_num:04d}"
        
        # Ensure uniqueness (in case of race condition)
        while customer_id in existing_ids:
            base_num += 1
            customer_id = f"{prefix}-{base_num:04d}"
        
        return customer_id
    
    def destroy(self, request, *args, **kwargs):
        """
        Soft delete: Move customer to DeletedCustomer table and mark as inactive
        """
        customer = self.get_object()
        
        # Create DeletedCustomer record
        DeletedCustomer.objects.create(
            customer_id=customer.customer_id,
            customer_type=customer.customer_type,
            first_name=customer.first_name,
            last_name=customer.last_name,
            date_of_birth=customer.date_of_birth,
            company_name=customer.company_name,
            registration_number=customer.registration_number,
            email=customer.email,
            phone_number=customer.phone_number,
            address=customer.address,
            city=customer.city,
            country=customer.country,
            postal_code=customer.postal_code,
            risk_level=customer.risk_level,
            risk_score=customer.risk_score,
            is_pep=customer.is_pep,
            pep_details=customer.pep_details,
            is_sanctioned=customer.is_sanctioned,
            sanction_details=customer.sanction_details,
            kyc_verified=customer.kyc_verified,
            kyc_verification_date=customer.kyc_verification_date,
            kyc_document_type=customer.kyc_document_type,
            original_id=customer.id,
            deleted_by=request.user if request.user.is_authenticated else None,
        )
        
        # Mark customer as inactive (soft delete)
        customer.is_active = False
        customer.save()
        
        return Response(status=status.HTTP_204_NO_CONTENT)
    
    @action(detail=True, methods=['post'])
    def update_risk_profile(self, request, pk=None):
        """
        Update customer's risk profile
        """
        customer = self.get_object()
        profiler = CustomerRiskProfiler()
        results = profiler.update_customer_risk(customer)
        
        return Response({
            'message': 'Risk profile updated successfully',
            'results': results
        })
    
    @action(detail=False, methods=['get'])
    def high_risk(self, request):
        """
        Get all high-risk customers
        """
        high_risk = self.queryset.filter(risk_level='HIGH')
        page = self.paginate_queryset(high_risk)
        
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        
        serializer = self.get_serializer(high_risk, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def pep(self, request):
        """
        Get all PEP (Politically Exposed Persons)
        """
        pep_customers = self.queryset.filter(is_pep=True)
        page = self.paginate_queryset(pep_customers)
        
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        
        serializer = self.get_serializer(pep_customers, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def sanctioned(self, request):
        """
        Get all sanctioned customers
        """
        sanctioned = self.queryset.filter(is_sanctioned=True)
        page = self.paginate_queryset(sanctioned)
        
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        
        serializer = self.get_serializer(sanctioned, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def screen(self, request, pk=None):
        """
        Perform automatic screening on a customer
        Checks PEP, sanctions, adverse media, criminal watchlists
        Also calculates risk level automatically
        """
        if not SCREENING_AVAILABLE:
            return Response({
                'error': 'Screening service not available'
            }, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        
        customer = self.get_object()
        screening_service = ScreeningService()
        results = screening_service.screen_customer(customer)
        
        # Calculate risk level based on screening results
        risk_score = 0.0
        risk_factors = {}
        
        # Sanctions match = CRITICAL risk
        if results['sanctions_match']:
            risk_score = 1.0
            risk_factors['sanctions_match'] = 1.0
            calculated_risk_level = 'CRITICAL'
            customer.is_sanctioned = True
            customer.sanction_details = f"Sanctions match found: {', '.join([m['matched_name'] for m in results['matches'] if m['type'] == 'SANCTIONS'])}"
        # PEP match = HIGH risk
        elif results['pep_match']:
            risk_score = 0.7
            risk_factors['pep_match'] = 0.7
            calculated_risk_level = 'HIGH'
            customer.is_pep = True
            customer.pep_details = f"PEP match found: {', '.join([m['matched_name'] for m in results['matches'] if m['type'] == 'PEP'])}"
        # Criminal match = HIGH risk
        elif results['criminal_match']:
            risk_score = 0.7
            risk_factors['criminal_match'] = 0.7
            calculated_risk_level = 'HIGH'
        # Adverse media = MEDIUM risk
        elif results['adverse_media_match']:
            risk_score = 0.5
            risk_factors['adverse_media'] = 0.5
            calculated_risk_level = 'MEDIUM'
        # High-risk country = MEDIUM risk
        elif customer.country in ['Iran', 'North Korea', 'Syria', 'Sudan', 'Cuba', 'Russia']:
            risk_score = 0.5
            risk_factors['high_risk_country'] = 0.5
            calculated_risk_level = 'MEDIUM'
        # Default = LOW risk
        else:
            risk_score = 0.2
            risk_factors['baseline'] = 0.2
            calculated_risk_level = 'LOW'
        
        # Update customer with calculated risk
        customer.risk_score = risk_score
        customer.risk_level = calculated_risk_level
        customer.save()
        
        # Add calculated risk to results
        results['calculated_risk_level'] = calculated_risk_level
        results['risk_score'] = risk_score
        results['risk_factors'] = risk_factors
        
        return Response(results)
    
    @action(detail=True, methods=['post'])
    def accept(self, request, pk=None):
        """
        Accept customer after review (mark as verified)
        """
        customer = self.get_object()
        
        # Create KYCProfile if needed
        if KYC_AVAILABLE:
            try:
                kyc_profile, created = KYCProfile.objects.get_or_create(
                    customer=customer,
                    defaults={
                        'verification_status': 'VERIFIED',
                        'verification_date': timezone.now(),
                        'kyc_risk_level': customer.risk_level,
                        'due_diligence_level': 'STANDARD',
                    }
                )
                if not created:
                    kyc_profile.verification_status = 'VERIFIED'
                    kyc_profile.verification_date = timezone.now()
                    kyc_profile.save()
            except Exception as e:
                pass
        
        # Mark customer as verified
        customer.kyc_verified = True
        customer.kyc_verification_date = timezone.now()
        customer.save()
        
        return Response({
            'message': 'Customer accepted and verified',
            'customer_id': customer.id
        })
    
    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """
        Reject customer (soft delete)
        """
        customer = self.get_object()
        rejection_reason = request.data.get('rejection_reason', 'Customer rejected after review')
        
        # Move to DeletedCustomer
        DeletedCustomer.objects.create(
            customer_id=customer.customer_id,
            customer_type=customer.customer_type,
            first_name=customer.first_name,
            last_name=customer.last_name,
            date_of_birth=customer.date_of_birth,
            company_name=customer.company_name,
            registration_number=customer.registration_number,
            email=customer.email,
            phone_number=customer.phone_number,
            address=customer.address,
            city=customer.city,
            country=customer.country,
            postal_code=customer.postal_code,
            risk_level=customer.risk_level,
            risk_score=customer.risk_score,
            is_pep=customer.is_pep,
            pep_details=customer.pep_details,
            is_sanctioned=customer.is_sanctioned,
            sanction_details=customer.sanction_details,
            kyc_verified=False,
            kyc_verification_date=None,
            kyc_document_type=customer.kyc_document_type,
            original_id=customer.id,
            deleted_by=request.user if request.user.is_authenticated else None,
        )
        
        # Mark as inactive
        customer.is_active = False
        customer.save()
        
        return Response({
            'message': 'Customer rejected',
            'customer_id': customer.id,
            'rejection_reason': rejection_reason
        })
