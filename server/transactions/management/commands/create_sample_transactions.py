"""
Django management command to create sample transactions for development
"""
from django.core.management.base import BaseCommand
from accounts.models import Customer
from transactions.models import Transaction
from datetime import datetime, timedelta
from decimal import Decimal
import random


class Command(BaseCommand):
    help = 'Creates sample transactions for development and testing'

    def add_arguments(self, parser):
        parser.add_argument(
            '--count',
            type=int,
            default=200,
            help='Number of transactions to create (default: 200)',
        )
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Clear existing transactions before creating new ones',
        )

    def handle(self, *args, **options):
        count = options['count']
        clear = options['clear']
        
        if clear:
            Transaction.objects.all().delete()
            self.stdout.write(self.style.WARNING('Cleared all existing transactions'))
        
        # Get all active customers
        customers = list(Customer.objects.filter(is_active=True))
        if not customers:
            self.stdout.write(self.style.ERROR('No active customers found. Please create customers first.'))
            return
        
        # Get existing transaction IDs to avoid duplicates
        existing_ids = set(Transaction.objects.values_list('transaction_id', flat=True))
        
        # Sample data
        transaction_types = ['DEPOSIT', 'WITHDRAWAL', 'TRANSFER', 'PAYMENT', 'WIRE', 'ATM', 'CARD', 'CRYPTO']
        statuses = ['PENDING', 'COMPLETED', 'COMPLETED', 'COMPLETED', 'FLAGGED', 'UNDER_REVIEW', 'CLEARED']
        currencies = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY']
        countries = ['United States', 'United Kingdom', 'Canada', 'Australia', 'Germany', 'France', 
                    'Japan', 'Singapore', 'Switzerland', 'Netherlands', 'Italy', 'Spain', 'Brazil',
                    'Mexico', 'India', 'China', 'South Korea', 'UAE', 'Saudi Arabia', 'South Africa']
        banks = ['Chase Bank', 'Bank of America', 'Wells Fargo', 'Citibank', 'HSBC', 'Barclays',
                'Deutsche Bank', 'BNP Paribas', 'Credit Suisse', 'UBS', 'Standard Chartered']
        channels = ['Online', 'Branch', 'ATM', 'Mobile App', 'Phone Banking', 'Wire Transfer']
        
        created = 0
        base_id = 10000
        
        # Generate transactions over the past 90 days
        end_date = datetime.now()
        start_date = end_date - timedelta(days=90)
        
        for i in range(count):
            # Generate unique transaction ID
            transaction_id = f"TXN-{base_id + i:06d}"
            while transaction_id in existing_ids:
                base_id += 1
                transaction_id = f"TXN-{base_id + i:06d}"
            existing_ids.add(transaction_id)
            
            # Random sender (required)
            sender = random.choice(customers)
            
            # Random receiver (optional, but required for TRANSFER, WIRE, PAYMENT)
            transaction_type = random.choice(transaction_types)
            receiver = None
            if transaction_type in ['TRANSFER', 'WIRE', 'PAYMENT']:
                # Choose a different customer as receiver
                receiver = random.choice([c for c in customers if c.id != sender.id])
            
            # Generate transaction date (random within last 90 days)
            days_ago = random.randint(0, 90)
            hours_ago = random.randint(0, 23)
            minutes_ago = random.randint(0, 59)
            transaction_date = end_date - timedelta(days=days_ago, hours=hours_ago, minutes=minutes_ago)
            
            # Generate amount based on transaction type
            if transaction_type == 'WIRE':
                amount = Decimal(random.uniform(1000, 500000)).quantize(Decimal('0.01'))
            elif transaction_type == 'CRYPTO':
                amount = Decimal(random.uniform(100, 100000)).quantize(Decimal('0.01'))
            elif transaction_type == 'DEPOSIT':
                amount = Decimal(random.uniform(100, 50000)).quantize(Decimal('0.01'))
            elif transaction_type == 'WITHDRAWAL':
                amount = Decimal(random.uniform(50, 10000)).quantize(Decimal('0.01'))
            elif transaction_type == 'ATM':
                amount = Decimal(random.uniform(20, 1000)).quantize(Decimal('0.01'))
            else:
                amount = Decimal(random.uniform(10, 5000)).quantize(Decimal('0.01'))
            
            # Determine status (most are completed)
            status = random.choice(statuses)
            
            # Risk flags (some transactions should be suspicious)
            is_suspicious = random.random() < 0.1  # 10% suspicious
            risk_score = random.uniform(0.0, 1.0)
            if is_suspicious:
                risk_score = random.uniform(0.6, 1.0)  # Higher risk for suspicious
            
            # Generate flags
            velocity_flag = random.random() < 0.05  # 5% have velocity issues
            structuring_flag = random.random() < 0.03  # 3% structuring
            unusual_pattern_flag = random.random() < 0.08  # 8% unusual patterns
            high_risk_country_flag = random.random() < 0.1  # 10% high-risk countries
            amount_threshold_flag = amount > Decimal('10000')  # Flag large amounts
            
            # Countries
            originating_country = sender.country if sender.country else random.choice(countries)
            destination_country = receiver.country if receiver and receiver.country else random.choice(countries)
            
            # Create transaction
            transaction = Transaction.objects.create(
                transaction_id=transaction_id,
                reference_number=f"REF-{random.randint(100000, 999999)}",
                transaction_type=transaction_type,
                amount=amount,
                currency=random.choice(currencies),
                sender=sender,
                receiver=receiver,
                originating_country=originating_country,
                destination_country=destination_country,
                sender_account=f"ACC-{random.randint(100000, 999999)}",
                receiver_account=f"ACC-{random.randint(100000, 999999)}" if receiver else '',
                sender_bank=random.choice(banks),
                receiver_bank=random.choice(banks) if receiver else '',
                description=f"{transaction_type} transaction - {random.choice(['Payment', 'Transfer', 'Purchase', 'Refund', 'Fee', 'Interest'])}",
                status=status,
                transaction_date=transaction_date,
                risk_score=risk_score,
                is_suspicious=is_suspicious,
                velocity_flag=velocity_flag,
                structuring_flag=structuring_flag,
                unusual_pattern_flag=unusual_pattern_flag,
                high_risk_country_flag=high_risk_country_flag,
                amount_threshold_flag=amount_threshold_flag,
                ip_address=f"{random.randint(1, 255)}.{random.randint(1, 255)}.{random.randint(1, 255)}.{random.randint(1, 255)}" if random.random() < 0.7 else None,
                channel=random.choice(channels),
            )
            
            created += 1
            
            # Progress indicator
            if (i + 1) % 50 == 0:
                self.stdout.write(f'Created {i + 1}/{count} transactions...')
        
        self.stdout.write(
            self.style.SUCCESS(f'Successfully created {created} sample transactions!')
        )

