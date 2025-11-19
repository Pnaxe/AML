"""
SAR (Suspicious Activity Report) Filing Module
Automated SAR generation, templates, and regulatory compliance reporting
"""
from django.db import models
from django.contrib.auth import get_user_model
from accounts.models import Customer
from transactions.models import Transaction
from alerts.models import Alert, Investigation
from django.utils import timezone

User = get_user_model()


class SARTemplate(models.Model):
    """
    Configurable SAR report templates for different jurisdictions
    """
    JURISDICTION_CHOICES = [
        ('US_FINCEN', 'US FinCEN'),
        ('UK_NCA', 'UK NCA'),
        ('EU_FIU', 'EU Financial Intelligence Unit'),
        ('FATF', 'FATF Standard'),
        ('CUSTOM', 'Custom Template'),
    ]
    
    FORMAT_CHOICES = [
        ('PDF', 'PDF Document'),
        ('XML', 'XML Format'),
        ('JSON', 'JSON Format'),
        ('E-FILE', 'E-Filing Format'),
    ]
    
    # Template Identification
    template_name = models.CharField(max_length=200, unique=True)
    jurisdiction = models.CharField(max_length=30, choices=JURISDICTION_CHOICES)
    description = models.TextField(blank=True)
    
    # Format
    output_format = models.CharField(max_length=20, choices=FORMAT_CHOICES)
    template_version = models.CharField(max_length=50)
    
    # Template Content
    template_structure = models.JSONField(default=dict)
    # Structure defines required fields, sections, validations
    
    required_fields = models.JSONField(default=list)
    optional_fields = models.JSONField(default=list)
    
    # Generation Settings
    auto_populate_fields = models.JSONField(default=dict)
    # Maps investigation fields to SAR fields
    
    # Narrative Templates
    narrative_template = models.TextField(blank=True)
    # Template with placeholders for narrative generation
    
    # Validation Rules
    validation_rules = models.JSONField(default=dict)
    
    # Status
    is_active = models.BooleanField(default=True)
    is_default = models.BooleanField(default=False)
    
    # Regulatory Information
    regulatory_authority = models.CharField(max_length=300, blank=True)
    filing_instructions_url = models.URLField(blank=True)
    regulation_reference = models.CharField(max_length=200, blank=True)
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True
    )
    
    class Meta:
        db_table = 'sar_templates'
        verbose_name = 'SAR Template'
        verbose_name_plural = 'SAR Templates'
        ordering = ['jurisdiction', 'template_name']
    
    def __str__(self):
        return f"{self.template_name} ({self.jurisdiction})"


