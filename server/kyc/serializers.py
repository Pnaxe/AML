from rest_framework import serializers
from .models import KYCProfile, KYCDocument, KYCVerificationStep
from accounts.models import Customer


class KYCProfileSerializer(serializers.ModelSerializer):
    """Serializer for KYCProfile model"""
    customer_id = serializers.CharField(source='customer.customer_id', read_only=True)
    customer_name = serializers.CharField(source='customer.get_full_name', read_only=True)
    assigned_officer_username = serializers.CharField(source='assigned_officer.username', read_only=True)
    verified_by_username = serializers.CharField(source='verified_by.username', read_only=True)
    
    class Meta:
        model = KYCProfile
        fields = [
            'id', 'customer', 'customer_id', 'customer_name',
            'verification_status', 'kyc_risk_level', 'due_diligence_level',
            'source_of_funds', 'source_of_wealth', 'expected_transaction_volume',
            'expected_transaction_frequency', 'beneficial_owners',
            'nature_of_business', 'business_sector', 'annual_revenue',
            'number_of_employees', 'verification_date', 'verification_expiry',
            'last_review_date', 'next_review_date', 'assigned_officer',
            'assigned_officer_username', 'verified_by', 'verified_by_username',
            'rejection_reason', 'verification_notes', 'requires_edd',
            'edd_reason', 'edd_completed', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class KYCDocumentSerializer(serializers.ModelSerializer):
    """Serializer for KYCDocument model"""
    kyc_profile_id = serializers.IntegerField(source='kyc_profile.id', read_only=True)
    
    class Meta:
        model = KYCDocument
        fields = [
            'id', 'kyc_profile', 'kyc_profile_id', 'document_type',
            'document_number', 'issuing_authority', 'issue_date',
            'expiry_date', 'file_path', 'verification_status',
            'verification_notes', 'uploaded_at', 'verified_at'
        ]
        read_only_fields = ['id', 'uploaded_at', 'verified_at']


class KYCVerificationStepSerializer(serializers.ModelSerializer):
    """Serializer for KYCVerificationStep model"""
    kyc_profile_id = serializers.IntegerField(source='kyc_profile.id', read_only=True)
    assigned_to_username = serializers.CharField(source='assigned_to.username', read_only=True)
    completed_by_username = serializers.CharField(source='completed_by.username', read_only=True)
    
    class Meta:
        model = KYCVerificationStep
        fields = [
            'id', 'kyc_profile', 'kyc_profile_id', 'step_type', 'step_order',
            'status', 'is_mandatory', 'assigned_to', 'assigned_to_username',
            'completed_by', 'completed_by_username', 'description', 'outcome',
            'notes', 'started_at', 'completed_at', 'due_date', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

