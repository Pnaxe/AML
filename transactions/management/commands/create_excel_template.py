"""
Django management command to create an Excel template file for transaction import
"""
from django.core.management.base import BaseCommand
from accounts.models import Customer
from datetime import datetime, timedelta
import pandas as pd
import random
import os


class Command(BaseCommand):
    help = 'Creates an Excel template file for importing transactions'

    def add_arguments(self, parser):
        parser.add_argument(
            '--output',
            type=str,
            default='transaction_import_template.xlsx',
            help='Output filename (default: transaction_import_template.xlsx)',
        )
        parser.add_argument(
            '--rows',
            type=int,
            default=20,
            help='Number of sample rows to include (default: 20)',
        )

    def handle(self, *args, **options):
        output_file = options['output']
        num_rows = options['rows']
        
        # Get active customers from database
        customers = list(Customer.objects.filter(is_active=True))
        
        if not customers:
            self.stdout.write(
                self.style.ERROR('No active customers found. Please create customers first using: python manage.py create_sample_customers')
            )
            return
        
        if len(customers) < 2:
            self.stdout.write(
                self.style.WARNING('Only one customer found. Some transaction types require a receiver.')
            )
        
        # Get customer IDs
        customer_ids = [c.id for c in customers]
        
        # Sample data
        transaction_types = ['DEPOSIT', 'WITHDRAWAL', 'TRANSFER', 'PAYMENT', 'WIRE', 'ATM', 'CARD', 'CRYPTO']
        statuses = ['PENDING', 'COMPLETED', 'FLAGGED', 'UNDER_REVIEW', 'CLEARED']
        currencies = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD']
        countries = ['United States', 'United Kingdom', 'Canada', 'Australia', 'Germany', 'France', 'Japan', 'Singapore']
        channels = ['Online', 'Branch', 'ATM', 'Mobile App']
        banks = ['Global Bank', 'First National', 'Secure Trust', 'Apex Finance']
        
        # Generate sample transaction data
        sample_data = []
        
        # Get existing transaction IDs to avoid duplicates
        from transactions.models import Transaction
        existing_transaction_ids = set(Transaction.objects.values_list('transaction_id', flat=True))
        base_id = 10000
        
        for i in range(num_rows):
            # Generate unique transaction ID
            transaction_id = f"TXN-IMPORT-{base_id + i:05d}"
            while transaction_id in existing_transaction_ids:
                base_id += 1
                transaction_id = f"TXN-IMPORT-{base_id + i:05d}"
            existing_transaction_ids.add(transaction_id)
            
            transaction_type = random.choice(transaction_types)
            amount = round(random.uniform(10.00, 50000.00), 2)
            currency = random.choice(currencies)
            
            # Select sender (required)
            sender = random.choice(customers)
            sender_customer_id = sender.id
            
            # Select receiver (optional, but required for some transaction types)
            receiver_customer_id = None
            if transaction_type in ['TRANSFER', 'WIRE', 'PAYMENT']:
                # Choose a different customer as receiver
                other_customers = [c for c in customers if c.id != sender.id]
                if other_customers:
                    receiver = random.choice(other_customers)
                    receiver_customer_id = receiver.id
            
            # Generate transaction date (within last 90 days)
            transaction_date = datetime.now() - timedelta(
                days=random.randint(1, 90),
                hours=random.randint(0, 23),
                minutes=random.randint(0, 59)
            )
            
            sample_data.append({
                'transaction_id': transaction_id,
                'reference_number': f"REF-{random.randint(1000000, 9999999)}",
                'transaction_type': transaction_type,
                'amount': amount,
                'currency': currency,
                'sender_customer_id': sender_customer_id,
                'receiver_customer_id': receiver_customer_id if receiver_customer_id else '',
                'originating_country': random.choice(countries),
                'destination_country': random.choice(countries),
                'sender_account': f"ACC-{random.randint(100000000, 999999999)}",
                'receiver_account': f"ACC-{random.randint(100000000, 999999999)}" if receiver_customer_id else '',
                'sender_bank': random.choice(banks),
                'receiver_bank': random.choice(banks) if receiver_customer_id else '',
                'description': f"Payment for {transaction_type.lower()} services",
                'status': random.choice(statuses),
                'transaction_date': transaction_date.strftime('%Y-%m-%d %H:%M:%S'),
                'ip_address': f"{random.randint(1,254)}.{random.randint(1,254)}.{random.randint(1,254)}.{random.randint(1,254)}",
                'device_id': f"DEV-{random.randint(10000, 99999)}",
                'channel': random.choice(channels),
            })
        
        # Create DataFrame
        df = pd.DataFrame(sample_data)
        
        # Reorder columns to match the expected structure
        column_order = [
            'transaction_id',           # Required
            'reference_number',         # Optional
            'transaction_type',         # Required
            'amount',                   # Required
            'currency',                 # Optional (defaults to USD)
            'sender_customer_id',        # Required
            'receiver_customer_id',     # Optional
            'originating_country',      # Optional
            'destination_country',      # Optional
            'sender_account',           # Optional
            'receiver_account',         # Optional
            'sender_bank',              # Optional
            'receiver_bank',            # Optional
            'description',              # Optional
            'status',                   # Optional (defaults to PENDING)
            'transaction_date',         # Required
            'ip_address',               # Optional
            'device_id',                # Optional
            'channel',                  # Optional
        ]
        
        df = df[column_order]
        
        # Save to Excel file
        df.to_excel(output_file, index=False, sheet_name='Transactions')
        
        self.stdout.write(
            self.style.SUCCESS(f'\n✓ Excel template created: {output_file}')
        )
        self.stdout.write(f'\nTotal rows: {len(df)}')
        self.stdout.write(f'\nColumn structure:')
        for i, col in enumerate(df.columns, 1):
            required = "✓ REQUIRED" if col in ['transaction_id', 'transaction_type', 'amount', 'sender_customer_id', 'transaction_date'] else "Optional"
            self.stdout.write(f"  {i:2d}. {col:25s} - {required}")
        
        self.stdout.write('\n' + '='*80)
        self.stdout.write(self.style.WARNING('IMPORTANT NOTES:'))
        self.stdout.write('='*80)
        self.stdout.write('1. All customer IDs in this template are from your database')
        self.stdout.write('2. Transaction types must be one of:')
        self.stdout.write('   DEPOSIT, WITHDRAWAL, TRANSFER, PAYMENT, WIRE, ATM, CHECK, CARD, CRYPTO, OTHER')
        self.stdout.write('3. Status must be one of:')
        self.stdout.write('   PENDING, COMPLETED, FAILED, FLAGGED, UNDER_REVIEW, CLEARED, BLOCKED')
        self.stdout.write('4. transaction_date format: YYYY-MM-DD HH:MM:SS (e.g., 2024-01-15 14:30:00)')
        self.stdout.write('5. amount must be greater than 0')
        self.stdout.write('6. transaction_id must be unique (not already in database)')
        self.stdout.write('7. sender_customer_id and receiver_customer_id must exist in your database')
        self.stdout.write('='*80)
        self.stdout.write(f'\nFile location: {os.path.abspath(output_file)}')