class SARReport(models.Model):
    """
    Suspicious Activity Report records
    """
    STATUS_CHOICES = [
        ('DRAFT', 'Draft'),
        ('PENDING_REVIEW', 'Pending Review'),
        ('UNDER_REVIEW', 'Under Review'),
        ('PENDING_APPROVAL', 'Pending Approval'),
        ('APPROVED', 'Approved'),
        ('FILED', 'Filed'),
        ('ACKNOWLEDGED', 'Acknowledged'),
        ('REJECTED', 'Rejected'),
        ('CANCELLED', 'Cancelled'),
    ]
    
    PRIORITY_CHOICES = [
        ('ROUTINE', 'Routine'),
        ('PRIORITY', 'Priority'),
        ('URGENT', 'Urgent'),
        ('CRITICAL', 'Critical'),
    ]
    
    ACTIVITY_TYPE_CHOICES = [
        ('STRUCTURING', 'Structuring'),
        ('MONEY_LAUNDERING', 'Money Laundering'),
        ('TERRORIST_FINANCING', 'Terrorist Financing'),
        ('FRAUD', 'Fraud'),
        ('IDENTITY_THEFT', 'Identity Theft'),
        ('SANCTIONS_VIOLATION', 'Sanctions Violation'),
        ('CYBERCRIME', 'Cybercrime'),
        ('CORRUPTION', 'Corruption'),
        ('TAX_EVASION', 'Tax Evasion'),
        ('OTHER', 'Other Suspicious Activity'),
    ]
    
    # SAR Identification
    sar_number = models.CharField(max_length=100, unique=True, db_index=True)
    internal_reference = models.CharField(max_length=100, blank=True, db_index=True)
    
    # Template & Jurisdiction
    template = models.ForeignKey(
        SARTemplate,
        on_delete=models.PROTECT,
        related_name='sar_reports'
    )
    
    # Related Investigation
    investigation = models.ForeignKey(
        Investigation,
        on_delete=models.PROTECT,
        related_name='sar_reports'
    )
    alerts = models.ManyToManyField(Alert, related_name='sar_reports')
    
    # Subject of SAR
    subject_customer = models.ForeignKey(
        Customer,
        on_delete=models.PROTECT,
        related_name='subject_sar_reports'
    )
    related_customers = models.ManyToManyField(
        Customer,
        related_name='related_sar_reports',
        blank=True
    )
    
    # Suspicious Transactions
    suspicious_transactions = models.ManyToManyField(
        Transaction,
        related_name='sar_reports'
    )
    
    # SAR Details
    activity_type = models.CharField(max_length=30, choices=ACTIVITY_TYPE_CHOICES)
    activity_types = models.JSONField(default=list)  # Multiple types possible
    
    # Dates
    date_of_activity = models.DateField()
    activity_period_start = models.DateField(null=True, blank=True)
    activity_period_end = models.DateField(null=True, blank=True)
    date_of_detection = models.DateField()
    
    # Financial Details
    total_amount = models.DecimalField(
        max_digits=20,
        decimal_places=2,
        null=True,
        blank=True
    )
    currency = models.CharField(max_length=3, default='USD')
    
    # Narrative
    narrative = models.TextField()
    activity_description = models.TextField()
    reason_for_filing = models.TextField()
    
    # Supporting Information
    supporting_documentation = models.JSONField(default=list)
    # List of evidence IDs
    
    # Filing Institution
    filing_institution_name = models.CharField(max_length=300)
    filing_institution_id = models.CharField(max_length=100, blank=True)
    filing_institution_address = models.TextField(blank=True)
    
    # Filing Officer
    filing_officer = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='filed_sar_reports'
    )
    filing_officer_title = models.CharField(max_length=200, blank=True)
    filing_officer_phone = models.CharField(max_length=50, blank=True)
    filing_officer_email = models.EmailField(blank=True)
    
    # Review & Approval
    reviewed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviewed_sar_reports'
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    review_notes = models.TextField(blank=True)
    
    approved_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approved_sar_reports'
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    approval_notes = models.TextField(blank=True)
    
    # Status & Priority
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='DRAFT')
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default='ROUTINE')
    
    # Filing Information
    filed_at = models.DateTimeField(null=True, blank=True)
    filing_deadline = models.DateField(null=True, blank=True)
    is_overdue = models.BooleanField(default=False)
    
    # Regulatory Response
    acknowledgment_number = models.CharField(max_length=200, blank=True)
    acknowledged_at = models.DateTimeField(null=True, blank=True)
    regulatory_feedback = models.TextField(blank=True)
    
    # Rejection
    rejection_reason = models.TextField(blank=True)
    rejected_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='rejected_sar_reports'
    )
    rejected_at = models.DateTimeField(null=True, blank=True)
    
    # Continuation & Amendment
    is_continuation = models.BooleanField(default=False)
    is_amendment = models.BooleanField(default=False)
    original_sar = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='amendments'
    )
    amendment_reason = models.TextField(blank=True)
    
    # Law Enforcement Contact
    law_enforcement_contacted = models.BooleanField(default=False)
    law_enforcement_contact_date = models.DateField(null=True, blank=True)
    law_enforcement_agency = models.CharField(max_length=300, blank=True)
    
    # Metadata
    version = models.IntegerField(default=1)
    notes = models.TextField(blank=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'sar_reports'
        verbose_name = 'SAR Report'
        verbose_name_plural = 'SAR Reports'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['sar_number']),
            models.Index(fields=['status', 'priority']),
            models.Index(fields=['filing_deadline']),
            models.Index(fields=['subject_customer']),
        ]
    
    def __str__(self):
        return f"SAR {self.sar_number} - {self.subject_customer}"


