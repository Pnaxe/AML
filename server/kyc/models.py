"""
Enhanced KYC (Know Your Customer) Module
Identity verification, document management, and due diligence workflows
"""
from django.db import models
from django.contrib.auth import get_user_model
from accounts.models import Customer
from django.core.validators import FileExtensionValidator
from django.utils import timezone
import hashlib
import os

User = get_user_model()


class KYCProfile(models.Model):
    """
    Main KYC profile for each customer
    Extends Customer with detailed KYC information
    """
    RISK_LEVEL_CHOICES = [
        ('LOW', 'Low Risk'),
        ('MEDIUM', 'Medium Risk'),
        ('HIGH', 'High Risk'),
        ('CRITICAL', 'Critical Risk'),
    ]
    
    VERIFICATION_STATUS_CHOICES = [
        ('PENDING', 'Pending Verification'),
        ('IN_PROGRESS', 'In Progress'),
        ('VERIFIED', 'Verified'),
        ('REJECTED', 'Rejected'),
        ('EXPIRED', 'Expired'),
        ('REQUIRES_UPDATE', 'Requires Update'),
    ]
    
    DUE_DILIGENCE_LEVEL_CHOICES = [
        ('SIMPLIFIED', 'Simplified Due Diligence'),
        ('STANDARD', 'Standard Due Diligence'),
        ('ENHANCED', 'Enhanced Due Diligence'),
        ('SPECIAL', 'Special Due Diligence'),
    ]
    
    customer = models.OneToOneField(
        Customer,
        on_delete=models.CASCADE,
        related_name='kyc_profile'
    )
    
    # Verification Status
    verification_status = models.CharField(
        max_length=20,
        choices=VERIFICATION_STATUS_CHOICES,
        default='PENDING'
    )
    kyc_risk_level = models.CharField(
        max_length=20,
        choices=RISK_LEVEL_CHOICES,
        default='MEDIUM'
    )
    due_diligence_level = models.CharField(
        max_length=20,
        choices=DUE_DILIGENCE_LEVEL_CHOICES,
        default='STANDARD'
    )
    
    # Source of Funds/Wealth
    source_of_funds = models.TextField(blank=True)
    source_of_wealth = models.TextField(blank=True)
    expected_transaction_volume = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        null=True,
        blank=True
    )
    expected_transaction_frequency = models.CharField(max_length=100, blank=True)
    
    # Beneficial Ownership
    beneficial_owners = models.JSONField(default=list)
    # [{name, dob, nationality, ownership_percentage, pep_status}]
    
    # Business Information (for corporate customers)
    nature_of_business = models.TextField(blank=True)
    business_sector = models.CharField(max_length=200, blank=True)
    annual_revenue = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        null=True,
        blank=True
    )
    number_of_employees = models.IntegerField(null=True, blank=True)
    
    # Verification Dates
    verification_date = models.DateTimeField(null=True, blank=True)
    verification_expiry = models.DateTimeField(null=True, blank=True)
    last_review_date = models.DateTimeField(null=True, blank=True)
    next_review_date = models.DateTimeField(null=True, blank=True)
    
    # Assigned Staff
    assigned_officer = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_kyc_profiles'
    )
    verified_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='verified_kyc_profiles'
    )
    
    # Rejection/Issue Tracking
    rejection_reason = models.TextField(blank=True)
    verification_notes = models.TextField(blank=True)
    
    # Enhanced Due Diligence Flags
    requires_edd = models.BooleanField(default=False)
    edd_reason = models.TextField(blank=True)
    edd_completed = models.BooleanField(default=False)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'kyc_profiles'
        verbose_name = 'KYC Profile'
        verbose_name_plural = 'KYC Profiles'
        indexes = [
            models.Index(fields=['verification_status']),
            models.Index(fields=['kyc_risk_level']),
            models.Index(fields=['verification_expiry']),
        ]
    
    def __str__(self):
        return f"KYC Profile: {self.customer}"


class DocumentType(models.Model):
    """
    Configurable document types required for KYC
    """
    CATEGORY_CHOICES = [
        ('IDENTITY', 'Identity Proof'),
        ('ADDRESS', 'Address Proof'),
        ('BUSINESS', 'Business Registration'),
        ('FINANCIAL', 'Financial Statement'),
        ('AUTHORIZATION', 'Authorization Document'),
        ('OTHER', 'Other'),
    ]
    
    name = models.CharField(max_length=200, unique=True)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
    description = models.TextField(blank=True)
    
    # Requirements
    is_mandatory = models.BooleanField(default=False)
    required_for_customer_types = models.JSONField(default=list)  # ['INDIVIDUAL', 'CORPORATE']
    required_for_risk_levels = models.JSONField(default=list)  # ['HIGH', 'CRITICAL']
    
    # Validation Rules
    allowed_formats = models.JSONField(default=list)  # ['PDF', 'JPG', 'PNG']
    max_file_size_mb = models.IntegerField(default=10)
    requires_certification = models.BooleanField(default=False)
    
    # Expiry
    has_expiry = models.BooleanField(default=False)
    validity_period_days = models.IntegerField(null=True, blank=True)
    
    # Metadata
    is_active = models.BooleanField(default=True)
    display_order = models.IntegerField(default=0)
    
    class Meta:
        db_table = 'document_types'
        verbose_name = 'Document Type'
        verbose_name_plural = 'Document Types'
        ordering = ['display_order', 'name']
    
    def __str__(self):
        return f"{self.name} ({self.category})"


