from django.db import models
from django.contrib.auth.models import AbstractUser
from django.core.validators import RegexValidator


class CustomUser(AbstractUser):
    """Extended user model for AML system users (compliance officers, analysts, etc.)"""
    ROLE_CHOICES = [
        ('ADMIN', 'Administrator'),
        ('ANALYST', 'Compliance Analyst'),
        ('INVESTIGATOR', 'Investigator'),
        ('VIEWER', 'Viewer'),
    ]
    
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='VIEWER')
    department = models.CharField(max_length=100, blank=True)
    phone_number = models.CharField(max_length=20, blank=True)
    
    class Meta:
        db_table = 'users'
        verbose_name = 'User'
        verbose_name_plural = 'Users'


class Customer(models.Model):
    """Customer/Entity being monitored for AML compliance"""
    CUSTOMER_TYPE_CHOICES = [
        ('INDIVIDUAL', 'Individual'),
        ('CORPORATE', 'Corporate'),
        ('GOVERNMENT', 'Government Entity'),
        ('NON_PROFIT', 'Non-Profit Organization'),
    ]
    
    RISK_LEVEL_CHOICES = [
        ('LOW', 'Low Risk'),
        ('MEDIUM', 'Medium Risk'),
        ('HIGH', 'High Risk'),
        ('CRITICAL', 'Critical Risk'),
    ]
    
    # Basic Information
    customer_id = models.CharField(max_length=50, unique=True, db_index=True)
    customer_type = models.CharField(max_length=20, choices=CUSTOMER_TYPE_CHOICES)
    
    # Individual Information
    first_name = models.CharField(max_length=100, blank=True)
    last_name = models.CharField(max_length=100, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    
    # Corporate Information
    company_name = models.CharField(max_length=200, blank=True)
    registration_number = models.CharField(max_length=100, blank=True)
    
    # Contact Information
    email = models.EmailField(blank=True)
    phone_number = models.CharField(max_length=20, blank=True)
    address = models.TextField(blank=True)
    city = models.CharField(max_length=100, blank=True)
    country = models.CharField(max_length=100, blank=True)
    postal_code = models.CharField(max_length=20, blank=True)
    
    # Risk Assessment
    risk_level = models.CharField(max_length=20, choices=RISK_LEVEL_CHOICES, default='LOW')
    risk_score = models.FloatField(default=0.0)
    
    # PEP (Politically Exposed Person) Flag
    is_pep = models.BooleanField(default=False)
    pep_details = models.TextField(blank=True)
    
    # Sanctions and Watchlists
    is_sanctioned = models.BooleanField(default=False)
    sanction_details = models.TextField(blank=True)
    
    # KYC (Know Your Customer) Information
    kyc_verified = models.BooleanField(default=False)
    kyc_verification_date = models.DateTimeField(null=True, blank=True)
    kyc_document_type = models.CharField(max_length=100, blank=True)
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True)
    
    # Relationship Manager
    assigned_analyst = models.ForeignKey(
        CustomUser, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='assigned_customers'
    )
    
    class Meta:
        db_table = 'customers'
        verbose_name = 'Customer'
        verbose_name_plural = 'Customers'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['customer_id']),
            models.Index(fields=['risk_level']),
            models.Index(fields=['country']),
            models.Index(fields=['is_pep']),
            models.Index(fields=['is_sanctioned']),
        ]
    
    def __str__(self):
        if self.customer_type == 'INDIVIDUAL':
            return f"{self.first_name} {self.last_name} ({self.customer_id})"
        return f"{self.company_name} ({self.customer_id})"
    
    def get_full_name(self):
        """Return full name for individual or company name"""
        if self.customer_type == 'INDIVIDUAL':
            return f"{self.first_name} {self.last_name}".strip()
        return self.company_name


class DeletedCustomer(models.Model):
    """Archive table for soft-deleted customers"""
    # Copy all fields from Customer
    customer_id = models.CharField(max_length=50, db_index=True)
    customer_type = models.CharField(max_length=20)
    
    # Individual Information
    first_name = models.CharField(max_length=100, blank=True)
    last_name = models.CharField(max_length=100, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    
    # Corporate Information
    company_name = models.CharField(max_length=200, blank=True)
    registration_number = models.CharField(max_length=100, blank=True)
    
    # Contact Information
    email = models.EmailField(blank=True)
    phone_number = models.CharField(max_length=20, blank=True)
    address = models.TextField(blank=True)
    city = models.CharField(max_length=100, blank=True)
    country = models.CharField(max_length=100, blank=True)
    postal_code = models.CharField(max_length=20, blank=True)
    
    # Risk Assessment
    risk_level = models.CharField(max_length=20, default='LOW')
    risk_score = models.FloatField(default=0.0)
    
    # PEP and Sanctions
    is_pep = models.BooleanField(default=False)
    pep_details = models.TextField(blank=True)
    is_sanctioned = models.BooleanField(default=False)
    sanction_details = models.TextField(blank=True)
    
    # KYC Information
    kyc_verified = models.BooleanField(default=False)
    kyc_verification_date = models.DateTimeField(null=True, blank=True)
    kyc_document_type = models.CharField(max_length=100, blank=True)
    
    # Metadata
    original_id = models.IntegerField()  # Reference to original customer ID
    deleted_at = models.DateTimeField(auto_now_add=True)
    deleted_by = models.ForeignKey(
        CustomUser,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='deleted_customers'
    )
    
    class Meta:
        db_table = 'deleted_customers'
        verbose_name = 'Deleted Customer'
        verbose_name_plural = 'Deleted Customers'
        ordering = ['-deleted_at']
        indexes = [
            models.Index(fields=['customer_id']),
            models.Index(fields=['deleted_at']),
        ]
    
    def __str__(self):
        if self.customer_type == 'INDIVIDUAL':
            return f"{self.first_name} {self.last_name} ({self.customer_id}) - Deleted"
        return f"{self.company_name} ({self.customer_id}) - Deleted"