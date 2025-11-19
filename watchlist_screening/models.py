"""
Watchlist Screening Models
Handles sanctions lists, PEP databases, criminal watchlists, and screening operations
"""
from django.db import models
from django.contrib.auth import get_user_model
from accounts.models import Customer
from django.core.validators import MinValueValidator, MaxValueValidator
from django.utils import timezone

User = get_user_model()


class WatchlistSource(models.Model):
    """
    External watchlist/sanctions list sources
    OFAC, EU, UN, PEP databases, criminal records, etc.
    """
    SOURCE_TYPE_CHOICES = [
        ('SANCTIONS', 'Sanctions List'),
        ('PEP', 'Politically Exposed Persons'),
        ('CRIMINAL', 'Criminal Watchlist'),
        ('TERRORIST', 'Terrorist Financing'),
        ('FRAUD', 'Fraud Database'),
        ('ADVERSE_MEDIA', 'Adverse Media'),
        ('CUSTOM', 'Custom List'),
    ]
    
    STATUS_CHOICES = [
        ('ACTIVE', 'Active'),
        ('INACTIVE', 'Inactive'),
        ('UPDATING', 'Updating'),
        ('ERROR', 'Error'),
    ]
    
    name = models.CharField(max_length=200, unique=True)
    source_type = models.CharField(max_length=20, choices=SOURCE_TYPE_CHOICES)
    provider = models.CharField(max_length=200)  # e.g., "OFAC", "EU Commission"
    description = models.TextField(blank=True)
    
    # Source Configuration
    api_endpoint = models.URLField(blank=True)
    update_frequency = models.CharField(max_length=50, default='DAILY')  # HOURLY, DAILY, WEEKLY
    last_update = models.DateTimeField(null=True, blank=True)
    next_scheduled_update = models.DateTimeField(null=True, blank=True)
    
    # Version Control
    current_version = models.CharField(max_length=100, blank=True)
    list_timestamp = models.DateTimeField(null=True, blank=True)  # When list was published by provider
    
    # Status & Metrics
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='ACTIVE')
    total_entries = models.IntegerField(default=0)
    is_enabled = models.BooleanField(default=True)
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    
    class Meta:
        db_table = 'watchlist_sources'
        verbose_name = 'Watchlist Source'
        verbose_name_plural = 'Watchlist Sources'
        ordering = ['name']
    
    def __str__(self):
        return f"{self.name} ({self.source_type})"


class WatchlistEntry(models.Model):
    """
    Individual entries from watchlists
    Represents sanctioned individuals, PEPs, criminals, etc.
    """
    ENTITY_TYPE_CHOICES = [
        ('INDIVIDUAL', 'Individual'),
        ('ORGANIZATION', 'Organization'),
        ('VESSEL', 'Vessel'),
        ('AIRCRAFT', 'Aircraft'),
    ]
    
    source = models.ForeignKey(
        WatchlistSource,
        on_delete=models.CASCADE,
        related_name='entries'
    )
    
    # Entity Identification
    entity_type = models.CharField(max_length=20, choices=ENTITY_TYPE_CHOICES)
    entry_id = models.CharField(max_length=200, db_index=True)  # Source's ID for this entry
    
    # Individual Data
    full_name = models.CharField(max_length=500, db_index=True)
    aliases = models.JSONField(default=list)  # List of known aliases
    date_of_birth = models.DateField(null=True, blank=True)
    place_of_birth = models.CharField(max_length=200, blank=True)
    nationality = models.CharField(max_length=100, blank=True)
    
    # Organization Data
    organization_name = models.CharField(max_length=500, blank=True, db_index=True)
    registration_number = models.CharField(max_length=200, blank=True)
    
    # Identification Numbers
    passport_numbers = models.JSONField(default=list)
    national_id_numbers = models.JSONField(default=list)
    tax_id_numbers = models.JSONField(default=list)
    
    # Address Information
    addresses = models.JSONField(default=list)  # List of known addresses
    countries = models.JSONField(default=list)  # List of associated countries
    
    # Listing Details
    listing_reason = models.TextField(blank=True)
    listing_date = models.DateField(null=True, blank=True)
    program = models.CharField(max_length=200, blank=True)  # e.g., "SDN", "EU Sanctions"
    
    # Additional Data
    remarks = models.TextField(blank=True)
    additional_info = models.JSONField(default=dict)  # Flexible storage
    
    # Status
    is_active = models.BooleanField(default=True)
    removed_date = models.DateField(null=True, blank=True)
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_verified = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        db_table = 'watchlist_entries'
        verbose_name = 'Watchlist Entry'
        verbose_name_plural = 'Watchlist Entries'
        indexes = [
            models.Index(fields=['source', 'entry_id']),
            models.Index(fields=['full_name']),
            models.Index(fields=['organization_name']),
            models.Index(fields=['is_active']),
        ]
        unique_together = ['source', 'entry_id']
    
    def __str__(self):
        name = self.full_name or self.organization_name
        return f"{name} ({self.source.name})"


