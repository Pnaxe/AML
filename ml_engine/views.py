from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone

from .models import MLModel, RiskScore, ModelPrediction, AnomalyDetection
from .serializers import (
    MLModelSerializer,
    RiskScoreSerializer,
    ModelPredictionSerializer,
    AnomalyDetectionSerializer
)


class MLModelViewSet(viewsets.ModelViewSet):
    """
    ViewSet for ML Model management
    """
    queryset = MLModel.objects.all()
    serializer_class = MLModelSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['model_type', 'status', 'algorithm']
    ordering = ['-created_at']
    
    @action(detail=True, methods=['post'])
    def deploy(self, request, pk=None):
        """
        Deploy a model (set as active)
        """
        model = self.get_object()
        
        # Deactivate other models of same type
        MLModel.objects.filter(
            model_type=model.model_type,
            status='ACTIVE'
        ).update(status='ARCHIVED')
        
        # Activate this model
        model.status = 'ACTIVE'
        model.deployed_at = timezone.now()
        model.save()
        
        return Response({
            'message': 'Model deployed successfully',
            'model_name': model.name,
            'version': model.version
        })


class RiskScoreViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for Risk Scores (read-only)
    """
    queryset = RiskScore.objects.all()
    serializer_class = RiskScoreSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['entity_type', 'risk_level', 'customer', 'transaction']
    ordering = ['-calculated_at']


class ModelPredictionViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for Model Predictions (read-only)
    """
    queryset = ModelPrediction.objects.all()
    serializer_class = ModelPredictionSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['ml_model', 'is_suspicious', 'transaction']
    ordering = ['-predicted_at']
    
    @action(detail=True, methods=['post'])
    def provide_feedback(self, request, pk=None):
        """
        Provide feedback on a prediction for model retraining
        """
        prediction = self.get_object()
        actual_outcome = request.data.get('actual_outcome')
        
        if actual_outcome is None:
            return Response(
                {'error': 'actual_outcome is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        prediction.actual_outcome = actual_outcome
        prediction.feedback_provided = True
        prediction.save()
        
        return Response({
            'message': 'Feedback recorded successfully',
            'prediction_id': prediction.id
        })


class AnomalyDetectionViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Anomaly Detection
    """
    queryset = AnomalyDetection.objects.all()
    serializer_class = AnomalyDetectionSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = [
        'customer', 'transaction', 'anomaly_type',
        'reviewed', 'is_confirmed_anomaly'
    ]
    ordering = ['-detected_at']
    
    @action(detail=True, methods=['post'])
    def review(self, request, pk=None):
        """
        Review an anomaly
        """
        anomaly = self.get_object()
        is_confirmed = request.data.get('is_confirmed_anomaly')
        
        anomaly.reviewed = True
        anomaly.reviewed_at = timezone.now()
        
        if is_confirmed is not None:
            anomaly.is_confirmed_anomaly = is_confirmed
        
        anomaly.save()
        
        return Response({
            'message': 'Anomaly reviewed successfully',
            'anomaly_id': anomaly.id
        })
    
    @action(detail=False, methods=['get'])
    def unreviewed(self, request):
        """
        Get unreviewed anomalies
        """
        unreviewed = self.queryset.filter(reviewed=False)
        page = self.paginate_queryset(unreviewed)
        
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        
        serializer = self.get_serializer(unreviewed, many=True)
        return Response(serializer.data)
