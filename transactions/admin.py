from django.contrib import admin
from .models import Transaction, TransactionPattern


@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    """Admin interface for Transaction"""
    list_display = [
        'transaction_id', 'transaction_type', 'amount', 'currency',
        'sender', 'receiver', 'status', 'is_suspicious', 'risk_score',
        'transaction_date'
    ]
    list_filter = [
        'transaction_type', 'status', 'is_suspicious', 'currency',
        'velocity_flag', 'structuring_flag', 'high_risk_country_flag'
    ]
    search_fields = ['transaction_id', 'reference_number', 'sender__customer_id', 'receiver__customer_id']
    readonly_fields = ['created_at', 'updated_at']
    date_hierarchy = 'transaction_date'
    
    fieldsets = (
        ('Transaction Identifiers', {
            'fields': ('transaction_id', 'reference_number')
        }),
        ('Transaction Details', {
            'fields': ('transaction_type', 'amount', 'currency', 'description', 'status')
        }),
        ('Parties Involved', {
            'fields': ('sender', 'receiver')
        }),
        ('Location', {
            'fields': ('originating_country', 'destination_country')
        }),
        ('Banking Details', {
            'fields': ('sender_account', 'receiver_account', 'sender_bank', 'receiver_bank'),
            'classes': ('collapse',)
        }),
        ('Risk Assessment', {
            'fields': ('risk_score', 'is_suspicious')
        }),
        ('ML Flags', {
            'fields': (
                'velocity_flag', 'structuring_flag', 'unusual_pattern_flag',
                'high_risk_country_flag', 'amount_threshold_flag'
            ),
            'classes': ('collapse',)
        }),
        ('Additional Context', {
            'fields': ('ip_address', 'device_id', 'channel'),
            'classes': ('collapse',)
        }),
        ('Timestamps', {
            'fields': ('transaction_date', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(TransactionPattern)
class TransactionPatternAdmin(admin.ModelAdmin):
    """Admin interface for TransactionPattern"""
    list_display = [
        'customer', 'period_start', 'period_end',
        'avg_transaction_amount', 'transaction_count_monthly',
        'sudden_increase_flag', 'last_updated'
    ]
    list_filter = ['sudden_increase_flag', 'dormant_account_activity']
    search_fields = ['customer__customer_id', 'customer__first_name', 'customer__last_name']
    readonly_fields = ['last_updated']
    date_hierarchy = 'period_end'
