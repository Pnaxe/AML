from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone

from .models import Alert, Investigation, AlertRule
from .serializers import (
    AlertSerializer,
    AlertUpdateSerializer,
    InvestigationSerializer,
    AlertRuleSerializer
)


class AlertViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Alert management
    """
    queryset = Alert.objects.all()
    # TODO: Change back to [IsAuthenticated] in production
    permission_classes = [AllowAny]  # Temporarily allowing unauthenticated access for development
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = [
        'alert_type', 'severity', 'status', 'customer',
        'assigned_to', 'is_overdue'
    ]
    search_fields = ['alert_id', 'title', 'description']
    ordering_fields = ['triggered_at', 'risk_score', 'priority']
    ordering = ['-triggered_at']
    
    def get_serializer_class(self):
        if self.action in ['update', 'partial_update']:
            return AlertUpdateSerializer
        return AlertSerializer
    
    @action(detail=True, methods=['post'])
    def assign(self, request, pk=None):
        """
        Assign alert to a user
        """
        alert = self.get_object()
        user_id = request.data.get('user_id')
        
        if not user_id:
            return Response(
                {'error': 'user_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        alert.assigned_to_id = user_id
        alert.assigned_at = timezone.now()
        alert.status = 'ASSIGNED'
        alert.save()
        
        return Response({
            'message': 'Alert assigned successfully',
            'alert_id': alert.alert_id,
            'assigned_to': alert.assigned_to.username
        })
    
    @action(detail=True, methods=['post'])
    def resolve(self, request, pk=None):
        """
        Resolve an alert
        """
        alert = self.get_object()
        resolution_notes = request.data.get('resolution_notes', '')
        
        alert.status = 'RESOLVED'
        alert.resolved_at = timezone.now()
        alert.resolution_notes = resolution_notes
        alert.save()
        
        return Response({
            'message': 'Alert resolved successfully',
            'alert_id': alert.alert_id
        })
    
    @action(detail=True, methods=['post'])
    def escalate(self, request, pk=None):
        """
        Escalate an alert
        """
        alert = self.get_object()
        
        alert.status = 'ESCALATED'
        alert.priority = max(alert.priority - 1, 1)  # Increase priority
        alert.save()
        
        return Response({
            'message': 'Alert escalated successfully',
            'alert_id': alert.alert_id,
            'new_priority': alert.priority
        })
    
    @action(detail=False, methods=['get'])
    def my_alerts(self, request):
        """
        Get alerts assigned to current user
        """
        my_alerts = self.queryset.filter(assigned_to=request.user)
        page = self.paginate_queryset(my_alerts)
        
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        
        serializer = self.get_serializer(my_alerts, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def unassigned(self, request):
        """
        Get unassigned alerts
        """
        unassigned = self.queryset.filter(assigned_to__isnull=True, status='NEW')
        page = self.paginate_queryset(unassigned)
        
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        
        serializer = self.get_serializer(unassigned, many=True)
        return Response(serializer.data)


class InvestigationViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Investigation management
    """
    queryset = Investigation.objects.all()
    serializer_class = InvestigationSerializer
    # TODO: Change back to [IsAuthenticated] in production
    permission_classes = [AllowAny]  # Temporarily allowing unauthenticated access for development
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['investigator', 'is_suspicious', 'sar_required', 'sar_filed']
    ordering = ['-started_at']
    
    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """
        Complete an investigation
        """
        investigation = self.get_object()
        
        investigation.completed_at = timezone.now()
        investigation.save()
        
        # Update related alert
        investigation.alert.status = 'RESOLVED'
        investigation.alert.resolved_at = timezone.now()
        investigation.alert.save()
        
        return Response({
            'message': 'Investigation completed successfully',
            'investigation_id': investigation.id
        })


class AlertRuleViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Alert Rule management
    """
    queryset = AlertRule.objects.all()
    serializer_class = AlertRuleSerializer
    # TODO: Change back to [IsAuthenticated] in production
    permission_classes = [AllowAny]  # Temporarily allowing unauthenticated access for development
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['rule_type', 'severity', 'is_active']
    search_fields = ['name', 'description']
    
    @action(detail=True, methods=['post'])
    def toggle_active(self, request, pk=None):
        """
        Toggle rule active status
        """
        rule = self.get_object()
        rule.is_active = not rule.is_active
        rule.save()
        
        return Response({
            'message': f"Rule {'activated' if rule.is_active else 'deactivated'} successfully",
            'rule_name': rule.name,
            'is_active': rule.is_active
        })
