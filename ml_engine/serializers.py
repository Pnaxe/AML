from rest_framework import serializers
from .models import MLModel, RiskScore, ModelPrediction, AnomalyDetection


class MLModelSerializer(serializers.ModelSerializer):
    """Serializer for MLModel"""
    
    class Meta:
        model = MLModel
        fields = [
            'id', 'name', 'model_type', 'version', 'status',
            'description', 'algorithm',
            'accuracy', 'precision', 'recall', 'f1_score', 'auc_roc',
            'training_data_size', 'features_used', 'hyperparameters',
            'model_file_path',
            'trained_at', 'deployed_at', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class RiskScoreSerializer(serializers.ModelSerializer):
    """Serializer for RiskScore"""
    customer_name = serializers.CharField(source='customer.get_full_name', read_only=True)
    customer_id = serializers.CharField(source='customer.customer_id', read_only=True)
    transaction_id = serializers.CharField(source='transaction.transaction_id', read_only=True)
    ml_model_name = serializers.CharField(source='ml_model.name', read_only=True)
    
    class Meta:
        model = RiskScore
        fields = [
            'id', 'entity_type', 'customer', 'customer_id', 'customer_name',
            'transaction', 'transaction_id',
            'risk_score', 'risk_level', 'confidence',
            'ml_model', 'ml_model_name',
            'risk_factors', 'feature_values', 'explanation',
            'calculated_at', 'expires_at'
        ]
        read_only_fields = ['id', 'calculated_at']


class ModelPredictionSerializer(serializers.ModelSerializer):
    """Serializer for ModelPrediction"""
    transaction_id = serializers.CharField(source='transaction.transaction_id', read_only=True)
    ml_model_name = serializers.CharField(source='ml_model.name', read_only=True)
    
    class Meta:
        model = ModelPrediction
        fields = [
            'id', 'ml_model', 'ml_model_name',
            'transaction', 'transaction_id',
            'is_suspicious', 'suspicion_score', 'prediction_class',
            'feature_importance', 'raw_prediction',
            'actual_outcome', 'feedback_provided',
            'predicted_at'
        ]
        read_only_fields = ['id', 'predicted_at']


class AnomalyDetectionSerializer(serializers.ModelSerializer):
    """Serializer for AnomalyDetection"""
    customer_name = serializers.CharField(source='customer.get_full_name', read_only=True)
    customer_id = serializers.CharField(source='customer.customer_id', read_only=True)
    transaction_id = serializers.CharField(source='transaction.transaction_id', read_only=True)
    ml_model_name = serializers.CharField(source='ml_model.name', read_only=True)
    
    class Meta:
        model = AnomalyDetection
        fields = [
            'id', 'transaction', 'transaction_id',
            'customer', 'customer_id', 'customer_name',
            'anomaly_score', 'anomaly_type',
            'detection_method', 'ml_model', 'ml_model_name',
            'baseline_pattern', 'deviation_details',
            'reviewed', 'is_confirmed_anomaly',
            'detected_at', 'reviewed_at'
        ]
        read_only_fields = ['id', 'detected_at']


