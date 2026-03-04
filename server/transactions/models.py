from django.db import models
from django.core.validators import MinValueValidator
from decimal import Decimal
from accounts.models import Customer


class Transaction(models.Model):
    """Financial transaction record for AML monitoring"""
    OUTGOING_TRANSACTION_TYPES = {
        'WITHDRAWAL',
        'TRANSFER',
        'PAYMENT',
        'WIRE',
        'ATM',
        'CHECK',
        'CARD',
        'CRYPTO',
    }

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

    @property
    def stream_direction(self):
        return 'DR' if self.transaction_type in self.OUTGOING_TRANSACTION_TYPES else 'CR'

    @property
    def stream_status(self):
        if self.status in {'COMPLETED', 'CLEARED'}:
            return 'SUCCESS'
        if self.status in {'FAILED', 'BLOCKED'}:
            return 'FAILED'
        return 'PENDING'

    def to_stream_payload(self):
        sender_name = self.sender.get_full_name() if self.sender_id else ''
        receiver_name = self.receiver.get_full_name() if self.receiver_id else ''
        merchant_name = receiver_name or self.receiver_bank or self.sender_bank or 'Unknown Merchant'
        created_on = self.created_at or self.transaction_date

        return {
            'id': str(self.id),
            'reference': self.reference_number or self.transaction_id,
            'account_number': self.sender_account or self.receiver_account or '',
            'customer_name': sender_name,
            'merchant_name': merchant_name,
            'amount': str(self.amount),
            'currency': self.currency,
            'direction': self.stream_direction,
            'status': self.stream_status,
            'workflow_status': self.status,
            'created_at': created_on.isoformat() if created_on else None,
            'transaction_id': self.transaction_id,
            'transaction_type': self.transaction_type,
            'sender_name': sender_name,
            'receiver_name': receiver_name,
            'originating_country': self.originating_country,
            'destination_country': self.destination_country,
            'sender_bank': self.sender_bank,
            'receiver_bank': self.receiver_bank,
            'risk_score': self.risk_score,
            'is_suspicious': self.is_suspicious,
        }


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


class TransactionDataSource(models.Model):
    """Configuration for external transaction feeds (core banking/API/files)."""
    SOURCE_TYPE_CHOICES = [
        ('CORE_BANKING', 'Core Banking API'),
        ('API', 'Generic API'),
        ('FILE', 'File Upload'),
        ('MANUAL', 'Manual Entry'),
    ]

    AUTH_TYPE_CHOICES = [
        ('NONE', 'No Auth'),
        ('API_KEY', 'API Key'),
        ('BASIC', 'Basic Auth'),
        ('BEARER', 'Bearer Token'),
    ]

    name = models.CharField(max_length=120, unique=True)
    source_type = models.CharField(max_length=20, choices=SOURCE_TYPE_CHOICES, default='API')
    base_url = models.URLField(blank=True)
    auth_type = models.CharField(max_length=20, choices=AUTH_TYPE_CHOICES, default='NONE')
    api_key = models.CharField(max_length=255, blank=True)
    is_active = models.BooleanField(default=True)
    auto_monitor = models.BooleanField(default=True)
    poll_interval_seconds = models.PositiveIntegerField(default=60)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'transaction_data_sources'
        verbose_name = 'Transaction Data Source'
        verbose_name_plural = 'Transaction Data Sources'
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.source_type})"
