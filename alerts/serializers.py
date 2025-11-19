from rest_framework import serializers
from .models import Alert, Investigation, AlertRule


class AlertSerializer(serializers.ModelSerializer):
    """Serializer for Alert model"""
    customer_name = serializers.CharField(source='customer.get_full_name', read_only=True)
    customer_id = serializers.CharField(source='customer.customer_id', read_only=True)
    assigned_to_username = serializers.CharField(source='assigned_to.username', read_only=True)
    transaction_ids = serializers.SerializerMethodField()
    
    class Meta:
        model = Alert
        fields = [
            'id', 'alert_id', 'alert_type', 'severity', 'status',
            'customer', 'customer_id', 'customer_name',
            'transactions', 'transaction_ids',
            'title', 'description', 'risk_score',
            'ml_confidence', 'ml_features',
            'assigned_to', 'assigned_to_username', 'priority',
            'investigation_notes', 'resolution_notes',
            'triggered_at', 'assigned_at', 'resolved_at', 'updated_at',
            'sla_deadline', 'is_overdue'
        ]
        read_only_fields = [
            'id', 'triggered_at', 'updated_at', 'risk_score',
            'assigned_at', 'resolved_at'
        ]
    
    def get_transaction_ids(self, obj):
        return [t.transaction_id for t in obj.transactions.all()]


class AlertUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating Alert (limited fields)"""
    
    class Meta:
        model = Alert
        fields = [
            'status', 'assigned_to', 'priority',
            'investigation_notes', 'resolution_notes'
        ]


class InvestigationSerializer(serializers.ModelSerializer):
    """Serializer for Investigation model"""
    alert_id = serializers.CharField(source='alert.alert_id', read_only=True)
    alert_title = serializers.CharField(source='alert.title', read_only=True)
    customer_name = serializers.CharField(source='alert.customer.get_full_name', read_only=True)
    customer_id = serializers.CharField(source='alert.customer.customer_id', read_only=True)
    investigator_username = serializers.CharField(source='investigator.username', read_only=True)
    
    class Meta:
        model = Investigation
        fields = [
            'id', 'alert', 'alert_id', 'alert_title',
            'customer_name', 'customer_id',
            'investigator', 'investigator_username',
            'started_at', 'completed_at',
            'findings', 'evidence_collected', 'related_alerts',
            'initial_risk_score', 'final_risk_score',
            'is_suspicious', 'recommendation', 'action_taken',
            'sar_required', 'sar_filed', 'sar_filing_date', 'sar_reference'
        ]
        read_only_fields = ['id', 'started_at']


class AlertRuleSerializer(serializers.ModelSerializer):
    """Serializer for AlertRule model"""
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)
    
    class Meta:
        model = AlertRule
        fields = [
            'id', 'name', 'description', 'rule_type',
            'is_active', 'severity', 'threshold_config',
            'created_at', 'updated_at', 'created_by', 'created_by_username'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


