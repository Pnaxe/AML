from rest_framework import viewsets, filters
from rest_framework.permissions import AllowAny
from django_filters.rest_framework import DjangoFilterBackend
from .models import SARTransmission, LawEnforcementAgency
from .serializers import SARTransmissionSerializer, LawEnforcementAgencySerializer


class SARTransmissionViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for SAR Transmissions (read-only for law enforcement portal)
    """
    queryset = SARTransmission.objects.select_related(
        'agency', 'subject_customer', 'filing_officer', 'approved_by'
    ).all()
    serializer_class = SARTransmissionSerializer
    permission_classes = [AllowAny]  # TODO: Change to IsAuthenticated in production
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'priority', 'agency']
    search_fields = ['sar_id', 'internal_reference', 'subject_customer__name', 'filing_institution']
    ordering_fields = ['created_at', 'transmitted_at', 'date_of_activity', 'total_suspicious_amount']
    ordering = ['-created_at']


class LawEnforcementAgencyViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for Law Enforcement Agencies
    """
    queryset = LawEnforcementAgency.objects.all()
    serializer_class = LawEnforcementAgencySerializer
    permission_classes = [AllowAny]  # TODO: Change to IsAuthenticated in production
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['jurisdiction']
    search_fields = ['name', 'agency_code']
