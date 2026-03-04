"""
Law Enforcement Integration Module
Secure SAR transmission, case referrals, and evidence sharing with authorities
"""
from django.db import models
from django.contrib.auth import get_user_model
from accounts.models import Customer
from alerts.models import Alert, Investigation
from django.core.validators import URLValidator
from django.utils import timezone

User = get_user_model()


class LawEnforcementAgency(models.Model):
    """
    Law enforcement agencies and regulatory bodies
    """
    AGENCY_TYPE_CHOICES = [
        ('FEDERAL', 'Federal Agency'),
        ('STATE', 'State Agency'),
        ('LOCAL', 'Local Law Enforcement'),
        ('INTERNATIONAL', 'International Organization'),
        ('REGULATORY', 'Regulatory Body'),
        ('FINANCIAL_INTELLIGENCE', 'Financial Intelligence Unit'),
    ]
    
    STATUS_CHOICES = [
        ('ACTIVE', 'Active'),
        ('INACTIVE', 'Inactive'),
        ('SUSPENDED', 'Suspended'),
    ]
    
    # Agency Identification
    agency_code = models.CharField(max_length=50, unique=True, db_index=True)
    name = models.CharField(max_length=300)
    agency_type = models.CharField(max_length=30, choices=AGENCY_TYPE_CHOICES)
    
    # Contact Information
    primary_contact_name = models.CharField(max_length=200, blank=True)
    primary_contact_email = models.EmailField(blank=True)
    primary_contact_phone = models.CharField(max_length=50, blank=True)
    secondary_contact_name = models.CharField(max_length=200, blank=True)
    secondary_contact_email = models.EmailField(blank=True)
    
    # Address
    address_line1 = models.CharField(max_length=300, blank=True)
    address_line2 = models.CharField(max_length=300, blank=True)
    city = models.CharField(max_length=100, blank=True)
    state_province = models.CharField(max_length=100, blank=True)
    postal_code = models.CharField(max_length=20, blank=True)
    country = models.CharField(max_length=100, blank=True)
    
    # Secure Communication Endpoints
    sftp_host = models.CharField(max_length=200, blank=True)
    sftp_port = models.IntegerField(default=22, blank=True)
    sftp_username = models.CharField(max_length=100, blank=True)
    https_endpoint = models.URLField(blank=True, validators=[URLValidator()])
    
    # Security & Encryption
    requires_mutual_tls = models.BooleanField(default=True)
    public_key_certificate = models.TextField(blank=True)  # PEM format
    encryption_required = models.BooleanField(default=True)
    digital_signature_required = models.BooleanField(default=True)
    
    # Capabilities
    accepts_sar_filings = models.BooleanField(default=True)
    accepts_case_referrals = models.BooleanField(default=False)
    accepts_evidence_packages = models.BooleanField(default=False)
    provides_feedback = models.BooleanField(default=False)
    
    # Status & Metadata
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='ACTIVE')
    jurisdiction = models.CharField(max_length=200, blank=True)
    notes = models.TextField(blank=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_contact = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        db_table = 'law_enforcement_agencies'
        verbose_name = 'Law Enforcement Agency'
        verbose_name_plural = 'Law Enforcement Agencies'
        ordering = ['name']
    
    def __str__(self):
        return f"{self.name} ({self.agency_code})"


class SARTransmission(models.Model):
    """
    Suspicious Activity Report transmissions to authorities
    """
    STATUS_CHOICES = [
        ('DRAFT', 'Draft'),
        ('PENDING_APPROVAL', 'Pending Approval'),
        ('APPROVED', 'Approved'),
        ('QUEUED', 'Queued for Transmission'),
        ('TRANSMITTING', 'Transmitting'),
        ('TRANSMITTED', 'Successfully Transmitted'),
        ('ACKNOWLEDGED', 'Acknowledged by Receiver'),
        ('FAILED', 'Transmission Failed'),
        ('REJECTED', 'Rejected by Receiver'),
    ]
    
    PRIORITY_CHOICES = [
        ('ROUTINE', 'Routine'),
        ('PRIORITY', 'Priority'),
        ('URGENT', 'Urgent'),
        ('CRITICAL', 'Critical'),
    ]
    
    # SAR Identification
    sar_id = models.CharField(max_length=100, unique=True, db_index=True)
    internal_reference = models.CharField(max_length=100, blank=True)
    
    # Agency
    agency = models.ForeignKey(
        LawEnforcementAgency,
        on_delete=models.PROTECT,
        related_name='sar_transmissions'
    )
    
    # Related Investigation
    investigation = models.ForeignKey(
        Investigation,
        on_delete=models.PROTECT,
        related_name='sar_transmissions',
        null=True,
        blank=True
    )
    alerts = models.ManyToManyField(Alert, related_name='sar_transmissions')
    
    # Subject Information
    subject_customer = models.ForeignKey(
        Customer,
        on_delete=models.PROTECT,
        related_name='sars'
    )
    related_customers = models.ManyToManyField(
        Customer,
        related_name='related_sars',
        blank=True
    )
    
    # SAR Content
    narrative = models.TextField()  # Investigation narrative
    suspicious_activity_summary = models.TextField()
    
    # Financial Details
    total_suspicious_amount = models.DecimalField(
        max_digits=20,
        decimal_places=2,
        null=True,
        blank=True
    )
    currency = models.CharField(max_length=3, default='USD')
    date_of_activity = models.DateField()
    activity_period_start = models.DateField(null=True, blank=True)
    activity_period_end = models.DateField(null=True, blank=True)
    
    # Filing Information
    filing_institution = models.CharField(max_length=300)
    filing_officer = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='filed_sars'
    )
    approved_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approved_sars'
    )
    
    # Status & Priority
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='DRAFT')
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default='ROUTINE')
    
    # Transmission Details
    transmission_method = models.CharField(max_length=50, blank=True)  # SFTP, HTTPS, Manual
    transmission_attempts = models.IntegerField(default=0)
    last_transmission_attempt = models.DateTimeField(null=True, blank=True)
    transmitted_at = models.DateTimeField(null=True, blank=True)
    acknowledged_at = models.DateTimeField(null=True, blank=True)
    
    # Files & Evidence
    sar_pdf_file = models.FileField(upload_to='sar_reports/', null=True, blank=True)
    sar_xml_file = models.FileField(upload_to='sar_reports/', null=True, blank=True)
    evidence_package = models.ForeignKey(
        'forensics.EvidencePackage',
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    
    # Digital Signature
    is_digitally_signed = models.BooleanField(default=False)
    signature_data = models.TextField(blank=True)
    signature_timestamp = models.DateTimeField(null=True, blank=True)
    
    # Acknowledgment
    acknowledgment_reference = models.CharField(max_length=200, blank=True)
    acknowledgment_data = models.JSONField(default=dict)
    
    # Error Handling
    error_message = models.TextField(blank=True)
    retry_after = models.DateTimeField(null=True, blank=True)
    
    # Deadlines
    filing_deadline = models.DateField(null=True, blank=True)
    is_overdue = models.BooleanField(default=False)
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'sar_transmissions'
        verbose_name = 'SAR Transmission'
        verbose_name_plural = 'SAR Transmissions'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['sar_id']),
            models.Index(fields=['status', 'priority']),
            models.Index(fields=['agency', 'transmitted_at']),
        ]
    
    def __str__(self):
        return f"SAR {self.sar_id} to {self.agency.name}"


