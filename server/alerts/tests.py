from django.test import TestCase

from alerts.default_rules import DEFAULT_ALERT_RULES, ensure_default_alert_rules
from alerts.models import AlertRule


class DefaultAlertRuleTests(TestCase):
    def test_default_rules_are_seeded_idempotently(self):
        first_created = ensure_default_alert_rules()
        second_created = ensure_default_alert_rules()

        self.assertEqual(first_created, len(DEFAULT_ALERT_RULES))
        self.assertEqual(second_created, 0)
        self.assertEqual(AlertRule.objects.count(), len(DEFAULT_ALERT_RULES))
        self.assertTrue(AlertRule.objects.filter(rule_type='HIGH_RISK_COUNTRY').exists())
        self.assertTrue(AlertRule.objects.filter(rule_type='SANCTION').exists())
