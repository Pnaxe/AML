from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import CustomUser, Customer, DeletedCustomer


@admin.register(CustomUser)
class CustomUserAdmin(UserAdmin):
    """Admin interface for CustomUser"""
    list_display = ['username', 'email', 'role', 'department', 'is_staff', 'is_active']
    list_filter = ['role', 'is_staff', 'is_active', 'department']
    search_fields = ['username', 'email', 'first_name', 'last_name']
    
    fieldsets = UserAdmin.fieldsets + (
        ('AML System Info', {'fields': ('role', 'department', 'phone_number')}),
    )


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    """Admin interface for Customer"""
    list_display = [
        'customer_id', 'get_full_name', 'customer_type', 
        'risk_level', 'is_pep', 'is_sanctioned', 'kyc_verified', 'is_active'
    ]
    list_filter = ['customer_type', 'risk_level', 'is_pep', 'is_sanctioned', 'kyc_verified', 'country']
    search_fields = ['customer_id', 'first_name', 'last_name', 'company_name', 'email']
    readonly_fields = ['created_at', 'updated_at']
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('customer_id', 'customer_type', 'is_active')
        }),
        ('Individual Information', {
            'fields': ('first_name', 'last_name', 'date_of_birth'),
            'classes': ('collapse',)
        }),
        ('Corporate Information', {
            'fields': ('company_name', 'registration_number'),
            'classes': ('collapse',)
        }),
        ('Contact Information', {
            'fields': ('email', 'phone_number', 'address', 'city', 'country', 'postal_code')
        }),
        ('Risk Assessment', {
            'fields': ('risk_level', 'risk_score', 'is_pep', 'pep_details', 'is_sanctioned', 'sanction_details')
        }),
        ('KYC Information', {
            'fields': ('kyc_verified', 'kyc_verification_date', 'kyc_document_type')
        }),
        ('Management', {
            'fields': ('assigned_analyst',)
        }),
        ('Metadata', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(DeletedCustomer)
class DeletedCustomerAdmin(admin.ModelAdmin):
    """Admin interface for DeletedCustomer (soft-deleted customers)"""
    list_display = [
        'customer_id', 'get_full_name', 'customer_type', 
        'risk_level', 'deleted_at', 'deleted_by'
    ]
    list_filter = ['customer_type', 'risk_level', 'deleted_at']
    search_fields = ['customer_id', 'first_name', 'last_name', 'company_name', 'email']
    readonly_fields = ['deleted_at', 'original_id']
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('customer_id', 'customer_type', 'original_id')
        }),
        ('Individual Information', {
            'fields': ('first_name', 'last_name', 'date_of_birth'),
            'classes': ('collapse',)
        }),
        ('Corporate Information', {
            'fields': ('company_name', 'registration_number'),
            'classes': ('collapse',)
        }),
        ('Contact Information', {
            'fields': ('email', 'phone_number', 'address', 'city', 'country', 'postal_code')
        }),
        ('Risk Assessment', {
            'fields': ('risk_level', 'risk_score', 'is_pep', 'pep_details', 'is_sanctioned', 'sanction_details')
        }),
        ('KYC Information', {
            'fields': ('kyc_verified', 'kyc_verification_date', 'kyc_document_type')
        }),
        ('Deletion Information', {
            'fields': ('deleted_at', 'deleted_by')
        }),
    )
    
    def get_full_name(self, obj):
        """Return full name for individual or company name"""
        if obj.customer_type == 'INDIVIDUAL':
            return f"{obj.first_name} {obj.last_name}".strip()
        return obj.company_name
    get_full_name.short_description = 'Name'
