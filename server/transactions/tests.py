from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIRequestFactory

from accounts.models import Customer
from .models import Transaction
from .views import TransactionViewSet


class TransactionImportTests(TestCase):
    def test_import_reuses_inactive_existing_customer_id(self):
        customer = Customer.objects.create(
            customer_id='CUST00201545',
            customer_type='CORPORATE',
            company_name='Existing Imported Customer',
            is_active=False,
        )
        csv_body = '\n'.join([
            'transaction_id,transaction_type,amount,currency,sender_customer_id,status,transaction_date,description',
            f'TX-DUP-CUSTOMER-1,DEPOSIT,1500,USD,CUST00201545,PENDING,{timezone.now().isoformat()},Import row',
        ])
        upload = SimpleUploadedFile(
            'transactions.csv',
            csv_body.encode('utf-8'),
            content_type='text/csv',
        )
        request = APIRequestFactory().post(
            '/api/transactions/import_excel/',
            {'file': upload},
            format='multipart',
        )
        view = TransactionViewSet.as_view({'post': 'import_excel'})

        with patch('transactions.views.TransactionMonitor.process_transaction', return_value=None):
            response = view(request)

        self.assertEqual(response.status_code, 201)
        self.assertEqual(Customer.objects.filter(customer_id='CUST00201545').count(), 1)
        customer.refresh_from_db()
        self.assertTrue(customer.is_active)
        transaction = Transaction.objects.get(transaction_id='TX-DUP-CUSTOMER-1')
        self.assertEqual(transaction.sender_id, customer.id)
