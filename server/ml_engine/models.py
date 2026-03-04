from django.db import models
from accounts.models import Customer
from transactions.models import Transaction


class MLModel(models.Model):
    """ML Model version tracking and management"""
    MODEL_TYPE_CHOICES = [
        ('TRANSACTION_RISK', 'Transaction Risk Scoring'),
        ('CUSTOMER_RISK', 'Customer Risk Profiling'),
        ('ANOMALY_DETECTION', 'Anomaly Detection'),
        ('PATTERN_RECOGNITION', 'Pattern Recognition'),
        ('NETWORK_ANALYSIS', 'Network Analysis'),
    ]
    
    STATUS_CHOICES = [
        ('TRAINING', 'Training'),
        ('TESTING', 'Testing'),
        ('ACTIVE', 'Active'),
        ('ARCHIVED', 'Archived'),
    ]
    
    name = models.CharField(max_length=200)
    model_type = models.CharField(max_length=30, choices=MODEL_TYPE_CHOICES)
    version = models.CharField(max_length=50)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='TRAINING')
    
    # Model Metadata
    description = models.TextField(blank=True)
    algorithm = models.CharField(max_length=100)  # e.g., RandomForest, XGBoost, Neural Network
    
    # Performance Metrics
    accuracy = models.FloatField(null=True, blank=True)
    precision = models.FloatField(null=True, blank=True)
    recall = models.FloatField(null=True, blank=True)
    f1_score = models.FloatField(null=True, blank=True)
    auc_roc = models.FloatField(null=True, blank=True)
    
    # Training Information
    training_data_size = models.IntegerField(default=0)
    features_used = models.JSONField(default=list)
    hyperparameters = models.JSONField(default=dict)
    
    # Model File
    model_file_path = models.CharField(max_length=500, blank=True)
    
    # Timestamps
    trained_at = models.DateTimeField(null=True, blank=True)
    deployed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'ml_models'
        verbose_name = 'ML Model'
        verbose_name_plural = 'ML Models'
        ordering = ['-created_at']
        unique_together = ['name', 'version']
    
    def __str__(self):
        return f"{self.name} v{self.version} ({self.status})"


class RiskScore(models.Model):
    """AI-generated risk scores for customers and transactions"""
    ENTITY_TYPE_CHOICES = [
        ('CUSTOMER', 'Customer'),
        ('TRANSACTION', 'Transaction'),
    ]
    
    # Entity Reference
    entity_type = models.CharField(max_length=20, choices=ENTITY_TYPE_CHOICES)
    customer = models.ForeignKey(
        Customer,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='risk_scores'
    )
    transaction = models.ForeignKey(
        Transaction,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='risk_scores'
    )
    
    # Risk Score Details
    risk_score = models.FloatField()  # 0.0 to 1.0
    risk_level = models.CharField(max_length=20)  # LOW, MEDIUM, HIGH, CRITICAL
    confidence = models.FloatField(default=0.0)  # Model confidence
    
    # ML Model Used
    ml_model = models.ForeignKey(
        MLModel,
        on_delete=models.SET_NULL,
        null=True,
        related_name='risk_scores'
    )
    
    # Contributing Factors
    risk_factors = models.JSONField(default=dict)
    # Example structure:
    # {
    #     "high_amount": {"score": 0.8, "weight": 0.3},
    #     "velocity": {"score": 0.6, "weight": 0.2},
    #     "country_risk": {"score": 0.9, "weight": 0.25},
    # }
    
    # Feature Values
    feature_values = models.JSONField(default=dict)
    
    # Explanation (for interpretability)
    explanation = models.TextField(blank=True)
    
    # Timestamps
    calculated_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        db_table = 'risk_scores'
        verbose_name = 'Risk Score'
        verbose_name_plural = 'Risk Scores'
        ordering = ['-calculated_at']
        indexes = [
            models.Index(fields=['customer', 'calculated_at']),
            models.Index(fields=['transaction', 'calculated_at']),
            models.Index(fields=['risk_level']),
        ]
    
    def __str__(self):
        entity = self.customer or self.transaction
        return f"Risk Score: {self.risk_score:.2f} for {entity}"


class ModelPrediction(models.Model):
    """Stores individual predictions made by ML models"""
    ml_model = models.ForeignKey(MLModel, on_delete=models.CASCADE, related_name='predictions')
    transaction = models.ForeignKey(Transaction, on_delete=models.CASCADE, related_name='predictions')
    
    # Prediction Results
    is_suspicious = models.BooleanField()
    suspicion_score = models.FloatField()  # 0.0 to 1.0
    prediction_class = models.CharField(max_length=50, blank=True)
    
    # Feature Importance
    feature_importance = models.JSONField(default=dict)
    
    # Model Output
    raw_prediction = models.JSONField(default=dict)
    
    # Actual Outcome (for model retraining)
    actual_outcome = models.BooleanField(null=True, blank=True)
    feedback_provided = models.BooleanField(default=False)
    
    # Timestamps
    predicted_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'model_predictions'
        verbose_name = 'Model Prediction'
        verbose_name_plural = 'Model Predictions'
        ordering = ['-predicted_at']
        indexes = [
            models.Index(fields=['transaction', 'ml_model']),
            models.Index(fields=['is_suspicious']),
        ]
    
    def __str__(self):
        return f"Prediction for {self.transaction.transaction_id}: {self.suspicion_score:.2f}"


class TrainingData(models.Model):
    """Historical data used for model training"""
    transaction = models.ForeignKey(Transaction, on_delete=models.CASCADE)
    
    # Label (ground truth)
    is_fraudulent = models.BooleanField()
    is_suspicious = models.BooleanField()
    
    # Features extracted for training
    features = models.JSONField(default=dict)
    
    # Data Quality
    is_verified = models.BooleanField(default=False)
    verified_by = models.CharField(max_length=100, blank=True)
    
    # Metadata
    labeled_at = models.DateTimeField(auto_now_add=True)
    used_in_training = models.BooleanField(default=False)
    
    class Meta:
        db_table = 'training_data'
        verbose_name = 'Training Data'
        verbose_name_plural = 'Training Data'
        ordering = ['-labeled_at']
    
    def __str__(self):
        return f"Training Data: {self.transaction.transaction_id}"


class AnomalyDetection(models.Model):
    """Records anomalies detected by unsupervised learning models"""
    transaction = models.ForeignKey(Transaction, on_delete=models.CASCADE, related_name='anomalies')
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name='anomalies')
    
    # Anomaly Details
    anomaly_score = models.FloatField()  # Higher = more anomalous
    anomaly_type = models.CharField(max_length=100)
    
    # Detection Method
    detection_method = models.CharField(max_length=100)  # e.g., Isolation Forest, DBSCAN
    ml_model = models.ForeignKey(MLModel, on_delete=models.SET_NULL, null=True)
    
    # Context
    baseline_pattern = models.JSONField(default=dict)
    deviation_details = models.JSONField(default=dict)
    
    # Review Status
    reviewed = models.BooleanField(default=False)
    is_confirmed_anomaly = models.BooleanField(null=True, blank=True)
    
    # Timestamps
    detected_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        db_table = 'anomaly_detections'
        verbose_name = 'Anomaly Detection'
        verbose_name_plural = 'Anomaly Detections'
        ordering = ['-detected_at']
        indexes = [
            models.Index(fields=['customer', 'detected_at']),
            models.Index(fields=['reviewed']),
        ]
    
    def __str__(self):
        return f"Anomaly: {self.anomaly_type} - Score: {self.anomaly_score:.2f}"
