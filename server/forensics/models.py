"""
Forensics Module
Evidence handling, chain of custody, and digital forensics for AML investigations
"""
from django.db import models
from django.contrib.auth import get_user_model
from accounts.models import Customer
from transactions.models import Transaction
from alerts.models import Alert, Investigation
from django.utils import timezone
import hashlib
import os

User = get_user_model()


def evidence_upload_path(instance, filename):
    """Generate secure upload path for evidence files"""
    investigation_id = instance.investigation.id if instance.investigation else 'unassigned'
    timestamp = timezone.now().strftime('%Y%m%d_%H%M%S')
    ext = os.path.splitext(filename)[1]
    return f'evidence/{investigation_id}/{instance.evidence_type}/{timestamp}_{instance.id}{ext}'


class EvidenceType(models.Model):
    """
    Catalog of evidence types
    """
    CATEGORY_CHOICES = [
        ('TRANSACTION_RECORD', 'Transaction Record'),
        ('DOCUMENT', 'Document'),
        ('COMMUNICATION', 'Communication'),
        ('DIGITAL_ARTIFACT', 'Digital Artifact'),
        ('SCREENSHOT', 'Screenshot'),
        ('AUDIO', 'Audio Recording'),
        ('VIDEO', 'Video Recording'),
        ('PHOTOGRAPH', 'Photograph'),
        ('REPORT', 'Report'),
        ('DATABASE_EXPORT', 'Database Export'),
        ('LOG_FILE', 'Log File'),
        ('OTHER', 'Other'),
    ]
    
    name = models.CharField(max_length=200, unique=True)
    category = models.CharField(max_length=30, choices=CATEGORY_CHOICES)
    description = models.TextField(blank=True)
    
    # Retention
    retention_period_years = models.IntegerField(default=7)
    is_critical = models.BooleanField(default=False)  # Cannot be deleted
    
    # Validation
    allowed_file_types = models.JSONField(default=list)  # ['pdf', 'jpg', 'png']
    max_file_size_mb = models.IntegerField(default=100)
    
    # Classification
    confidentiality_level = models.CharField(max_length=50, default='CONFIDENTIAL')
    requires_encryption = models.BooleanField(default=True)
    
    # Metadata
    is_active = models.BooleanField(default=True)
    display_order = models.IntegerField(default=0)
    
    class Meta:
        db_table = 'evidence_types'
        verbose_name = 'Evidence Type'
        verbose_name_plural = 'Evidence Types'
        ordering = ['display_order', 'name']
    
    def __str__(self):
        return f"{self.name} ({self.category})"