class SARNarrative(models.Model):
    """
    AI-assisted narrative generation and storage
    """
    NARRATIVE_TYPE_CHOICES = [
        ('ACTIVITY_DESCRIPTION', 'Activity Description'),
        ('REASON_FOR_FILING', 'Reason for Filing'),
        ('FULL_NARRATIVE', 'Full Narrative'),
        ('TIMELINE', 'Timeline of Events'),
        ('RELATIONSHIP_ANALYSIS', 'Relationship Analysis'),
    ]
    
    sar_report = models.ForeignKey(
        SARReport,
        on_delete=models.CASCADE,
        related_name='narratives'
    )
    
    narrative_type = models.CharField(max_length=30, choices=NARRATIVE_TYPE_CHOICES)
    
    # Content
    content = models.TextField()
    
    # Generation Method
    is_auto_generated = models.BooleanField(default=False)
    ai_confidence = models.FloatField(null=True, blank=True)
    generation_model = models.CharField(max_length=100, blank=True)
    
    # Review
    is_reviewed = models.BooleanField(default=False)
    reviewed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    
    # Version Control
    version = models.IntegerField(default=1)
    previous_version = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='next_versions'
    )
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'sar_narratives'
        verbose_name = 'SAR Narrative'
        verbose_name_plural = 'SAR Narratives'
        ordering = ['-version']
    
    def __str__(self):
        return f"{self.narrative_type} for SAR {self.sar_report.sar_number}"


class SARAttachment(models.Model):
    """
    Supporting documents attached to SAR reports
    """
    ATTACHMENT_TYPE_CHOICES = [
        ('TRANSACTION_RECORD', 'Transaction Record'),
        ('ACCOUNT_STATEMENT', 'Account Statement'),
        ('IDENTIFICATION', 'Identification Document'),
        ('CORRESPONDENCE', 'Correspondence'),
        ('INTERNAL_REPORT', 'Internal Investigation Report'),
        ('SCREENSHOT', 'Screenshot'),
        ('EXTERNAL_EVIDENCE', 'External Evidence'),
        ('OTHER', 'Other'),
    ]
    
    sar_report = models.ForeignKey(
        SARReport,
        on_delete=models.CASCADE,
        related_name='attachments'
    )
    
    # Attachment Details
    attachment_type = models.CharField(max_length=30, choices=ATTACHMENT_TYPE_CHOICES)
    title = models.CharField(max_length=300)
    description = models.TextField(blank=True)
    
    # File
    file = models.FileField(upload_to='sar_attachments/')
    file_name = models.CharField(max_length=300)
    file_size_bytes = models.BigIntegerField()
    file_hash = models.CharField(max_length=64)  # SHA-256
    mime_type = models.CharField(max_length=100, blank=True)
    
    # Security
    is_redacted = models.BooleanField(default=False)
    redaction_notes = models.TextField(blank=True)
    
    # Metadata
    display_order = models.IntegerField(default=0)
    uploaded_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'sar_attachments'
        verbose_name = 'SAR Attachment'
        verbose_name_plural = 'SAR Attachments'
        ordering = ['sar_report', 'display_order']
    
    def __str__(self):
        return f"{self.title} for SAR {self.sar_report.sar_number}"


