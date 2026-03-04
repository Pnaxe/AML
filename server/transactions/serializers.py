from rest_framework import serializers
from .models import Transaction, TransactionPattern, TransactionDataSource


class TransactionSerializer(serializers.ModelSerializer):
    """Serializer for Transaction model"""
    sender_name = serializers.CharField(source='sender.get_full_name', read_only=True)
    receiver_name = serializers.CharField(source='receiver.get_full_name', read_only=True)
    sender_id = serializers.IntegerField(source='sender.id', read_only=True)
    receiver_id = serializers.IntegerField(source='receiver.id', read_only=True)
    
    class Meta:
        model = Transaction
        fields = [
            'id', 'transaction_id', 'reference_number', 'transaction_type',
            'amount', 'currency', 'sender', 'sender_id', 'sender_name',
            'receiver', 'receiver_id', 'receiver_name',
            'originating_country', 'destination_country',
            'sender_account', 'receiver_account', 'sender_bank', 'receiver_bank',
            'description', 'status', 'transaction_date',
            'risk_score', 'is_suspicious',
            'velocity_flag', 'structuring_flag', 'unusual_pattern_flag',
            'high_risk_country_flag', 'amount_threshold_flag',
            'ip_address', 'device_id', 'channel',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'risk_score']


class TransactionCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating Transaction"""
    
    class Meta:
        model = Transaction
        fields = [
            'transaction_id', 'reference_number', 'transaction_type',
            'amount', 'currency', 'sender', 'receiver',
            'originating_country', 'destination_country',
            'sender_account', 'receiver_account', 'sender_bank', 'receiver_bank',
            'description', 'status', 'transaction_date',
            'ip_address', 'device_id', 'channel'
        ]


class TransactionPatternSerializer(serializers.ModelSerializer):
    """Serializer for TransactionPattern model"""
    customer_name = serializers.CharField(source='customer.get_full_name', read_only=True)
    
    class Meta:
        model = TransactionPattern
        fields = [
            'id', 'customer', 'customer_name',
            'avg_transaction_amount', 'max_transaction_amount',
            'transaction_count_daily', 'transaction_count_weekly',
            'transaction_count_monthly', 'common_countries',
            'common_transaction_types', 'typical_transaction_times',
            'sudden_increase_flag', 'dormant_account_activity',
            'cross_border_frequency', 'period_start', 'period_end',
            'last_updated'
        ]
        read_only_fields = ['id', 'last_updated']


class TransactionDataSourceSerializer(serializers.ModelSerializer):
    class Meta:
        model = TransactionDataSource
        fields = [
            'id', 'name', 'source_type', 'base_url', 'auth_type', 'api_key',
            'is_active', 'auto_monitor', 'poll_interval_seconds', 'notes',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


