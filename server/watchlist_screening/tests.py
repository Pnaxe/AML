from unittest.mock import patch

from django.test import TestCase
from rest_framework.test import APIRequestFactory

from accounts.models import Customer
from .models import ScreeningMatch, WatchlistSource
from .views import ScreeningViewSet


class ScreeningDilisenseTests(TestCase):
    def test_bulk_screening_persists_dilisense_sanction_flags(self):
        customer = Customer.objects.create(
            customer_id='C-DILI-001',
            customer_type='INDIVIDUAL',
            first_name='Sanctioned',
            last_name='Person',
            is_active=True,
        )
        dilisense_match = {
            'type': 'Sanctions List',
            'source': 'Dilisense',
            'entry_id': 'dilisense-123',
            'matched_name': 'Sanctioned Person',
            'similarity': None,
            'details': {'program': 'Unit Test Sanctions'},
        }

        view = ScreeningViewSet.as_view({'post': 'run_screening'})
        request = APIRequestFactory().post('/api/screening/run_screening/', {}, format='json')

        with patch.object(
            ScreeningViewSet,
            '_run_dilisense_screening',
            return_value=([dilisense_match], {'status': 'SEARCHED'}),
        ):
            response = view(request)

        self.assertEqual(response.status_code, 200)
        customer.refresh_from_db()
        self.assertTrue(customer.is_sanctioned)
        self.assertEqual(customer.risk_level, 'CRITICAL')
        self.assertIn('Sanctioned Person', customer.sanction_details)
        self.assertEqual(ScreeningMatch.objects.filter(customer=customer).count(), 1)
        self.assertTrue(WatchlistSource.objects.filter(name='Dilisense', source_type='SANCTIONS').exists())