class CaseReferral(models.Model):
    """
    Case referrals to law enforcement agencies
    """
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('SUBMITTED', 'Submitted'),
        ('ACKNOWLEDGED', 'Acknowledged'),
        ('UNDER_REVIEW', 'Under Review'),
        ('ACCEPTED', 'Accepted by Agency'),
        ('DECLINED', 'Declined by Agency'),
        ('CLOSED', 'Closed'),
    ]
    
    # Referral Identification
    referral_id = models.CharField(max_length=100, unique=True, db_index=True)
    
    # Agency
    agency = models.ForeignKey(
        LawEnforcementAgency,
        on_delete=models.PROTECT,
        related_name='case_referrals'
    )
    
    # Related Case
    investigation = models.ForeignKey(
        Investigation,
        on_delete=models.PROTECT,
        related_name='referrals'
    )
    alerts = models.ManyToManyField(Alert, related_name='referrals')
    
    # Referral Details
    referral_reason = models.TextField()
    recommended_action = models.TextField(blank=True)
    urgency = models.CharField(max_length=20, default='MEDIUM')
    
    # Status
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='PENDING')
    
    # Personnel
    referred_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='case_referrals_made'
    )
    agency_case_officer = models.CharField(max_length=200, blank=True)
    agency_case_number = models.CharField(max_length=100, blank=True)
    
    # Timing
    submitted_at = models.DateTimeField(null=True, blank=True)
    acknowledged_at = models.DateTimeField(null=True, blank=True)
    response_deadline = models.DateTimeField(null=True, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    
    # Communication
    agency_response = models.TextField(blank=True)
    follow_up_notes = models.TextField(blank=True)
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'case_referrals'
        verbose_name = 'Case Referral'
        verbose_name_plural = 'Case Referrals'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"Referral {self.referral_id} to {self.agency.name}"


class LegalHold(models.Model):
    """
    Legal holds preventing data deletion or modification
    """
    STATUS_CHOICES = [
        ('ACTIVE', 'Active'),
        ('LIFTED', 'Lifted'),
        ('EXPIRED', 'Expired'),
    ]
    
    # Hold Identification
    hold_id = models.CharField(max_length=100, unique=True, db_index=True)
    
    # Legal Authority
    agency = models.ForeignKey(
        LawEnforcementAgency,
        on_delete=models.PROTECT,
        related_name='legal_holds'
    )
    court_order_number = models.CharField(max_length=200, blank=True)
    issuing_authority = models.CharField(max_length=300, blank=True)
    
    # Scope
    investigation = models.ForeignKey(
        Investigation,
        on_delete=models.PROTECT,
        related_name='legal_holds',
        null=True,
        blank=True
    )
    customers = models.ManyToManyField(Customer, related_name='legal_holds')
    
    # Hold Details
    reason = models.TextField()
    scope_description = models.TextField()  # What data is covered
    
    # Status
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='ACTIVE')
    
    # Dates
    effective_date = models.DateTimeField()
    expiry_date = models.DateTimeField(null=True, blank=True)
    lifted_date = models.DateTimeField(null=True, blank=True)
    
    # Personnel
    placed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='legal_holds_placed'
    )
    lifted_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='legal_holds_lifted'
    )
    
    # Documentation
    supporting_documents = models.JSONField(default=list)  # File paths
    lift_reason = models.TextField(blank=True)
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'legal_holds'
        verbose_name = 'Legal Hold'
        verbose_name_plural = 'Legal Holds'
        ordering = ['-effective_date']
        indexes = [
            models.Index(fields=['status', 'effective_date']),
        ]
    
    def __str__(self):
        return f"Legal Hold {self.hold_id} from {self.agency.name}"


