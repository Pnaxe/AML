from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.contrib.auth.forms import UserCreationForm
from django import forms
from .models import CustomUser, Customer, DeletedCustomer


class CustomUserCreationForm(UserCreationForm):
    """Custom form for creating users with simplified role selection"""
    role = forms.ChoiceField(
        choices=[
            ('BANK', 'Bank User'),
            ('REGULATOR', 'Regulator'),
        ],
        required=True,
        help_text='Select whether this user is a Bank User or Regulator',
        label='User Type'
    )
    
    class Meta:
        model = CustomUser
        fields = ('username', 'email', 'role')
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Set default role if not set
        if not self.initial.get('role'):
            self.initial['role'] = 'BANK'
    
    def save(self, commit=True):
        user = super().save(commit=False)
        user.role = self.cleaned_data['role']
        if commit:
            user.save()
        return user


@admin.register(CustomUser)
class CustomUserAdmin(UserAdmin):
    """Admin interface for CustomUser"""
    list_display = ['username', 'email', 'role', 'department', 'is_staff', 'is_active']
    list_filter = ['role', 'is_staff', 'is_active', 'department']
    search_fields = ['username', 'email', 'first_name', 'last_name']
    
    # Use custom form for add view
    add_form = CustomUserCreationForm
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('username', 'email', 'password1', 'password2', 'role'),
        }),
    )
    
    fieldsets = UserAdmin.fieldsets + (
        ('AML System Info', {
            'fields': ('role', 'department', 'phone_number'),
            'description': 'Role: Select BANK for bank users or REGULATOR for regulatory users'
        }),
    )
    
    def get_form(self, request, obj=None, **kwargs):
        """Use custom form for add view, regular form for change view"""
        defaults = {}
        if obj is None:  # Creating a new user
            defaults['form'] = self.add_form
        defaults.update(kwargs)
        form = super().get_form(request, obj, **defaults)
        # For editing existing users, limit role choices to BANK and REGULATOR
        if obj is not None and 'role' in form.base_fields:
            form.base_fields['role'].choices = [
                ('BANK', 'Bank User'),
                ('REGULATOR', 'Regulator'),
            ]
        return form


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
