from .models import AlertRule


DEFAULT_ALERT_RULES = [
    {
        'name': 'Single large transaction',
        'description': 'Alert when any transaction reaches the reporting threshold.',
        'rule_type': 'THRESHOLD',
        'severity': 'HIGH',
        'threshold_config': {'metric': 'transaction_amount', 'amount': 10000},
    },
    {
        'name': 'Daily deposit total',
        'description': 'Alert when deposits exceed the daily operating threshold.',
        'rule_type': 'THRESHOLD',
        'severity': 'HIGH',
        'threshold_config': {'metric': 'daily_transaction_total', 'transaction_type': 'DEPOSIT', 'amount': 5000, 'period_hours': 24},
    },
    {
        'name': 'Daily withdrawal total',
        'description': 'Alert when withdrawals exceed the daily operating threshold.',
        'rule_type': 'THRESHOLD',
        'severity': 'HIGH',
        'threshold_config': {'metric': 'daily_transaction_total', 'transaction_type': 'WITHDRAWAL', 'amount': 5000, 'period_hours': 24},
    },
    {
        'name': 'High-value wire transfer',
        'description': 'Alert on high-value wire transfers.',
        'rule_type': 'THRESHOLD',
        'severity': 'HIGH',
        'threshold_config': {'metric': 'transaction_amount', 'transaction_type': 'WIRE', 'amount': 25000},
    },
    {
        'name': 'High-value crypto transaction',
        'description': 'Alert on high-value cryptocurrency transactions.',
        'rule_type': 'THRESHOLD',
        'severity': 'HIGH',
        'threshold_config': {'metric': 'transaction_amount', 'transaction_type': 'CRYPTO', 'amount': 10000},
    },
    {
        'name': 'Transaction frequency spike',
        'description': 'Alert when a customer makes 5 or more transactions in 24 hours.',
        'rule_type': 'VELOCITY',
        'severity': 'HIGH',
        'threshold_config': {'count': 5, 'period_hours': 24},
    },
    {
        'name': 'One-hour burst activity',
        'description': 'Alert when a customer makes 3 or more transactions in one hour.',
        'rule_type': 'VELOCITY',
        'severity': 'MEDIUM',
        'threshold_config': {'count': 3, 'period_hours': 1},
    },
    {
        'name': 'Structuring below reporting limit',
        'description': 'Alert on several transactions just below the reporting limit.',
        'rule_type': 'STRUCTURING',
        'severity': 'HIGH',
        'threshold_config': {'reporting_limit': 10000, 'below_percent': 90, 'min_transactions': 3, 'period_hours': 24},
    },
    {
        'name': 'Extended structuring pattern',
        'description': 'Alert on repeated threshold-avoidance over a week.',
        'rule_type': 'STRUCTURING',
        'severity': 'HIGH',
        'threshold_config': {'reporting_limit': 10000, 'below_percent': 80, 'min_transactions': 5, 'period_hours': 168},
    },
    {
        'name': 'High-risk jurisdiction movement',
        'description': 'Alert when funds move to or from high-risk jurisdictions.',
        'rule_type': 'HIGH_RISK_COUNTRY',
        'severity': 'CRITICAL',
        'threshold_config': {'countries': ['AF', 'IR', 'KP', 'SY', 'YE', 'MM', 'RU']},
    },
    {
        'name': 'High-risk customer lower threshold',
        'description': 'Alert high-risk customers at a lower transaction amount.',
        'rule_type': 'OTHER',
        'severity': 'HIGH',
        'threshold_config': {'metric': 'customer_risk_level', 'risk_levels': ['HIGH', 'CRITICAL'], 'amount': 2500, 'risk_score': 0.4},
    },
    {
        'name': 'Dormant account large activity',
        'description': 'Alert when an inactive account suddenly has large activity.',
        'rule_type': 'UNUSUAL_PATTERN',
        'severity': 'HIGH',
        'threshold_config': {'metric': 'dormant_account_activity', 'inactive_days': 90, 'amount': 5000},
    },
    {
        'name': 'Cash-heavy activity ratio',
        'description': 'Alert when cash-like activity is 70% or more of recent activity.',
        'rule_type': 'LARGE_CASH',
        'severity': 'MEDIUM',
        'threshold_config': {
            'cash_ratio_percent': 70,
            'period_days': 30,
            'cash_transaction_types': ['DEPOSIT', 'WITHDRAWAL', 'ATM'],
            'cash_channels': ['CASH', 'ATM', 'BRANCH'],
        },
    },
    {
        'name': 'Round amount pattern',
        'description': 'Alert on large round-number transactions.',
        'rule_type': 'ROUND_AMOUNT',
        'severity': 'MEDIUM',
        'threshold_config': {'amount': 5000, 'multiple': 1000},
    },
    {
        'name': 'Rapid movement of funds',
        'description': 'Alert when money appears to move in and out quickly.',
        'rule_type': 'RAPID_MOVEMENT',
        'severity': 'HIGH',
        'threshold_config': {'amount': 5000, 'period_hours': 48},
    },
    {
        'name': 'PEP customer activity',
        'description': 'Alert on activity involving politically exposed persons.',
        'rule_type': 'PEP',
        'severity': 'HIGH',
        'threshold_config': {'match_sender': True, 'match_receiver': True},
    },
    {
        'name': 'Sanctioned customer activity',
        'description': 'Alert on activity involving sanctioned customers.',
        'rule_type': 'SANCTION',
        'severity': 'CRITICAL',
        'threshold_config': {'match_sender': True, 'match_receiver': True},
    },
]


def ensure_default_alert_rules():
    created = 0
    for rule in DEFAULT_ALERT_RULES:
        _, was_created = AlertRule.objects.get_or_create(
            name=rule['name'],
            defaults={
                'description': rule['description'],
                'rule_type': rule['rule_type'],
                'severity': rule['severity'],
                'is_active': True,
                'threshold_config': rule['threshold_config'],
            },
        )
        if was_created:
            created += 1
    return created
