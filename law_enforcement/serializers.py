from rest_framework import serializers
from .models import SARTransmission, LawEnforcementAgency


class LawEnforcementAgencySerializer(serializers.ModelSerializer):
    class Meta:
        model = LawEnforcementAgency
        fields = ['id', 'name', 'agency_code', 'jurisdiction', 'contact_email', 'contact_phone']


class SARTransmissionSerializer(serializers.ModelSerializer):
    agency = LawEnforcementAgencySerializer(read_only=True)
    agency_id = serializers.IntegerField(write_only=True, required=False)
    subject_customer_name = serializers.CharField(source='subject_customer.name', read_only=True, allow_null=True)
    subject_customer_id = serializers.IntegerField(source='subject_customer.id', read_only=True, allow_null=True)
    filing_officer_username = serializers.CharField(source='filing_officer.username', read_only=True, allow_null=True)
    approved_by_username = serializers.CharField(source='approved_by.username', read_only=True, allow_null=True)
    
    class Meta:
        model = SARTransmission
        fields = [
            'id', 'sar_id', 'internal_reference', 'agency', 'agency_id',
            'subject_customer_name', 'subject_customer_id',
            'narrative', 'suspicious_activity_summary',
            'total_suspicious_amount', 'currency',
            'date_of_activity', 'activity_period_start', 'activity_period_end',
            'filing_institution', 'filing_officer_username', 'approved_by_username',
            'status', 'priority',
            'transmission_method', 'transmission_attempts',
            'transmitted_at', 'acknowledged_at',
            'is_digitally_signed', 'acknowledgment_reference',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'transmitted_at', 'acknowledged_at']

