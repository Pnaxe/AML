from django.db import models
from django.core.validators import MinValueValidator
from decimal import Decimal
from accounts.models import Customer


class Transaction(models.Model):
    """Financial transaction record for AML monitoring"""
    TRANSACTION_TYPE_CHOICES = [
        ('DEPOSIT', 'Deposit'),
        ('WITHDRAWAL', 'Withdrawal'),
        ('TRANSFER', 'Transfer'),
        ('PAYMENT', 'Payment'),
        ('WIRE', 'Wire Transfer'),
        ('ATM', 'ATM Transaction'),
        ('CHECK', 'Check'),
        ('CARD', 'Card Payment'),
        ('CRYPTO', 'Cryptocurrency'),
        ('OTHER', 'Other'),
    ]
    
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('COMPLETED', 'Completed'),
        ('FAILED', 'Failed'),
        ('FLAGGED', 'Flagged for Review'),
        ('UNDER_REVIEW', 'Under Review'),
        ('CLEARED', 'Cleared'),
        ('BLOCKED', 'Blocked'),
    ]
    
    # Transaction Identifiers
    transaction_id = models.CharField(max_length=100, unique=True, db_index=True)
    reference_number = models.CharField(max_length=100, blank=True)
    
    # Transaction Details
    transaction_type = models.CharField(max_length=20, choices=TRANSACTION_TYPE_CHOICES)
    amount = models.DecimalField(
        max_digits=15, 
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))]
    )
    currency = models.CharField(max_length=3, default='USD')
    
    # Parties Involved
    sender = models.ForeignKey(
        Customer,
        on_delete=models.CASCADE,
        related_name='sent_transactions'
    )
    receiver = models.ForeignKey(
        Customer,
        on_delete=models.CASCADE,
        related_name='received_transactions',
        null=True,
        blank=True
    )
    
    # Transaction Location
    originating_country = models.CharField(max_length=100, blank=True)
    destination_country = models.CharField(max_length=100, blank=True)
    
    # Banking Details
    sender_account = models.CharField(max_length=100, blank=True)
    receiver_account = models.CharField(max_length=100, blank=True)
    sender_bank = models.CharField(max_length=200, blank=True)
    receiver_bank = models.CharField(max_length=200, blank=True)
    
    # Transaction Metadata
    description = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    
    # Timestamps
    transaction_date = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # Risk Assessment (populated by ML model)
    risk_score = models.FloatField(default=0.0)
    is_suspicious = models.BooleanField(default=False)
    
    # ML Model Flags
    velocity_flag = models.BooleanField(default=False)  # High frequency transactions
    structuring_flag = models.BooleanField(default=False)  # Structuring/smurfing detection
    unusual_pattern_flag = models.BooleanField(default=False)  # Unusual behavior
    high_risk_country_flag = models.BooleanField(default=False)  # High-risk jurisdiction
    amount_threshold_flag = models.BooleanField(default=False)  # Above threshold
    
    # Additional Context
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    device_id = models.CharField(max_length=200, blank=True)
    channel = models.CharField(max_length=50, blank=True)  # Online, Branch, ATM, etc.
    
    class Meta:
        db_table = 'transactions'
        verbose_name = 'Transaction'
        verbose_name_plural = 'Transactions'
        ordering = ['-transaction_date']
        indexes = [
            models.Index(fields=['transaction_id']),
            models.Index(fields=['sender', 'transaction_date']),
            models.Index(fields=['receiver', 'transaction_date']),
            models.Index(fields=['status']),
            models.Index(fields=['is_suspicious']),
            models.Index(fields=['transaction_date']),
            models.Index(fields=['amount']),
        ]
    
    def __str__(self):
        return f"{self.transaction_id} - {self.amount} {self.currency}"


class TransactionPattern(models.Model):
    """Stores transaction patterns for ML analysis"""
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name='patterns')
    
    # Pattern Metrics
    avg_transaction_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    max_transaction_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    transaction_count_daily = models.IntegerField(default=0)
    transaction_count_weekly = models.IntegerField(default=0)
    transaction_count_monthly = models.IntegerField(default=0)
    
    # Behavioral Patterns
    common_countries = models.JSONField(default=list)  # List of frequently transacted countries
    common_transaction_types = models.JSONField(default=list)
    typical_transaction_times = models.JSONField(default=list)  # Hour of day patterns
    
    # Risk Indicators
    sudden_increase_flag = models.BooleanField(default=False)
    dormant_account_activity = models.BooleanField(default=False)
    cross_border_frequency = models.IntegerField(default=0)
    
    # Metadata
    period_start = models.DateField()
    period_end = models.DateField()
    last_updated = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'transaction_patterns'
        verbose_name = 'Transaction Pattern'
        verbose_name_plural = 'Transaction Patterns'
        ordering = ['-last_updated']
        indexes = [
            models.Index(fields=['customer', 'period_end']),
        ]
    
    def __str__(self):
        return f"Pattern for {self.customer} ({self.period_start} to {self.period_end})"