class TransmissionLog(models.Model):
    """
    Immutable audit log of all communications with law enforcement
    """
    DIRECTION_CHOICES = [
        ('OUTBOUND', 'Outbound'),
        ('INBOUND', 'Inbound'),
    ]
    
    TRANSMISSION_TYPE_CHOICES = [
        ('SAR', 'SAR Filing'),
        ('CASE_REFERRAL', 'Case Referral'),
        ('EVIDENCE_PACKAGE', 'Evidence Package'),
        ('RESPONSE', 'Agency Response'),
        ('INQUIRY', 'Inquiry'),
        ('UPDATE', 'Update'),
    ]
    
    # Log Entry
    log_id = models.CharField(max_length=100, unique=True, db_index=True)
    direction = models.CharField(max_length=20, choices=DIRECTION_CHOICES)
    transmission_type = models.CharField(max_length=30, choices=TRANSMISSION_TYPE_CHOICES)
    
    # Parties
    agency = models.ForeignKey(
        LawEnforcementAgency,
        on_delete=models.PROTECT,
        related_name='transmission_logs'
    )
    our_user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    
    # Related Objects
    sar_transmission = models.ForeignKey(
        SARTransmission,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='logs'
    )
    case_referral = models.ForeignKey(
        CaseReferral,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='logs'
    )
    
    # Transmission Details
    method = models.CharField(max_length=50)  # SFTP, HTTPS, Email, Manual
    was_encrypted = models.BooleanField(default=False)
    was_signed = models.BooleanField(default=False)
    
    # Content Summary
    content_summary = models.TextField(blank=True)
    file_names = models.JSONField(default=list)
    total_bytes_transferred = models.BigIntegerField(null=True, blank=True)
    
    # Status
    was_successful = models.BooleanField(default=True)
    error_message = models.TextField(blank=True)
    
    # Acknowledgment
    acknowledgment_received = models.BooleanField(default=False)
    acknowledgment_data = models.JSONField(default=dict)
    
    # Immutable Timestamp
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)
    
    class Meta:
        db_table = 'transmission_logs'
        verbose_name = 'Transmission Log'
        verbose_name_plural = 'Transmission Logs'
        ordering = ['-timestamp']
        permissions = [
            ('view_transmission_log', 'Can view transmission logs'),
        ]
    
    def __str__(self):
        return f"{self.direction} {self.transmission_type} - {self.agency.name} at {self.timestamp}"