class ScreeningJob(models.Model):
    """
    Batch screening jobs for periodic rescreening
    """
    JOB_TYPE_CHOICES = [
        ('FULL_RESCAN', 'Full Database Rescan'),
        ('INCREMENTAL', 'Incremental Update'),
        ('ON_DEMAND', 'On-Demand Screening'),
        ('NEW_LIST_CHECK', 'New List Integration'),
    ]
    
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('RUNNING', 'Running'),
        ('COMPLETED', 'Completed'),
        ('FAILED', 'Failed'),
        ('CANCELLED', 'Cancelled'),
    ]
    
    job_id = models.CharField(max_length=100, unique=True, db_index=True)
    job_type = models.CharField(max_length=20, choices=JOB_TYPE_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    
    # Job Configuration
    sources = models.ManyToManyField(WatchlistSource, related_name='screening_jobs')
    fuzzy_threshold = models.FloatField(
        default=0.85,
        validators=[MinValueValidator(0.0), MaxValueValidator(1.0)]
    )
    
    # Progress Tracking
    total_customers = models.IntegerField(default=0)
    processed_customers = models.IntegerField(default=0)
    matches_found = models.IntegerField(default=0)
    
    # Timing
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    duration_seconds = models.IntegerField(null=True, blank=True)
    
    # Results
    error_message = models.TextField(blank=True)
    results_summary = models.JSONField(default=dict)
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    
    class Meta:
        db_table = 'screening_jobs'
        verbose_name = 'Screening Job'
        verbose_name_plural = 'Screening Jobs'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.job_id} - {self.job_type} ({self.status})"


class ScreeningMatch(models.Model):
    """
    Individual screening matches between customers and watchlist entries
    """
    MATCH_TYPE_CHOICES = [
        ('EXACT', 'Exact Match'),
        ('PROBABLE', 'Probable Match'),
        ('FUZZY', 'Fuzzy Match'),
        ('POSSIBLE', 'Possible Match'),
    ]
    
    STATUS_CHOICES = [
        ('NEW', 'New Match'),
        ('UNDER_REVIEW', 'Under Review'),
        ('CONFIRMED', 'Confirmed True Positive'),
        ('FALSE_POSITIVE', 'False Positive'),
        ('ESCALATED', 'Escalated'),
        ('CLEARED', 'Cleared'),
    ]
    
    # Match Identifiers
    match_id = models.CharField(max_length=100, unique=True, db_index=True)
    
    # Entities Involved
    customer = models.ForeignKey(
        Customer,
        on_delete=models.CASCADE,
        related_name='screening_matches'
    )
    watchlist_entry = models.ForeignKey(
        WatchlistEntry,
        on_delete=models.CASCADE,
        related_name='matches'
    )
    
    # Match Details
    match_type = models.CharField(max_length=20, choices=MATCH_TYPE_CHOICES)
    match_score = models.FloatField(
        validators=[MinValueValidator(0.0), MaxValueValidator(1.0)]
    )
    confidence_score = models.FloatField(
        validators=[MinValueValidator(0.0), MaxValueValidator(1.0)]
    )
    
    # Matching Fields
    matched_fields = models.JSONField(default=dict)
    # Example: {"name": 0.95, "dob": 1.0, "nationality": 1.0}
    
    # Status & Review
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='NEW')
    reviewed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviewed_matches'
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    review_notes = models.TextField(blank=True)
    
    # Override & Reason Codes
    is_overridden = models.BooleanField(default=False)
    override_reason = models.TextField(blank=True)
    override_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='overridden_matches'
    )
    override_at = models.DateTimeField(null=True, blank=True)
    
    # Source Tracking (for audit)
    screening_job = models.ForeignKey(
        ScreeningJob,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='matches'
    )
    source_list_version = models.CharField(max_length=100, blank=True)
    
    # Evidence & Context
    evidence_data = models.JSONField(default=dict)  # Store matching details
    
    # Auto-Actions
    auto_block_triggered = models.BooleanField(default=False)
    alert_generated = models.BooleanField(default=False)
    
    # Timestamps
    detected_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'screening_matches'
        verbose_name = 'Screening Match'
        verbose_name_plural = 'Screening Matches'
        ordering = ['-detected_at']
        indexes = [
            models.Index(fields=['customer', 'status']),
            models.Index(fields=['match_type', 'match_score']),
            models.Index(fields=['status', 'detected_at']),
        ]
    
    def __str__(self):
        return f"{self.match_id} - {self.customer} matched to {self.watchlist_entry}"


