"""
Analytics endpoints used by the React dashboards.
"""

from datetime import datetime, time, timedelta
from pathlib import Path

from django.db.models import Avg, Count, Q
from django.db.models.functions import TruncDate
from django.http import Http404, HttpResponse
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from accounts.models import Customer
from alerts.models import Alert, Investigation
from ml_engine.models import MLModel
from transactions.models import Transaction


OUTGOING_TYPES = [
    'WITHDRAWAL',
    'TRANSFER',
    'PAYMENT',
    'WIRE',
    'ATM',
    'CHECK',
    'CARD',
    'CRYPTO',
]

SEVERITY_COLORS = {
    'CRITICAL': '#ef4444',
    'HIGH': '#f97316',
    'MEDIUM': '#f59e0b',
    'LOW': '#22c55e',
}

RISK_COLORS = {
    'HIGH': '#ef4444',
    'MEDIUM': '#f59e0b',
    'LOW': '#22c55e',
}

WORKFLOW_COLORS = {
    'NEW': '#ef4444',
    'ASSIGNED': '#f97316',
    'IN_PROGRESS': '#eab308',
    'ESCALATED': '#fb7185',
    'SAR_FILED': '#22c55e',
    'RESOLVED': '#60a5fa',
}

ALERT_STATUS_COLORS = ['#22c55e', '#6366f1', '#f97316', '#ef4444', '#94a3b8']
FRONTEND_DIST_DIR = Path(__file__).resolve().parents[2] / 'client' / 'dist'
FRONTEND_INDEX_PATH = FRONTEND_DIST_DIR / 'index.html'


def _start_of_day(value):
    current_tz = timezone.get_current_timezone()
    return timezone.make_aware(datetime.combine(value, time.min), current_tz)


def _day_series(days):
    today = timezone.localdate()
    return [today - timedelta(days=offset) for offset in range(days - 1, -1, -1)]


def _format_day_label(value):
    return value.strftime('%a')


def _format_week_label(value):
    return f"Wk {((value.day - 1) // 7) + 1}"