class Evidence(models.Model):
    """
    Individual evidence items with full chain of custody
    """
    STATUS_CHOICES = [
        ('COLLECTED', 'Collected'),
        ('VERIFIED', 'Verified'),
        ('ANALYZED', 'Analyzed'),
        ('SEALED', 'Sealed'),
        ('RELEASED', 'Released to Authority'),
        ('ARCHIVED', 'Archived'),
        ('DESTROYED', 'Destroyed'),
    ]
    
    CLASSIFICATION_CHOICES = [
        ('PUBLIC', 'Public'),
        ('INTERNAL', 'Internal'),
        ('CONFIDENTIAL', 'Confidential'),
        ('SECRET', 'Secret'),
        ('TOP_SECRET', 'Top Secret'),
    ]
    
    # Evidence Identification
    evidence_id = models.CharField(max_length=100, unique=True, db_index=True)
    evidence_type = models.ForeignKey(
        EvidenceType,
        on_delete=models.PROTECT
    )
    
    # Related Case
    investigation = models.ForeignKey(
        Investigation,
        on_delete=models.PROTECT,
        related_name='evidence',
        null=True,
        blank=True
    )
    alert = models.ForeignKey(
        Alert,
        on_delete=models.PROTECT,
        related_name='evidence',
        null=True,
        blank=True
    )
    
    # Related Entities
    related_customer = models.ForeignKey(
        Customer,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='related_evidence'
    )
    related_transactions = models.ManyToManyField(
        Transaction,
        related_name='evidence',
        blank=True
    )
    
    # Description
    title = models.CharField(max_length=500)
    description = models.TextField()
    source = models.CharField(max_length=300, blank=True)  # Where evidence came from
    collection_method = models.CharField(max_length=200, blank=True)
    
    # File Storage
    evidence_file = models.FileField(
        upload_to=evidence_upload_path,
        null=True,
        blank=True
    )
    file_size_bytes = models.BigIntegerField(null=True, blank=True)
    file_type = models.CharField(max_length=50, blank=True)
    
    # Integrity & Security
    file_hash_sha256 = models.CharField(max_length=64, blank=True, db_index=True)
    file_hash_md5 = models.CharField(max_length=32, blank=True)
    is_encrypted = models.BooleanField(default=False)
    encryption_method = models.CharField(max_length=100, blank=True)
    
    # Digital Signature
    is_digitally_signed = models.BooleanField(default=False)
    signature_data = models.TextField(blank=True)
    signed_by = models.CharField(max_length=200, blank=True)
    signature_timestamp = models.DateTimeField(null=True, blank=True)
    
    # Status & Classification
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='COLLECTED')
    classification = models.CharField(
        max_length=20,
        choices=CLASSIFICATION_CHOICES,
        default='CONFIDENTIAL'
    )
    
    # Collection Information
    collected_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='collected_evidence'
    )
    collected_at = models.DateTimeField()
    collection_location = models.CharField(max_length=300, blank=True)
    
    # Verification
    verified_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='verified_evidence'
    )
    verified_at = models.DateTimeField(null=True, blank=True)
    verification_notes = models.TextField(blank=True)
    
    # Legal Hold
    is_under_legal_hold = models.BooleanField(default=False)
    legal_hold_reference = models.CharField(max_length=200, blank=True)
    legal_hold_date = models.DateTimeField(null=True, blank=True)
    
    # Retention & Disposal
    retention_until = models.DateField(null=True, blank=True)
    disposal_approved_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approved_evidence_disposal'
    )
    disposed_at = models.DateTimeField(null=True, blank=True)
    disposal_method = models.CharField(max_length=200, blank=True)
    disposal_certificate = models.TextField(blank=True)
    
    # Additional Metadata
    tags = models.JSONField(default=list)  # Searchable tags
    metadata = models.JSONField(default=dict)  # Flexible metadata
    notes = models.TextField(blank=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'evidence'
        verbose_name = 'Evidence'
        verbose_name_plural = 'Evidence'
        ordering = ['-collected_at']
        indexes = [
            models.Index(fields=['evidence_id']),
            models.Index(fields=['investigation', 'status']),
            models.Index(fields=['file_hash_sha256']),
            models.Index(fields=['is_under_legal_hold']),
        ]
    
    def __str__(self):
        return f"{self.evidence_id}: {self.title}"
    
    def save(self, *args, **kwargs):
        """Calculate file hashes on save"""
        if self.evidence_file and not self.file_hash_sha256:
            self.evidence_file.seek(0)
            
            # SHA-256
            sha256_hash = hashlib.sha256()
            # MD5
            md5_hash = hashlib.md5()
            
            for chunk in self.evidence_file.chunks():
                sha256_hash.update(chunk)
                md5_hash.update(chunk)
            
            self.file_hash_sha256 = sha256_hash.hexdigest()
            self.file_hash_md5 = md5_hash.hexdigest()
            self.evidence_file.seek(0)
            
            # Store file size
            self.file_size_bytes = self.evidence_file.size
        
        super().save(*args, **kwargs)


class ChainOfCustody(models.Model):
    """
    Immutable chain of custody records for evidence
    """
    ACTION_CHOICES = [
        ('COLLECTED', 'Evidence Collected'),
        ('TRANSFERRED', 'Custody Transferred'),
        ('ACCESSED', 'Evidence Accessed'),
        ('ANALYZED', 'Evidence Analyzed'),
        ('COPIED', 'Evidence Copied'),
        ('SEALED', 'Evidence Sealed'),
        ('UNSEALED', 'Evidence Unsealed'),
        ('RELEASED', 'Released to External Party'),
        ('RETURNED', 'Returned from External Party'),
        ('ARCHIVED', 'Archived'),
        ('DISPOSED', 'Disposed'),
    ]
    
    evidence = models.ForeignKey(
        Evidence,
        on_delete=models.PROTECT,
        related_name='chain_of_custody'
    )
    
    # Action Details
    action = models.CharField(max_length=20, choices=ACTION_CHOICES)
    description = models.TextField()
    
    # Personnel
    action_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='custody_actions'
    )
    transferred_from = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='custody_transfers_from'
    )
    transferred_to = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='custody_transfers_to'
    )
    
    # External Party (if released to law enforcement)
    external_party_name = models.CharField(max_length=300, blank=True)
    external_party_badge = models.CharField(max_length=100, blank=True)
    external_party_agency = models.CharField(max_length=300, blank=True)
    
    # Location
    location = models.CharField(max_length=300, blank=True)
    
    # Reason & Purpose
    reason = models.TextField(blank=True)
    purpose = models.CharField(max_length=300, blank=True)
    
    # Integrity Verification
    integrity_verified = models.BooleanField(default=True)
    hash_verification_passed = models.BooleanField(default=True)
    verification_notes = models.TextField(blank=True)
    
    # Signature
    signature = models.CharField(max_length=500, blank=True)  # Digital signature
    witness = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='witnessed_custody_actions'
    )
    
    # Immutable Timestamp
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)
    
    class Meta:
        db_table = 'chain_of_custody'
        verbose_name = 'Chain of Custody Record'
        verbose_name_plural = 'Chain of Custody Records'
        ordering = ['evidence', 'timestamp']
        permissions = [
            ('view_chain_of_custody', 'Can view chain of custody'),
        ]
    
    def __str__(self):
        return f"{self.action} - {self.evidence.evidence_id} at {self.timestamp}"


