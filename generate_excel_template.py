"""
Standalone script to generate Excel template for transaction import
Run with: python generate_excel_template.py
"""
import os
import sys
import django

# Setup Django
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'aml_system.settings')
django.setup()

from accounts.models import Customer
from transactions.models import Transaction
from datetime import datetime, timedelta
import pandas as pd
import random

def main():
    # Get active customers from database
    customers = list(Customer.objects.filter(is_active=True))
    
    if not customers:
        print("ERROR: No active customers found.")
        print("Please create customers first using: python manage.py create_sample_customers")
        return
    
    if len(customers) < 2:
        print("WARNING: Only one customer found. Some transaction types require a receiver.")
    
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
    num_rows = 20
    
    # Get existing transaction IDs to avoid duplicates
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
    output_file = 'transaction_import_template.xlsx'
    df.to_excel(output_file, index=False, sheet_name='Transactions')
    
    print(f'\n✓ Excel template created: {output_file}')
    print(f'\nTotal rows: {len(df)}')
    print(f'\nColumn structure:')
    for i, col in enumerate(df.columns, 1):
        required = "✓ REQUIRED" if col in ['transaction_id', 'transaction_type', 'amount', 'sender_customer_id', 'transaction_date'] else "Optional"
        print(f"  {i:2d}. {col:25s} - {required}")
    
    print('\n' + '='*80)
    print('IMPORTANT NOTES:')
    print('='*80)
    print('1. All customer IDs in this template are from your database')
    print('2. Transaction types must be one of:')
    print('   DEPOSIT, WITHDRAWAL, TRANSFER, PAYMENT, WIRE, ATM, CHECK, CARD, CRYPTO, OTHER')
    print('3. Status must be one of:')
    print('   PENDING, COMPLETED, FAILED, FLAGGED, UNDER_REVIEW, CLEARED, BLOCKED')
    print('4. transaction_date format: YYYY-MM-DD HH:MM:SS (e.g., 2024-01-15 14:30:00)')
    print('5. amount must be greater than 0')
    print('6. transaction_id must be unique (not already in database)')
    print('7. sender_customer_id and receiver_customer_id must exist in your database')
    print('='*80)
    print(f'\nFile location: {os.path.abspath(output_file)}')

if __name__ == '__main__':
    main()

