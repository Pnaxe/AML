from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone

from .models import KYCProfile, KYCDocument, KYCVerificationStep
from accounts.models import Customer


class KYCProfileViewSet(viewsets.ModelViewSet):
    """
    ViewSet for KYC Profile management
    """
    queryset = KYCProfile.objects.all()
    # TODO: Change back to [IsAuthenticated] in production
    permission_classes = [AllowAny]  # Temporarily allowing unauthenticated access for development
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = [
        'verification_status', 'kyc_risk_level', 'due_diligence_level',
        'requires_edd', 'edd_completed', 'customer'
    ]
    search_fields = ['customer__customer_id', 'customer__first_name', 'customer__last_name', 'customer__company_name']
    ordering_fields = ['created_at', 'verification_date', 'updated_at']
    ordering = ['-created_at']
    
    def get_serializer_class(self):
        from .serializers import KYCProfileSerializer
        return KYCProfileSerializer
    
    @action(detail=True, methods=['post'])
    def verify(self, request, pk=None):
        """
        Mark KYC profile as verified
        """
        kyc_profile = self.get_object()
        kyc_profile.verification_status = 'VERIFIED'
        kyc_profile.verification_date = timezone.now()
        kyc_profile.verified_by = request.user if request.user.is_authenticated else None
        kyc_profile.save()
        
        # Update customer to verified
        customer = kyc_profile.customer
        customer.kyc_verified = True
        customer.kyc_verification_date = timezone.now()
        customer.save()
        
        return Response({
            'message': 'KYC profile verified successfully',
            'kyc_profile_id': kyc_profile.id,
            'customer_id': customer.id
        })
    
    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """
        Reject KYC profile
        """
        kyc_profile = self.get_object()
        rejection_reason = request.data.get('rejection_reason', '')
        
        kyc_profile.verification_status = 'REJECTED'
        kyc_profile.rejection_reason = rejection_reason
        kyc_profile.save()
        
        return Response({
            'message': 'KYC profile rejected',
            'kyc_profile_id': kyc_profile.id,
            'rejection_reason': rejection_reason
        })


class KYCDocumentViewSet(viewsets.ModelViewSet):
    """
    ViewSet for KYC Document management
    """
    queryset = KYCDocument.objects.all()
    # TODO: Change back to [IsAuthenticated] in production
    permission_classes = [AllowAny]  # Temporarily allowing unauthenticated access for development
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['kyc_profile', 'document_type', 'verification_status']
    ordering = ['-uploaded_at']


class KYCVerificationStepViewSet(viewsets.ModelViewSet):
    """
    ViewSet for KYC Verification Step management
    """
    queryset = KYCVerificationStep.objects.all()
    # TODO: Change back to [IsAuthenticated] in production
    permission_classes = [AllowAny]  # Temporarily allowing unauthenticated access for development
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['kyc_profile', 'step_type', 'status', 'is_mandatory']
    ordering = ['kyc_profile', 'step_order']