class EvidencePackage(models.Model):
    """
    Compiled evidence packages for transmission to authorities
    """
    STATUS_CHOICES = [
        ('DRAFT', 'Draft'),
        ('COMPILING', 'Compiling'),
        ('REVIEW', 'Under Review'),
        ('APPROVED', 'Approved'),
        ('SEALED', 'Sealed'),
        ('TRANSMITTED', 'Transmitted'),
        ('ARCHIVED', 'Archived'),
    ]
    
    # Package Identification
    package_id = models.CharField(max_length=100, unique=True, db_index=True)
    package_name = models.CharField(max_length=300)
    
    # Related Investigation
    investigation = models.ForeignKey(
        Investigation,
        on_delete=models.PROTECT,
        related_name='evidence_packages'
    )
    
    # Evidence Items
    evidence_items = models.ManyToManyField(
        Evidence,
        related_name='packages'
    )
    
    # Package Details
    description = models.TextField()
    purpose = models.TextField()  # Why package is being created
    
    # Recipient
    recipient_agency = models.CharField(max_length=300)
    recipient_officer = models.CharField(max_length=200, blank=True)
    
    # Status
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='DRAFT')
    
    # Personnel
    compiled_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='compiled_packages'
    )
    reviewed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviewed_packages'
    )
    approved_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approved_packages'
    )
    
    # Package File
    package_file = models.FileField(
        upload_to='evidence_packages/',
        null=True,
        blank=True
    )
    package_file_hash = models.CharField(max_length=64, blank=True)
    
    # Encryption & Signature
    is_encrypted = models.BooleanField(default=True)
    encryption_method = models.CharField(max_length=100, blank=True)
    is_digitally_signed = models.BooleanField(default=True)
    signature_data = models.TextField(blank=True)
    
    # Transmission
    transmitted_at = models.DateTimeField(null=True, blank=True)
    transmission_method = models.CharField(max_length=100, blank=True)
    transmission_reference = models.CharField(max_length=200, blank=True)
    acknowledgment_received = models.BooleanField(default=False)
    acknowledgment_data = models.JSONField(default=dict)
    
    # Metadata
    total_items = models.IntegerField(default=0)
    total_size_bytes = models.BigIntegerField(default=0)
    manifest = models.JSONField(default=list)  # List of evidence IDs with hashes
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    compiled_at = models.DateTimeField(null=True, blank=True)
    sealed_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'evidence_packages'
        verbose_name = 'Evidence Package'
        verbose_name_plural = 'Evidence Packages'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.package_id}: {self.package_name}"


class EvidenceAccess(models.Model):
    """
    Access log for evidence items - who accessed what and when
    """
    ACCESS_TYPE_CHOICES = [
        ('VIEW', 'Viewed'),
        ('DOWNLOAD', 'Downloaded'),
        ('COPY', 'Copied'),
        ('MODIFY', 'Modified'),
        ('PRINT', 'Printed'),
        ('SHARE', 'Shared'),
    ]
    
    evidence = models.ForeignKey(
        Evidence,
        on_delete=models.PROTECT,
        related_name='access_logs'
    )
    
    # Access Details
    access_type = models.CharField(max_length=20, choices=ACCESS_TYPE_CHOICES)
    user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True
    )
    
    # Context
    reason = models.TextField(blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=500, blank=True)
    
    # Access Method
    access_method = models.CharField(max_length=100, blank=True)  # Web, API, Export, etc.
    session_id = models.CharField(max_length=200, blank=True)
    
    # Authorization
    was_authorized = models.BooleanField(default=True)
    authorization_level = models.CharField(max_length=100, blank=True)
    
    # Immutable Timestamp
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)
    
    class Meta:
        db_table = 'evidence_access_logs'
        verbose_name = 'Evidence Access Log'
        verbose_name_plural = 'Evidence Access Logs'
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['evidence', 'timestamp']),
            models.Index(fields=['user', 'access_type']),
        ]
        permissions = [
            ('view_evidence_access', 'Can view evidence access logs'),
        ]
    
    def __str__(self):
        return f"{self.user} {self.access_type} {self.evidence.evidence_id} at {self.timestamp}"


class EvidenceChecksum(models.Model):
    """
    Periodic checksum verification for evidence integrity
    """
    evidence = models.ForeignKey(
        Evidence,
        on_delete=models.PROTECT,
        related_name='checksum_verifications'
    )
    
    # Verification
    sha256_hash = models.CharField(max_length=64)
    md5_hash = models.CharField(max_length=32)
    verification_passed = models.BooleanField()
    
    # Details
    verified_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True
    )
    verification_method = models.CharField(max_length=100, blank=True)
    
    # Results
    discrepancy_found = models.BooleanField(default=False)
    discrepancy_details = models.TextField(blank=True)
    
    # Action Taken
    action_taken = models.TextField(blank=True)
    
    # Immutable Timestamp
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)
    
    class Meta:
        db_table = 'evidence_checksums'
        verbose_name = 'Evidence Checksum Verification'
        verbose_name_plural = 'Evidence Checksum Verifications'
        ordering = ['-timestamp']
    
    def __str__(self):
        status = "PASSED" if self.verification_passed else "FAILED"
        return f"Checksum {status} for {self.evidence.evidence_id} at {self.timestamp}"