class IncomingAgencyRequest(models.Model):
    """
    Requests or inquiries from law enforcement agencies
    """
    REQUEST_TYPE_CHOICES = [
        ('INFORMATION_REQUEST', 'Information Request'),
        ('ADDITIONAL_EVIDENCE', 'Request for Additional Evidence'),
        ('CLARIFICATION', 'Clarification Request'),
        ('FOLLOW_UP', 'Follow-up Inquiry'),
        ('SUBPOENA', 'Subpoena'),
        ('COURT_ORDER', 'Court Order'),
    ]
    
    STATUS_CHOICES = [
        ('NEW', 'New'),
        ('UNDER_REVIEW', 'Under Review'),
        ('IN_PROGRESS', 'In Progress'),
        ('PENDING_APPROVAL', 'Pending Approval'),
        ('RESPONDED', 'Responded'),
        ('CLOSED', 'Closed'),
    ]
    
    # Request Identification
    request_id = models.CharField(max_length=100, unique=True, db_index=True)
    agency_reference = models.CharField(max_length=200, blank=True)
    
    # Agency
    agency = models.ForeignKey(
        LawEnforcementAgency,
        on_delete=models.PROTECT,
        related_name='incoming_requests'
    )
    requesting_officer = models.CharField(max_length=200, blank=True)
    
    # Request Details
    request_type = models.CharField(max_length=30, choices=REQUEST_TYPE_CHOICES)
    request_content = models.TextField()
    deadline = models.DateTimeField(null=True, blank=True)
    
    # Related Cases
    related_sar = models.ForeignKey(
        SARTransmission,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='agency_requests'
    )
    related_investigation = models.ForeignKey(
        Investigation,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='agency_requests'
    )
    
    # Status & Assignment
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='NEW')
    assigned_to = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_agency_requests'
    )
    
    # Response
    response_content = models.TextField(blank=True)
    response_sent_at = models.DateTimeField(null=True, blank=True)
    responded_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='responded_agency_requests'
    )
    
    # Metadata
    received_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'incoming_agency_requests'
        verbose_name = 'Incoming Agency Request'
        verbose_name_plural = 'Incoming Agency Requests'
        ordering = ['-received_at']
    
    def __str__(self):
        return f"Request {self.request_id} from {self.agency.name}"