def document_upload_path(instance, filename):
    """Generate secure upload path for KYC documents"""
    customer_id = instance.kyc_profile.customer.customer_id
    timestamp = timezone.now().strftime('%Y%m%d_%H%M%S')
    ext = os.path.splitext(filename)[1]
    return f'kyc_documents/{customer_id}/{instance.document_type.name}/{timestamp}{ext}'


class KYCDocument(models.Model):
    """
    Individual KYC documents uploaded by or for customers
    """
    STATUS_CHOICES = [
        ('UPLOADED', 'Uploaded'),
        ('PENDING_REVIEW', 'Pending Review'),
        ('UNDER_REVIEW', 'Under Review'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
        ('EXPIRED', 'Expired'),
    ]
    
    kyc_profile = models.ForeignKey(
        KYCProfile,
        on_delete=models.CASCADE,
        related_name='documents'
    )
    document_type = models.ForeignKey(
        DocumentType,
        on_delete=models.PROTECT
    )
    
    # Document File
    document_file = models.FileField(
        upload_to=document_upload_path,
        validators=[FileExtensionValidator(
            allowed_extensions=['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx']
        )]
    )
    file_size_bytes = models.BigIntegerField(null=True, blank=True)
    file_hash = models.CharField(max_length=64, blank=True, db_index=True)  # SHA-256
    
    # Document Details
    document_number = models.CharField(max_length=200, blank=True)
    issuing_authority = models.CharField(max_length=200, blank=True)
    issue_date = models.DateField(null=True, blank=True)
    expiry_date = models.DateField(null=True, blank=True)
    issuing_country = models.CharField(max_length=100, blank=True)
    
    # Status & Review
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='UPLOADED')
    reviewed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviewed_documents'
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    review_notes = models.TextField(blank=True)
    rejection_reason = models.TextField(blank=True)
    
    # OCR & Extraction
    ocr_performed = models.BooleanField(default=False)
    extracted_data = models.JSONField(default=dict)
    ocr_confidence = models.FloatField(null=True, blank=True)
    
    # Third-Party Verification
    third_party_verified = models.BooleanField(default=False)
    verification_provider = models.CharField(max_length=200, blank=True)
    verification_reference = models.CharField(max_length=200, blank=True)
    verification_result = models.JSONField(default=dict)
    
    # Certification
    is_certified_copy = models.BooleanField(default=False)
    certified_by = models.CharField(max_length=200, blank=True)
    certification_date = models.DateField(null=True, blank=True)
    
    # Metadata
    uploaded_at = models.DateTimeField(auto_now_add=True)
    uploaded_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='uploaded_documents'
    )
    version = models.IntegerField(default=1)  # Track document versions
    replaces_document = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='replaced_by'
    )
    
    class Meta:
        db_table = 'kyc_documents'
        verbose_name = 'KYC Document'
        verbose_name_plural = 'KYC Documents'
        ordering = ['-uploaded_at']
        indexes = [
            models.Index(fields=['kyc_profile', 'document_type']),
            models.Index(fields=['status']),
            models.Index(fields=['file_hash']),
        ]
    
    def __str__(self):
        return f"{self.document_type.name} for {self.kyc_profile.customer}"
    
    def save(self, *args, **kwargs):
        """Calculate file hash on save"""
        if self.document_file and not self.file_hash:
            self.document_file.seek(0)
            file_hash = hashlib.sha256()
            for chunk in self.document_file.chunks():
                file_hash.update(chunk)
            self.file_hash = file_hash.hexdigest()
            self.document_file.seek(0)
            
            # Store file size
            self.file_size_bytes = self.document_file.size
        
        super().save(*args, **kwargs)


