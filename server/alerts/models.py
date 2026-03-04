from django.db import models
from django.contrib.auth import get_user_model
from accounts.models import Customer
from transactions.models import Transaction

User = get_user_model()


class Alert(models.Model):
    """AML Alert/Case Management"""
    SEVERITY_CHOICES = [
        ('LOW', 'Low'),
        ('MEDIUM', 'Medium'),
        ('HIGH', 'High'),
        ('CRITICAL', 'Critical'),
    ]
    
    ALERT_TYPE_CHOICES = [
        ('THRESHOLD', 'Threshold Breach'),
        ('STRUCTURING', 'Structuring/Smurfing'),
        ('VELOCITY', 'High Velocity'),
        ('UNUSUAL_PATTERN', 'Unusual Pattern'),
        ('PEP', 'PEP Transaction'),
        ('SANCTION', 'Sanctions Match'),
        ('HIGH_RISK_COUNTRY', 'High Risk Country'),
        ('LARGE_CASH', 'Large Cash Transaction'),
        ('ROUND_AMOUNT', 'Round Amount'),
        ('RAPID_MOVEMENT', 'Rapid Fund Movement'),
        ('ML_PREDICTION', 'ML Model Prediction'),
        ('OTHER', 'Other'),
    ]
    
    STATUS_CHOICES = [
        ('NEW', 'New'),
        ('ASSIGNED', 'Assigned'),
        ('IN_PROGRESS', 'In Progress'),
        ('ESCALATED', 'Escalated'),
        ('RESOLVED', 'Resolved'),
        ('FALSE_POSITIVE', 'False Positive'),
        ('SAR_FILED', 'SAR Filed'),  # Suspicious Activity Report
        ('CLOSED', 'Closed'),
    ]
    
    # Alert Identifiers
    alert_id = models.CharField(max_length=50, unique=True, db_index=True)
    
    # Alert Details
    alert_type = models.CharField(max_length=30, choices=ALERT_TYPE_CHOICES)
    severity = models.CharField(max_length=20, choices=SEVERITY_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='NEW')
    
    # Related Entities
    customer = models.ForeignKey(
        Customer,
        on_delete=models.CASCADE,
        related_name='alerts'
    )
    transactions = models.ManyToManyField(
        Transaction,
        related_name='alerts',
        blank=True
    )
    
    # Alert Content
    title = models.CharField(max_length=255)
    description = models.TextField()
    risk_score = models.FloatField(default=0.0)
    
    # ML Model Insights
    ml_confidence = models.FloatField(default=0.0)  # ML model confidence score
    ml_features = models.JSONField(default=dict)  # Features that triggered the alert
    
    # Case Management
    assigned_to = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_alerts'
    )
    priority = models.IntegerField(default=3)  # 1=Highest, 5=Lowest
    
    # Investigation
    investigation_notes = models.TextField(blank=True)
    resolution_notes = models.TextField(blank=True)
    
    # Timestamps
    triggered_at = models.DateTimeField(auto_now_add=True)
    assigned_at = models.DateTimeField(null=True, blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # SLA Tracking
    sla_deadline = models.DateTimeField(null=True, blank=True)
    is_overdue = models.BooleanField(default=False)
    
    class Meta:
        db_table = 'alerts'
        verbose_name = 'Alert'
        verbose_name_plural = 'Alerts'
        ordering = ['-triggered_at']
        indexes = [
            models.Index(fields=['alert_id']),
            models.Index(fields=['customer', 'status']),
            models.Index(fields=['status', 'severity']),
            models.Index(fields=['assigned_to', 'status']),
            models.Index(fields=['triggered_at']),
        ]
    
    def __str__(self):
        return f"{self.alert_id} - {self.title} ({self.severity})"


class Investigation(models.Model):
    """Detailed investigation record for alerts"""
    alert = models.OneToOneField(Alert, on_delete=models.CASCADE, related_name='investigation')
    investigator = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    
    # Investigation Details
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    
    # Findings
    findings = models.TextField()
    evidence_collected = models.JSONField(default=list)
    related_alerts = models.ManyToManyField(Alert, related_name='related_investigations', blank=True)
    
    # Risk Assessment
    initial_risk_score = models.FloatField()
    final_risk_score = models.FloatField(null=True, blank=True)
    
    # Outcome
    is_suspicious = models.BooleanField(default=False)
    recommendation = models.TextField(blank=True)
    action_taken = models.TextField(blank=True)
    
    # Regulatory
    sar_required = models.BooleanField(default=False)
    sar_filed = models.BooleanField(default=False)
    sar_filing_date = models.DateTimeField(null=True, blank=True)
    sar_reference = models.CharField(max_length=100, blank=True)
    
    class Meta:
        db_table = 'investigations'
        verbose_name = 'Investigation'
        verbose_name_plural = 'Investigations'
        ordering = ['-started_at']
    
    def __str__(self):
        return f"Investigation for {self.alert.alert_id}"


class AlertRule(models.Model):
    """Configurable rules for triggering alerts"""
    name = models.CharField(max_length=200)
    description = models.TextField()
    rule_type = models.CharField(max_length=30, choices=Alert.ALERT_TYPE_CHOICES)
    
    # Rule Configuration
    is_active = models.BooleanField(default=True)
    severity = models.CharField(max_length=20, choices=Alert.SEVERITY_CHOICES)
    
    # Threshold Settings
    threshold_config = models.JSONField(default=dict)
    
    # Example threshold_config structure:
    # {
    #     "amount": {"min": 10000, "currency": "USD"},
    #     "frequency": {"count": 5, "period": "daily"},
    #     "countries": ["AF", "IR", "KP"],  # High-risk country codes
    # }
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    
    class Meta:
        db_table = 'alert_rules'
        verbose_name = 'Alert Rule'
        verbose_name_plural = 'Alert Rules'
        ordering = ['name']
    
    def __str__(self):
        return f"{self.name} ({'Active' if self.is_active else 'Inactive'})"