class ScreeningConfiguration(models.Model):
    """
    Configurable screening rules and thresholds
    """
    name = models.CharField(max_length=200, unique=True)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    
    # Matching Thresholds
    exact_match_threshold = models.FloatField(default=1.0)
    probable_match_threshold = models.FloatField(default=0.90)
    fuzzy_match_threshold = models.FloatField(default=0.75)
    
    # Auto-Actions
    auto_block_on_exact = models.BooleanField(default=True)
    auto_alert_on_probable = models.BooleanField(default=True)
    auto_escalate_sources = models.ManyToManyField(
        WatchlistSource,
        blank=True,
        related_name='auto_escalate_configs'
    )
    
    # Field Weights for Fuzzy Matching
    field_weights = models.JSONField(default=dict)
    # Example: {"name": 0.4, "dob": 0.3, "nationality": 0.2, "address": 0.1}
    
    # Screening Frequency
    real_time_screening = models.BooleanField(default=True)
    periodic_rescan_enabled = models.BooleanField(default=True)
    rescan_frequency_days = models.IntegerField(default=7)
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    
    class Meta:
        db_table = 'screening_configurations'
        verbose_name = 'Screening Configuration'
        verbose_name_plural = 'Screening Configurations'
    
    def __str__(self):
        return f"{self.name} ({'Active' if self.is_active else 'Inactive'})"


class ScreeningAuditLog(models.Model):
    """
    Immutable audit trail for all screening operations
    """
    ACTION_CHOICES = [
        ('SCREEN_CUSTOMER', 'Screen Customer'),
        ('BATCH_SCREEN', 'Batch Screening'),
        ('MATCH_REVIEW', 'Match Review'),
        ('MATCH_OVERRIDE', 'Match Override'),
        ('LIST_UPDATE', 'List Update'),
        ('CONFIG_CHANGE', 'Configuration Change'),
    ]
    
    action = models.CharField(max_length=30, choices=ACTION_CHOICES)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    
    # Related Objects
    customer = models.ForeignKey(Customer, on_delete=models.SET_NULL, null=True, blank=True)
    screening_match = models.ForeignKey(ScreeningMatch, on_delete=models.SET_NULL, null=True, blank=True)
    screening_job = models.ForeignKey(ScreeningJob, on_delete=models.SET_NULL, null=True, blank=True)
    
    # Action Details
    details = models.JSONField(default=dict)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    
    # Immutable timestamp
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)
    
    class Meta:
        db_table = 'screening_audit_logs'
        verbose_name = 'Screening Audit Log'
        verbose_name_plural = 'Screening Audit Logs'
        ordering = ['-timestamp']
        # Prevent deletion
        permissions = [
            ('view_screening_audit', 'Can view screening audit logs'),
        ]
    
    def __str__(self):
        return f"{self.action} by {self.user} at {self.timestamp}"
