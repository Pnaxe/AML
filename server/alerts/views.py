from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone
from django.http import HttpResponse

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

    @action(detail=False, methods=['get'])
    def flagged(self, request):
        """
        Get alerts that still require manual analyst review.
        """
        review_statuses = ['NEW', 'ASSIGNED', 'IN_PROGRESS', 'ESCALATED']
        flagged = self.queryset.filter(status__in=review_statuses)
        page = self.paginate_queryset(flagged)

        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(flagged, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def ignore(self, request, pk=None):
        """
        Mark alert as false positive (ignored).
        """
        alert = self.get_object()
        note = request.data.get('resolution_notes', '') or request.data.get('note', '')

        alert.status = 'FALSE_POSITIVE'
        alert.resolution_notes = note
        alert.resolved_at = timezone.now()
        alert.save()

        return Response({
            'message': 'Alert ignored as false positive',
            'alert_id': alert.alert_id,
            'status': alert.status,
        })

    @action(detail=True, methods=['post'])
    def continue_review(self, request, pk=None):
        """
        Move alert into active manual review.
        """
        alert = self.get_object()
        note = request.data.get('investigation_notes', '') or request.data.get('note', '')

        alert.status = 'IN_PROGRESS'
        if note:
            alert.investigation_notes = note
        if alert.assigned_at is None:
            alert.assigned_at = timezone.now()
        alert.save()

        return Response({
            'message': 'Alert set to continue review',
            'alert_id': alert.alert_id,
            'status': alert.status,
        })

    @action(detail=False, methods=['get'])
    def cases_for_sar(self, request):
        """
        Escalated alerts that are candidates for SAR filing.
        """
        cases = self.queryset.filter(status='ESCALATED')
        page = self.paginate_queryset(cases)

        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(cases, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def file_sar(self, request, pk=None):
        """
        Mark an escalated alert as filed to SAR.
        """
        alert = self.get_object()
        if alert.status != 'ESCALATED':
            return Response({
                'error': 'Only escalated alerts can be filed to SAR',
                'current_status': alert.status
            }, status=status.HTTP_400_BAD_REQUEST)

        reference = request.data.get('sar_reference', '').strip()
        if not reference:
            reference = f"SAR-{timezone.now().strftime('%Y%m%d')}-{alert.id:06d}"

        investigation, _ = Investigation.objects.get_or_create(
            alert=alert,
            defaults={
                'investigator': request.user if request.user.is_authenticated else None,
                'findings': request.data.get('resolution_notes', '') or alert.description or 'SAR filed after escalation review.',
                'initial_risk_score': alert.risk_score or 0.0,
            }
        )
        investigation.sar_required = True
        investigation.sar_filed = True
        investigation.sar_reference = reference
        investigation.sar_filing_date = timezone.now()
        investigation.action_taken = request.data.get('resolution_notes', investigation.action_taken)
        investigation.save()

        alert.status = 'SAR_FILED'
        alert.resolution_notes = request.data.get('resolution_notes', alert.resolution_notes)
        alert.save()

        return Response({
            'message': 'Case filed to SAR',
            'alert_id': alert.alert_id,
            'status': alert.status,
            'sar_reference': investigation.sar_reference,
            'sar_filing_date': investigation.sar_filing_date,
        })

    @action(detail=False, methods=['get'])
    def sar_reports(self, request):
        """
        List alerts already filed to SAR (submitted to regulator).
        """
        filed = self.queryset.filter(status='SAR_FILED').select_related('customer').order_by('-updated_at')
        search = request.query_params.get('search', '').strip().lower()
        severity = request.query_params.get('severity', '').strip().upper()

        results = []
        for alert in filed:
            inv = Investigation.objects.filter(alert=alert).first()
            customer = alert.customer
            customer_name = customer.get_full_name()
            sar_reference = inv.sar_reference if inv else ''
            sar_filing_date = inv.sar_filing_date if inv else alert.updated_at
            report_text = (alert.resolution_notes or '') or (inv.action_taken if inv else '') or (alert.investigation_notes or '')

            row = {
                'id': alert.id,
                'alert_id': alert.alert_id,
                'sar_reference': sar_reference,
                'customer_id': customer.customer_id,
                'customer_name': customer_name,
                'alert_type': alert.alert_type,
                'severity': alert.severity,
                'risk_score': alert.risk_score,
                'title': alert.title,
                'description': alert.description,
                'report_text': report_text,
                'submitted_at': sar_filing_date.isoformat() if sar_filing_date else None,
            }

            hay = f"{row['alert_id']} {row['sar_reference']} {row['customer_id']} {row['customer_name']} {row['title']}".lower()
            if search and search not in hay:
                continue
            if severity and row['severity'] != severity:
                continue
            results.append(row)

        return Response({'count': len(results), 'results': results})

    @action(detail=True, methods=['get'])
    def sar_report_pdf(self, request, pk=None):
        """
        Download SAR report as PDF for a SAR_FILED alert.
        """
        alert = self.get_object()
        if alert.status != 'SAR_FILED':
            return Response({'error': 'SAR report PDF is only available for SAR_FILED alerts'}, status=status.HTTP_400_BAD_REQUEST)

        inv = Investigation.objects.filter(alert=alert).first()
        customer = alert.customer
        customer_name = customer.get_full_name()
        sar_reference = inv.sar_reference if inv and inv.sar_reference else f"SAR-{alert.id:06d}"
        submitted_at = inv.sar_filing_date if inv and inv.sar_filing_date else alert.updated_at
        narrative = (alert.resolution_notes or '') or (inv.action_taken if inv else '') or (alert.investigation_notes or '') or 'No narrative provided.'

        lines = [
            "Suspicious Activity Report (SAR)",
            "",
            f"SAR Reference: {sar_reference}",
            f"Alert ID: {alert.alert_id}",
            f"Submitted At: {submitted_at.strftime('%Y-%m-%d %H:%M:%S') if submitted_at else ''}",
            "",
            "Customer",
            f"Name: {customer_name}",
            f"Customer ID: {customer.customer_id}",
            "",
            "Alert Details",
            f"Type: {alert.alert_type}",
            f"Severity: {alert.severity}",
            f"Risk Score: {alert.risk_score:.2f}",
            f"Title: {alert.title}",
            f"Description: {alert.description}",
            "",
            "Detailed Report",
            narrative,
        ]

        pdf_bytes = self._simple_pdf(lines)
        filename = f"{sar_reference or alert.alert_id}.pdf".replace(' ', '_')
        response = HttpResponse(pdf_bytes, content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response

    def _simple_pdf(self, lines):
        """
        Minimal PDF generator for plain text reports (no external dependencies).
        """
        def esc(text):
            return text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")

        max_lines_per_page = 45
        pages = [lines[i:i + max_lines_per_page] for i in range(0, len(lines), max_lines_per_page)] or [[]]

        objects = []
        page_ids = []

        # Object 1: Catalog
        # Object 2: Pages container
        objects.append("<< /Type /Catalog /Pages 2 0 R >>")
        objects.append("")  # placeholder pages object at index 1

        # Object 3: Font
        objects.append("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
        font_id = 3

        next_id = 4
        for page in pages:
            stream_lines = ["BT", "/F1 10 Tf", "50 780 Td", "14 TL"]
            for idx, line in enumerate(page):
                line = esc(str(line))
                if idx == 0:
                    stream_lines.append(f"({line}) Tj")
                else:
                    stream_lines.append(f"T* ({line}) Tj")
            stream_lines.append("ET")
            stream = "\n".join(stream_lines)

            content_id = next_id
            next_id += 1
            page_id = next_id
            next_id += 1

            objects.append(f"<< /Length {len(stream.encode('latin-1', errors='replace'))} >>\nstream\n{stream}\nendstream")
            objects.append(f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 {font_id} 0 R >> >> /Contents {content_id} 0 R >>")
            page_ids.append(page_id)

        kids = " ".join(f"{pid} 0 R" for pid in page_ids)
        objects[1] = f"<< /Type /Pages /Kids [{kids}] /Count {len(page_ids)} >>"

        out = "%PDF-1.4\n"
        offsets = []
        for idx, obj in enumerate(objects, start=1):
            offsets.append(len(out.encode('latin-1', errors='replace')))
            out += f"{idx} 0 obj\n{obj}\nendobj\n"

        xref_pos = len(out.encode('latin-1', errors='replace'))
        out += f"xref\n0 {len(objects) + 1}\n"
        out += "0000000000 65535 f \n"
        for off in offsets:
            out += f"{off:010d} 00000 n \n"
        out += f"trailer << /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref_pos}\n%%EOF"
        return out.encode('latin-1', errors='replace')


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
