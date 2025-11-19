from django.contrib import admin
from .models import Alert, Investigation, AlertRule


@admin.register(Alert)
class AlertAdmin(admin.ModelAdmin):
    """Admin interface for Alert"""
    list_display = [
        'alert_id', 'alert_type', 'severity', 'status', 'customer',
        'risk_score', 'assigned_to', 'is_overdue', 'triggered_at'
    ]
    list_filter = ['alert_type', 'severity', 'status', 'is_overdue']
    search_fields = ['alert_id', 'customer__customer_id', 'title', 'description']
    readonly_fields = ['triggered_at', 'updated_at']
    date_hierarchy = 'triggered_at'
    filter_horizontal = ['transactions']
    
    fieldsets = (
        ('Alert Identifiers', {
            'fields': ('alert_id', 'alert_type', 'severity', 'status')
        }),
        ('Related Entities', {
            'fields': ('customer', 'transactions')
        }),
        ('Alert Content', {
            'fields': ('title', 'description', 'risk_score')
        }),
        ('ML Insights', {
            'fields': ('ml_confidence', 'ml_features'),
            'classes': ('collapse',)
        }),
        ('Case Management', {
            'fields': ('assigned_to', 'priority', 'sla_deadline', 'is_overdue')
        }),
        ('Investigation', {
            'fields': ('investigation_notes', 'resolution_notes')
        }),
        ('Timestamps', {
            'fields': ('triggered_at', 'assigned_at', 'resolved_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(Investigation)
class InvestigationAdmin(admin.ModelAdmin):
    """Admin interface for Investigation"""
    list_display = [
        'alert', 'investigator', 'started_at', 'completed_at',
        'is_suspicious', 'sar_required', 'sar_filed'
    ]
    list_filter = ['is_suspicious', 'sar_required', 'sar_filed']
    search_fields = ['alert__alert_id', 'investigator__username', 'findings']
    readonly_fields = ['started_at']
    filter_horizontal = ['related_alerts']
    
    fieldsets = (
        ('Investigation Info', {
            'fields': ('alert', 'investigator', 'started_at', 'completed_at')
        }),
        ('Findings', {
            'fields': ('findings', 'evidence_collected', 'related_alerts')
        }),
        ('Risk Assessment', {
            'fields': ('initial_risk_score', 'final_risk_score')
        }),
        ('Outcome', {
            'fields': ('is_suspicious', 'recommendation', 'action_taken')
        }),
        ('Regulatory', {
            'fields': ('sar_required', 'sar_filed', 'sar_filing_date', 'sar_reference')
        }),
    )


@admin.register(AlertRule)
class AlertRuleAdmin(admin.ModelAdmin):
    """Admin interface for AlertRule"""
    list_display = ['name', 'rule_type', 'severity', 'is_active', 'created_at']
    list_filter = ['rule_type', 'severity', 'is_active']
    search_fields = ['name', 'description']
    readonly_fields = ['created_at', 'updated_at']