class SARExport(models.Model):
    """
    Export/generation history for SAR reports
    """
    EXPORT_FORMAT_CHOICES = [
        ('PDF', 'PDF Document'),
        ('XML', 'XML Format'),
        ('JSON', 'JSON Format'),
        ('E-FILE', 'E-Filing Format'),
    ]
    
    STATUS_CHOICES = [
        ('GENERATING', 'Generating'),
        ('COMPLETED', 'Completed'),
        ('FAILED', 'Failed'),
    ]
    
    sar_report = models.ForeignKey(
        SARReport,
        on_delete=models.CASCADE,
        related_name='exports'
    )
    
    # Export Details
    export_format = models.CharField(max_length=20, choices=EXPORT_FORMAT_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='GENERATING')
    
    # Generated File
    generated_file = models.FileField(
        upload_to='sar_exports/',
        null=True,
        blank=True
    )
    file_size_bytes = models.BigIntegerField(null=True, blank=True)
    file_hash = models.CharField(max_length=64, blank=True)
    
    # Digital Signature
    is_signed = models.BooleanField(default=False)
    signature_data = models.TextField(blank=True)
    signature_timestamp = models.DateTimeField(null=True, blank=True)
    
    # Generation Details
    generated_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True
    )
    generation_duration_ms = models.IntegerField(null=True, blank=True)
    
    # Error Handling
    error_message = models.TextField(blank=True)
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'sar_exports'
        verbose_name = 'SAR Export'
        verbose_name_plural = 'SAR Exports'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.export_format} export of SAR {self.sar_report.sar_number}"


class SARDeadlineTracker(models.Model):
    """
    Track and alert on SAR filing deadlines
    """
    sar_report = models.OneToOneField(
        SARReport,
        on_delete=models.CASCADE,
        related_name='deadline_tracker'
    )
    
    # Deadline Calculation
    detection_date = models.DateField()
    filing_deadline = models.DateField()
    days_until_deadline = models.IntegerField()
    
    # Status
    is_overdue = models.BooleanField(default=False)
    days_overdue = models.IntegerField(default=0)
    
    # Alerts
    alert_sent = models.BooleanField(default=False)
    alert_sent_at = models.DateTimeField(null=True, blank=True)
    escalation_sent = models.BooleanField(default=False)
    escalation_sent_at = models.DateTimeField(null=True, blank=True)
    
    # Extension
    extension_granted = models.BooleanField(default=False)
    extended_deadline = models.DateField(null=True, blank=True)
    extension_reason = models.TextField(blank=True)
    extension_approved_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    
    # Metadata
    last_checked = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'sar_deadline_trackers'
        verbose_name = 'SAR Deadline Tracker'
        verbose_name_plural = 'SAR Deadline Trackers'
    
    def __str__(self):
        return f"Deadline tracker for SAR {self.sar_report.sar_number}"


class SARStatistics(models.Model):
    """
    Aggregate statistics for SAR reporting (for dashboards)
    """
    # Period
    period_start = models.DateField()
    period_end = models.DateField()
    
    # Counts
    total_sars_created = models.IntegerField(default=0)
    total_sars_filed = models.IntegerField(default=0)
    total_sars_pending = models.IntegerField(default=0)
    total_sars_overdue = models.IntegerField(default=0)
    
    # By Activity Type
    sars_by_activity_type = models.JSONField(default=dict)
    
    # By Status
    sars_by_status = models.JSONField(default=dict)
    
    # Financial
    total_amount_reported = models.DecimalField(
        max_digits=20,
        decimal_places=2,
        default=0
    )
    
    # Performance Metrics
    avg_days_to_file = models.FloatField(default=0)
    avg_days_to_approval = models.FloatField(default=0)
    
    # Metadata
    calculated_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'sar_statistics'
        verbose_name = 'SAR Statistics'
        verbose_name_plural = 'SAR Statistics'
        ordering = ['-period_end']
        unique_together = ['period_start', 'period_end']
    
    def __str__(self):
        return f"SAR Stats: {self.period_start} to {self.period_end}"
