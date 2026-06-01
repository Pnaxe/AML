from decimal import Decimal

from django.test import TestCase
from django.utils import timezone

from accounts.models import Customer
from alerts.models import Alert, AlertRule
from ml_engine.monitoring import TransactionMonitor
from transactions.models import Transaction


class TransactionMonitorAlertTests(TestCase):
    def setUp(self):
        self.customer = Customer.objects.create(
            customer_id='CUST-ALERT-001',
            customer_type='INDIVIDUAL',
            first_name='Test',
            last_name='Customer',
            risk_level='LOW',
            is_active=True,
        )

    def _transaction(self, **overrides):
        defaults = {
            'transaction_id': 'TX-ALERT-001',
            'transaction_type': 'WIRE',
            'amount': Decimal('12500.00'),
            'currency': 'USD',
            'sender': self.customer,
            'status': 'PENDING',
            'transaction_date': timezone.now(),
        }
        defaults.update(overrides)
        return Transaction.objects.create(**defaults)

    def test_process_transaction_flags_threshold_and_creates_one_alert(self):
        tx = self._transaction()
        monitor = TransactionMonitor()

        first = monitor.process_transaction(tx)
        second = monitor.process_transaction(tx)
        tx.refresh_from_db()

        self.assertTrue(tx.is_suspicious)
        self.assertTrue(tx.amount_threshold_flag)
        self.assertEqual(tx.status, 'FLAGGED')
        self.assertEqual(Alert.objects.filter(transactions=tx).count(), 1)
        self.assertEqual(first['alerts_generated'], second['alerts_generated'])

    def test_backfill_missing_alerts_for_flagged_database_transaction(self):
        tx = self._transaction(
            transaction_id='TX-BACKFILL-001',
            amount_threshold_flag=True,
        )

        created = TransactionMonitor().backfill_missing_alerts()
        tx.refresh_from_db()

        self.assertEqual(created, 1)
        self.assertTrue(tx.is_suspicious)
        self.assertEqual(Alert.objects.filter(transactions=tx, status='NEW').count(), 1)

    def test_daily_limit_rule_controls_threshold_detection(self):
        AlertRule.objects.create(
            name='Daily deposit limit',
            description='Alert if deposits exceed 5000 in 24 hours.',
            rule_type='THRESHOLD',
            severity='HIGH',
            is_active=True,
            threshold_config={
                'metric': 'daily_transaction_total',
                'transaction_type': 'DEPOSIT',
                'amount': 5000,
                'period_hours': 24,
            },
        )
        first = self._transaction(
            transaction_id='TX-DAILY-001',
            transaction_type='DEPOSIT',
            amount=Decimal('3000.00'),
        )
        second = self._transaction(
            transaction_id='TX-DAILY-002',
            transaction_type='DEPOSIT',
            amount=Decimal('2500.00'),
        )
        monitor = TransactionMonitor()

        first_result = monitor.process_transaction(first)
        second_result = monitor.process_transaction(second)
        first.refresh_from_db()
        second.refresh_from_db()

        self.assertFalse(first.is_suspicious)
        self.assertEqual(first_result['alerts_generated'], [])
        self.assertTrue(second.is_suspicious)
        self.assertTrue(second.amount_threshold_flag)
        self.assertEqual(len(second_result['alerts_generated']), 1)

    def test_round_amount_rule_creates_round_amount_alert(self):
        AlertRule.objects.create(
            name='Round amount pattern',
            description='Alert on large round-number transactions.',
            rule_type='ROUND_AMOUNT',
            severity='MEDIUM',
            is_active=True,
            threshold_config={'amount': 5000, 'multiple': 1000},
        )
        tx = self._transaction(
            transaction_id='TX-ROUND-001',
            amount=Decimal('7000.00'),
        )

        result = TransactionMonitor().process_transaction(tx)
        tx.refresh_from_db()

        self.assertTrue(tx.is_suspicious)
        self.assertTrue(tx.unusual_pattern_flag)
        self.assertEqual(len(result['alerts_generated']), 1)
        self.assertTrue(Alert.objects.filter(transactions=tx, alert_type='ROUND_AMOUNT').exists())

    def test_sanction_rule_creates_sanction_alert(self):
        self.customer.is_sanctioned = True
        self.customer.save(update_fields=['is_sanctioned'])
        AlertRule.objects.create(
            name='Sanctioned customer activity',
            description='Alert on activity involving sanctioned customers.',
            rule_type='SANCTION',
            severity='CRITICAL',
            is_active=True,
            threshold_config={'match_sender': True, 'match_receiver': True},
        )
        tx = self._transaction(
            transaction_id='TX-SANCTION-001',
            amount=Decimal('100.00'),
        )

        result = TransactionMonitor().process_transaction(tx)

        self.assertEqual(len(result['alerts_generated']), 1)
        self.assertTrue(Alert.objects.filter(transactions=tx, alert_type='SANCTION', severity='CRITICAL').exists())