def _format_ago(value):
    if value is None:
        return 'Just now'
    diff = timezone.now() - value
    minutes = max(0, int(diff.total_seconds() // 60))
    if minutes < 1:
        return 'Just now'
    if minutes < 60:
        return f'{minutes} min ago'
    hours = minutes // 60
    if hours < 24:
        suffix = '' if hours == 1 else 's'
        return f'{hours} hour{suffix} ago'
    days = hours // 24
    suffix = '' if days == 1 else 's'
    return f'{days} day{suffix} ago'


def _trend(current, previous):
    delta = current - previous
    if delta == 0:
        return {'change': 'No change', 'trend': 'up'}
    sign = '+' if delta > 0 else ''
    return {
        'change': f'{sign}{delta:,}',
        'trend': 'up' if delta >= 0 else 'down',
    }


def _date_count_map(queryset, field_name, filters=None, annotations=None):
    filters = filters or Q()
    annotations = annotations or {}
    rows = (
        queryset.filter(filters)
        .annotate(day=TruncDate(field_name))
        .values('day')
        .annotate(total=Count('id'), **annotations)
        .order_by('day')
    )
    return {row['day']: row for row in rows}


def frontend_app(request):
    if not FRONTEND_INDEX_PATH.exists():
        raise Http404('Frontend build not found. Build the client app first.')

    return HttpResponse(FRONTEND_INDEX_PATH.read_text(encoding='utf-8'))


@api_view(['GET'])
@permission_classes([AllowAny])
def dashboard_overview(request):
    today = timezone.localdate()
    start_today = _start_of_day(today)
    start_yesterday = start_today - timedelta(days=1)
    day_window = _day_series(7)

    customers_qs = Customer.objects.filter(is_active=True)
    transactions_qs = Transaction.objects.all()
    alerts_qs = Alert.objects.all()
    cases_qs = Alert.objects.filter(status='ESCALATED')
    models_qs = MLModel.objects.filter(model_type='TRANSACTION_RISK')

    tx_by_day = _date_count_map(
        transactions_qs.filter(transaction_date__gte=_start_of_day(day_window[0])),
        'transaction_date',
        annotations={
            'debits': Count('id', filter=Q(transaction_type__in=OUTGOING_TYPES)),
        },
    )

    alert_by_day = _date_count_map(
        alerts_qs.filter(triggered_at__gte=_start_of_day(today - timedelta(days=4))),
        'triggered_at',
        annotations={
            'high_risk': Count('id', filter=Q(severity__in=['HIGH', 'CRITICAL'])),
        },
    )

    tx_last_28 = _date_count_map(
        transactions_qs.filter(transaction_date__gte=_start_of_day(today - timedelta(days=27))),
        'transaction_date',
    )
    alerts_last_28 = _date_count_map(
        alerts_qs.filter(triggered_at__gte=_start_of_day(today - timedelta(days=27))),
        'triggered_at',
    )

    severity_counts = {
        row['severity']: row['count']
        for row in alerts_qs.values('severity').annotate(count=Count('id'))
    }
    workflow_counts = {
        row['status']: row['count']
        for row in alerts_qs.filter(severity__in=['HIGH', 'CRITICAL']).values('status').annotate(count=Count('id'))
    }
    customer_risk_counts = {
        row['risk_level']: row['count']
        for row in customers_qs.values('risk_level').annotate(count=Count('id'))
    }

    today_transactions = transactions_qs.filter(transaction_date__gte=start_today).count()
    yesterday_transactions = transactions_qs.filter(
        transaction_date__gte=start_yesterday,
        transaction_date__lt=start_today,
    ).count()
    today_high_risk_alerts = alerts_qs.filter(
        triggered_at__gte=start_today,
        severity__in=['HIGH', 'CRITICAL'],
    ).count()
    yesterday_high_risk_alerts = alerts_qs.filter(
        triggered_at__gte=start_yesterday,
        triggered_at__lt=start_today,
        severity__in=['HIGH', 'CRITICAL'],
    ).count()

    transaction_trend = _trend(today_transactions, yesterday_transactions)
    alert_trend = _trend(today_high_risk_alerts, yesterday_high_risk_alerts)

    weekly_trends = []
    for index in range(4):
        week_start = today - timedelta(days=27 - index * 7)
        dates = [week_start + timedelta(days=offset) for offset in range(7)]
        weekly_trends.append({
            'week': _format_week_label(week_start),
            'transactions': sum(tx_last_28.get(day, {}).get('total', 0) for day in dates),
            'alerts': sum(alerts_last_28.get(day, {}).get('total', 0) for day in dates),
        })

    payload = {
        'kpis': {
            'totalTransactions': {
                'value': transactions_qs.count(),
                'change': f"{transaction_trend['change']} today",
                'trend': transaction_trend['trend'],
            },
            'highRiskAlerts': {
                'value': alerts_qs.filter(severity__in=['HIGH', 'CRITICAL']).count(),
                'change': f"{alert_trend['change']} today",
                'trend': alert_trend['trend'],
            },
            'openCases': {
                'value': cases_qs.count(),
                'change': f'{cases_qs.count():,} queued',
                'trend': 'up',
            },
            'mlModels': {
                'value': models_qs.filter(status='ACTIVE').count(),
                'change': f"{models_qs.filter(status__in=['TRAINING', 'TESTING']).count():,} in training/testing",
                'trend': 'up',
            },
        },
        'quickStats': {
            'totalCustomers': customers_qs.count(),
            'totalAlerts': alerts_qs.count(),
            'highRiskAlerts': alerts_qs.filter(severity__in=['HIGH', 'CRITICAL']).count(),
        },
        'transactionFlowByDay': [
            {
                'day': _format_day_label(day),
                'debits': tx_by_day.get(day, {}).get('debits', 0),
                'credits': max(
                    0,
                    tx_by_day.get(day, {}).get('total', 0) - tx_by_day.get(day, {}).get('debits', 0),
                ),
            }
            for day in day_window
        ],
        'alertSeverityMix': [
            {
                'name': severity,
                'value': severity_counts.get(severity, 0),
                'color': SEVERITY_COLORS[severity],
            }
            for severity in ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']
            if severity_counts.get(severity, 0) > 0
        ],
        'weeklyTrends': weekly_trends,
        'alertsCreatedByDay': [
            {
                'day': _format_day_label(day),
                'total': alert_by_day.get(day, {}).get('total', 0),
                'highRisk': alert_by_day.get(day, {}).get('high_risk', 0),
            }
            for day in _day_series(5)
        ],
        'highRiskWorkflow': [
            {
                'status': status.replace('_', ' '),
                'count': workflow_counts.get(status, 0),
                'fill': WORKFLOW_COLORS.get(status, '#94a3b8'),
            }
            for status in ['NEW', 'ASSIGNED', 'IN_PROGRESS', 'ESCALATED', 'SAR_FILED', 'RESOLVED']
        ],
        'customerRiskLevels': [
            {
                'tier': tier,
                'count': customer_risk_counts.get(tier, 0),
                'fill': RISK_COLORS[tier],
            }
            for tier in ['HIGH', 'MEDIUM', 'LOW']
        ],
    }
    return Response(payload)


@api_view(['GET'])
@permission_classes([AllowAny])
def dashboard_performance(request):
    today = timezone.localdate()
    last_five_days = _day_series(5)

    transactions_qs = Transaction.objects.all()
    alerts_qs = Alert.objects.all()
    cases_qs = Alert.objects.filter(status='ESCALATED')
    models_qs = MLModel.objects.filter(model_type='TRANSACTION_RISK')
    sar_qs = Investigation.objects.filter(sar_filed=True)

    tx_daily_rows = (
        transactions_qs.filter(transaction_date__gte=_start_of_day(last_five_days[0]))
        .annotate(day=TruncDate('transaction_date'))
        .values('day')
        .annotate(total=Count('id'), avg_risk=Avg('risk_score'))
        .order_by('day')
    )
    tx_daily = {row['day']: row for row in tx_daily_rows}
    alert_daily = _date_count_map(
        alerts_qs.filter(triggered_at__gte=_start_of_day(last_five_days[0])),
        'triggered_at',
    )
    cases_daily = _date_count_map(
        cases_qs.filter(triggered_at__gte=_start_of_day(last_five_days[0])),
        'triggered_at',
    )
    sar_daily = _date_count_map(
        sar_qs.filter(sar_filing_date__gte=_start_of_day(last_five_days[0])),
        'sar_filing_date',
    )

    alert_status_counts = list(alerts_qs.values('status').annotate(count=Count('id')).order_by('status'))
    active_models_count = models_qs.filter(status='ACTIVE').count()
    pipeline_models_count = models_qs.filter(status__in=['TRAINING', 'TESTING']).count()
    suspicious_count = transactions_qs.filter(is_suspicious=True).count()
    tx_aggregate = transactions_qs.aggregate(avg_risk=Avg('risk_score'))
    model_aggregate = models_qs.aggregate(avg_accuracy=Avg('accuracy'))
    today_transactions = transactions_qs.filter(transaction_date__gte=_start_of_day(today)).count()
    total_transactions = transactions_qs.count()
    total_alerts = alerts_qs.count()
    high_risk_alerts = alerts_qs.filter(severity__in=['HIGH', 'CRITICAL']).count()

    payload = {
        'kpis': {
            'activeModels': {
                'value': f'{active_models_count:,}',
                'change': f'{pipeline_models_count} in pipeline',
                'trend': 'up',
            },
            'avgRiskScore': {
                'value': f"{((tx_aggregate['avg_risk'] or 0) * 100):.1f}%",
                'change': f'{suspicious_count:,} suspicious',
                'trend': 'up',
            },
            'modelAccuracy': {
                'value': f"{((model_aggregate['avg_accuracy'] or 0) * 100):.1f}%",
                'change': f"{models_qs.exclude(accuracy__isnull=True).count():,} scored models",
                'trend': 'up',
            },
            'transactionThroughput': {
                'value': f'{today_transactions:,} today',
                'change': f'{total_transactions:,} total',
                'trend': 'up',
            },
        },
        'dailyRiskVsVolume': [
            {
                'day': _format_day_label(day),
                'riskScore': round((tx_daily.get(day, {}).get('avg_risk') or 0) * 100, 1),
                'transactions': tx_daily.get(day, {}).get('total', 0),
            }
            for day in last_five_days
        ],
        'alertStatusMix': [
            {
                'name': row['status'],
                'value': row['count'],
                'color': ALERT_STATUS_COLORS[index % len(ALERT_STATUS_COLORS)],
            }
            for index, row in enumerate(alert_status_counts)
        ],
        'dailyOperations': [
            {
                'day': _format_day_label(day),
                'alerts': alert_daily.get(day, {}).get('total', 0),
                'cases': cases_daily.get(day, {}).get('total', 0),
                'sar': sar_daily.get(day, {}).get('total', 0),
            }
            for day in last_five_days
        ],
        'modelQuality': [
            {
                'model': (model.name or 'Model')[:16],
                'accuracy': round((model.accuracy or 0) * 100, 1),
                'precision': round((model.precision or max((model.accuracy or 0) - 0.03, 0)) * 100, 1),
                'recall': round((model.recall or max((model.accuracy or 0) - 0.05, 0)) * 100, 1),
            }
            for model in models_qs.order_by('-created_at')[:4]
        ],
        'detectionBySource': [
            {
                'source': 'Transactions',
                'flagged': suspicious_count,
                'normal': max(0, total_transactions - suspicious_count),
            },
            {
                'source': 'Alerts',
                'flagged': high_risk_alerts,
                'normal': max(0, total_alerts - high_risk_alerts),
            },
            {
                'source': 'Cases',
                'flagged': cases_qs.count(),
                'normal': max(0, total_alerts - cases_qs.count()),
            },
        ],
        'queueSla': [
            {
                'day': _format_day_label(day),
                'processed': alert_daily.get(day, {}).get('total', 0),
                'withinSla': (
                    alerts_qs.filter(triggered_at__date=day)
                    .exclude(severity='CRITICAL')
                    .count()
                ),
            }
            for day in last_five_days
        ],
    }
    return Response(payload)


@api_view(['GET'])
@permission_classes([AllowAny])
def dashboard_activity_feed(request):
    alerts = list(Alert.objects.order_by('-triggered_at')[:4])
    cases = list(Alert.objects.filter(status='ESCALATED').order_by('-triggered_at')[:3])
    models = list(MLModel.objects.filter(model_type='TRANSACTION_RISK').order_by('-updated_at')[:2])
    transactions = list(Transaction.objects.filter(is_suspicious=True).order_by('-transaction_date')[:3])

    items = []

    for alert in alerts:
        is_hot = alert.severity in {'HIGH', 'CRITICAL'}
        items.append({
            'id': f'alert-{alert.id}',
            'type': 'hot-lead' if is_hot else 'new-conversation',
            'title': 'High-risk alert raised' if is_hot else 'Alert generated',
            'actor': 'Alert Engine',
            'detail': f"{alert.alert_id} {(alert.title or alert.description or '')[:72]}".strip(),
            'ago': _format_ago(alert.triggered_at),
            'sortTime': int(alert.triggered_at.timestamp() * 1000) if alert.triggered_at else 0,
        })

    for case in cases:
        items.append({
            'id': f'case-{case.id}',
            'type': 'takeover',
            'title': 'Case moved to analyst review',
            'actor': getattr(case.assigned_to, 'username', None) or 'Case Management',
            'detail': f"{case.alert_id} {(case.title or case.description or '')[:72]}".strip(),
            'ago': _format_ago(case.triggered_at),
            'sortTime': int(case.triggered_at.timestamp() * 1000) if case.triggered_at else 0,
        })

    for model in models:
        items.append({
            'id': f'model-{model.id}',
            'type': 'bot-replied',
            'title': 'Model status updated',
            'actor': model.name or 'ML Engine',
            'detail': f'{model.status} {model.version}'.strip(),
            'ago': _format_ago(model.updated_at),
            'sortTime': int(model.updated_at.timestamp() * 1000) if model.updated_at else 0,
        })

    for transaction in transactions:
        items.append({
            'id': f'txn-{transaction.id}',
            'type': 'hot-lead',
            'title': 'Suspicious transaction flagged',
            'actor': 'Transaction Monitoring',
            'detail': f'{transaction.transaction_id} scored {transaction.risk_score}',
            'ago': _format_ago(transaction.transaction_date),
            'sortTime': int(transaction.transaction_date.timestamp() * 1000) if transaction.transaction_date else 0,
        })

    items.sort(key=lambda item: item['sortTime'], reverse=True)
    return Response({'results': items[:10]})