class KYCVerificationStep(models.Model):
    """
    Individual steps in the KYC verification workflow
    """
    STEP_TYPE_CHOICES = [
        ('DOCUMENT_UPLOAD', 'Document Upload'),
        ('DOCUMENT_REVIEW', 'Document Review'),
        ('IDENTITY_VERIFICATION', 'Identity Verification'),
        ('ADDRESS_VERIFICATION', 'Address Verification'),
        ('SOURCE_OF_FUNDS', 'Source of Funds Verification'),
        ('BENEFICIAL_OWNER', 'Beneficial Ownership Check'),
        ('SANCTIONS_SCREEN', 'Sanctions Screening'),
        ('ADVERSE_MEDIA', 'Adverse Media Check'),
        ('FINAL_APPROVAL', 'Final Approval'),
        ('CUSTOM', 'Custom Step'),
    ]
    
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('IN_PROGRESS', 'In Progress'),
        ('COMPLETED', 'Completed'),
        ('FAILED', 'Failed'),
        ('SKIPPED', 'Skipped'),
    ]
    
    kyc_profile = models.ForeignKey(
        KYCProfile,
        on_delete=models.CASCADE,
        related_name='verification_steps'
    )
    
    step_type = models.CharField(max_length=30, choices=STEP_TYPE_CHOICES)
    step_order = models.IntegerField()
    
    # Status
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    is_mandatory = models.BooleanField(default=True)
    
    # Assignment
    assigned_to = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_kyc_steps'
    )
    completed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='completed_kyc_steps'
    )
    
    # Details
    description = models.TextField(blank=True)
    outcome = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    
    # Timing
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    due_date = models.DateTimeField(null=True, blank=True)
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'kyc_verification_steps'
        verbose_name = 'KYC Verification Step'
        verbose_name_plural = 'KYC Verification Steps'
        ordering = ['kyc_profile', 'step_order']
        unique_together = ['kyc_profile', 'step_order']
    
    def __str__(self):
        return f"{self.step_type} for {self.kyc_profile} (Order: {self.step_order})"


class KYCAPIIntegration(models.Model):
    """
    Third-party KYC API integrations
    """
    PROVIDER_CHOICES = [
        ('JUMIO', 'Jumio'),
        ('ONFIDO', 'Onfido'),
        ('TRULIOO', 'Trulioo'),
        ('IDOLOGY', 'IDology'),
        ('SHUFTI_PRO', 'Shufti Pro'),
        ('CUSTOM', 'Custom Provider'),
    ]
    
    STATUS_CHOICES = [
        ('ACTIVE', 'Active'),
        ('INACTIVE', 'Inactive'),
        ('TESTING', 'Testing'),
        ('ERROR', 'Error'),
    ]
    
    name = models.CharField(max_length=200, unique=True)
    provider = models.CharField(max_length=20, choices=PROVIDER_CHOICES)
    description = models.TextField(blank=True)
    
    # API Configuration
    api_endpoint = models.URLField()
    api_key = models.CharField(max_length=500, blank=True)  # Encrypted in production
    api_secret = models.CharField(max_length=500, blank=True)  # Encrypted
    
    # Configuration
    is_enabled = models.BooleanField(default=False)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='INACTIVE')
    timeout_seconds = models.IntegerField(default=30)
    
    # Usage Tracking
    total_requests = models.IntegerField(default=0)
    successful_requests = models.IntegerField(default=0)
    failed_requests = models.IntegerField(default=0)
    last_used = models.DateTimeField(null=True, blank=True)
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'kyc_api_integrations'
        verbose_name = 'KYC API Integration'
        verbose_name_plural = 'KYC API Integrations'
    
    def __str__(self):
        return f"{self.name} ({self.provider})"


class KYCAuditLog(models.Model):
    """
    Immutable audit trail for all KYC activities
    """
    ACTION_CHOICES = [
        ('PROFILE_CREATED', 'Profile Created'),
        ('DOCUMENT_UPLOADED', 'Document Uploaded'),
        ('DOCUMENT_APPROVED', 'Document Approved'),
        ('DOCUMENT_REJECTED', 'Document Rejected'),
        ('VERIFICATION_STARTED', 'Verification Started'),
        ('VERIFICATION_COMPLETED', 'Verification Completed'),
        ('PROFILE_UPDATED', 'Profile Updated'),
        ('RISK_LEVEL_CHANGED', 'Risk Level Changed'),
        ('EXPIRY_EXTENDED', 'Expiry Extended'),
        ('API_CALL', 'API Call Made'),
    ]
    
    kyc_profile = models.ForeignKey(
        KYCProfile,
        on_delete=models.SET_NULL,
        null=True,
        related_name='audit_logs'
    )
    
    action = models.CharField(max_length=30, choices=ACTION_CHOICES)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    
    # Details
    description = models.TextField(blank=True)
    changes = models.JSONField(default=dict)  # Before/after values
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    
    # Related Objects
    document = models.ForeignKey(
        KYCDocument,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    
    # Immutable timestamp
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)
    
    class Meta:
        db_table = 'kyc_audit_logs'
        verbose_name = 'KYC Audit Log'
        verbose_name_plural = 'KYC Audit Logs'
        ordering = ['-timestamp']
        permissions = [
            ('view_kyc_audit', 'Can view KYC audit logs'),
        ]
    
    def __str__(self):
        return f"{self.action} on {self.kyc_profile} at {self.timestamp}"
