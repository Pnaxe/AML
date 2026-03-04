from django.contrib import admin
from .models import MLModel, RiskScore, ModelPrediction, TrainingData, AnomalyDetection


@admin.register(MLModel)
class MLModelAdmin(admin.ModelAdmin):
    """Admin interface for MLModel"""
    list_display = [
        'name', 'version', 'model_type', 'status', 'algorithm',
        'accuracy', 'precision', 'recall', 'deployed_at'
    ]
    list_filter = ['model_type', 'status', 'algorithm']
    search_fields = ['name', 'version', 'description']
    readonly_fields = ['created_at', 'updated_at']
    
    fieldsets = (
        ('Model Information', {
            'fields': ('name', 'model_type', 'version', 'status', 'description', 'algorithm')
        }),
        ('Performance Metrics', {
            'fields': ('accuracy', 'precision', 'recall', 'f1_score', 'auc_roc')
        }),
        ('Training Information', {
            'fields': ('training_data_size', 'features_used', 'hyperparameters')
        }),
        ('Deployment', {
            'fields': ('model_file_path', 'trained_at', 'deployed_at')
        }),
        ('Metadata', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(RiskScore)
class RiskScoreAdmin(admin.ModelAdmin):
    """Admin interface for RiskScore"""
    list_display = [
        'get_entity', 'entity_type', 'risk_score', 'risk_level',
        'confidence', 'ml_model', 'calculated_at'
    ]
    list_filter = ['entity_type', 'risk_level']
    search_fields = ['customer__customer_id', 'transaction__transaction_id']
    readonly_fields = ['calculated_at']
    date_hierarchy = 'calculated_at'
    
    def get_entity(self, obj):
        return obj.customer or obj.transaction
    get_entity.short_description = 'Entity'


@admin.register(ModelPrediction)
class ModelPredictionAdmin(admin.ModelAdmin):
    """Admin interface for ModelPrediction"""
    list_display = [
        'transaction', 'ml_model', 'is_suspicious', 'suspicion_score',
        'actual_outcome', 'feedback_provided', 'predicted_at'
    ]
    list_filter = ['is_suspicious', 'feedback_provided', 'ml_model']
    search_fields = ['transaction__transaction_id']
    readonly_fields = ['predicted_at']
    date_hierarchy = 'predicted_at'


@admin.register(TrainingData)
class TrainingDataAdmin(admin.ModelAdmin):
    """Admin interface for TrainingData"""
    list_display = [
        'transaction', 'is_fraudulent', 'is_suspicious',
        'is_verified', 'used_in_training', 'labeled_at'
    ]
    list_filter = ['is_fraudulent', 'is_suspicious', 'is_verified', 'used_in_training']
    search_fields = ['transaction__transaction_id', 'verified_by']
    readonly_fields = ['labeled_at']


@admin.register(AnomalyDetection)
class AnomalyDetectionAdmin(admin.ModelAdmin):
    """Admin interface for AnomalyDetection"""
    list_display = [
        'customer', 'transaction', 'anomaly_type', 'anomaly_score',
        'detection_method', 'reviewed', 'is_confirmed_anomaly', 'detected_at'
    ]
    list_filter = ['anomaly_type', 'detection_method', 'reviewed', 'is_confirmed_anomaly']
    search_fields = ['customer__customer_id', 'transaction__transaction_id']
    readonly_fields = ['detected_at']
    date_hierarchy = 'detected_at'
