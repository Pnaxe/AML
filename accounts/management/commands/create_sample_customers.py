"""
Django management command to create sample customers for development
"""
from django.core.management.base import BaseCommand
from accounts.models import Customer
from datetime import date, timedelta
import random


class Command(BaseCommand):
    help = 'Creates sample customers for development and testing'

    def add_arguments(self, parser):
        parser.add_argument(
            '--count',
            type=int,
            default=50,
            help='Number of customers to create (default: 50)',
        )
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Clear existing customers before creating new ones',
        )

    def handle(self, *args, **options):
        count = options['count']
        clear = options['clear']
        
        if clear:
            Customer.objects.all().delete()
            self.stdout.write(self.style.WARNING('Cleared all existing customers'))
        
        # Get existing customer IDs to avoid duplicates
        existing_ids = set(Customer.objects.values_list('customer_id', flat=True))
        
        # Sample data
        first_names = ['John', 'Jane', 'Michael', 'Sarah', 'David', 'Emily', 'Robert', 'Jessica', 
                      'William', 'Ashley', 'James', 'Amanda', 'Christopher', 'Melissa', 'Daniel', 'Nicole',
                      'Matthew', 'Elizabeth', 'Joseph', 'Michelle', 'Andrew', 'Kimberly', 'Ryan', 'Amy',
                      'Joshua', 'Angela', 'Kevin', 'Stephanie', 'Brian', 'Rebecca', 'George', 'Laura',
                      'Edward', 'Sharon', 'Ronald', 'Cynthia', 'Timothy', 'Kathleen', 'Jason', 'Anna',
                      'Jeffrey', 'Lisa', 'Ryan', 'Nancy', 'Jacob', 'Betty', 'Gary', 'Helen', 'Nicholas', 'Sandra']
        last_names = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
                     'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Wilson', 'Anderson', 'Thomas', 'Taylor',
                     'Moore', 'Jackson', 'Martin', 'Lee', 'Thompson', 'White', 'Harris', 'Sanchez',
                     'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker', 'Young', 'Allen', 'King',
                     'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores', 'Green', 'Adams',
                     'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell', 'Carter', 'Roberts']
        company_names = ['TechCorp', 'Global Industries', 'Finance Solutions', 'Digital Ventures', 
                        'Enterprise Systems', 'Innovation Labs', 'Business Partners', 'Strategic Group',
                        'Alpha Financial', 'Beta Trading', 'Gamma Holdings', 'Delta Investments',
                        'Omega Capital', 'Prime Solutions', 'Elite Banking', 'Premium Services',
                        'Advanced Technologies', 'Modern Finance', 'Future Capital', 'Smart Investments']
        countries = ['United States', 'United Kingdom', 'Canada', 'Australia', 'Germany', 'France', 
                    'Japan', 'Singapore', 'Switzerland', 'Netherlands', 'Italy', 'Spain', 'Brazil',
                    'Mexico', 'India', 'China', 'South Korea', 'UAE', 'Saudi Arabia', 'South Africa']
        cities = ['New York', 'London', 'Toronto', 'Sydney', 'Berlin', 'Paris', 'Tokyo', 'Singapore', 
                 'Zurich', 'Amsterdam', 'Los Angeles', 'Chicago', 'Houston', 'Miami', 'San Francisco',
                 'Boston', 'Seattle', 'Vancouver', 'Melbourne', 'Munich', 'Madrid', 'Rome', 'São Paulo',
                 'Mexico City', 'Mumbai', 'Shanghai', 'Seoul', 'Dubai', 'Riyadh', 'Cape Town']
        
        risk_levels = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
        customer_types = ['INDIVIDUAL', 'CORPORATE']
        
        created = 0
        base_id = 1000
        
        for i in range(count):
            customer_type = random.choice(customer_types)
            
            # Generate unique customer ID
            if customer_type == 'INDIVIDUAL':
                first_name = random.choice(first_names)
                last_name = random.choice(last_names)
                customer_id = f"CUST-IND-{base_id + i:04d}"
                # Ensure unique ID
                while customer_id in existing_ids:
                    base_id += 1
                    customer_id = f"CUST-IND-{base_id + i:04d}"
                existing_ids.add(customer_id)
                
                customer = Customer.objects.create(
                    customer_id=customer_id,
                    customer_type=customer_type,
                    first_name=first_name,
                    last_name=last_name,
                    email=f"{first_name.lower()}.{last_name.lower()}@example.com",
                    phone_number=f"+1-{random.randint(200, 999)}-{random.randint(200, 999)}-{random.randint(1000, 9999)}",
                    address=f"{random.randint(100, 9999)} Main Street",
                    city=random.choice(cities),
                    country=random.choice(countries),
                    postal_code=f"{random.randint(10000, 99999)}",
                    risk_level=random.choice(risk_levels),
                    risk_score=random.uniform(0.0, 1.0),
                    is_pep=random.choice([True, False]) if random.random() < 0.15 else False,
                    is_sanctioned=False,
                    kyc_verified=random.choice([True, False]),
                )
            else:  # CORPORATE
                company_name = f"{random.choice(company_names)} {random.choice(['Inc.', 'Ltd.', 'LLC', 'Corp.'])}"
                customer_id = f"CUST-CORP-{base_id + i:04d}"
                # Ensure unique ID
                while customer_id in existing_ids:
                    base_id += 1
                    customer_id = f"CUST-CORP-{base_id + i:04d}"
                existing_ids.add(customer_id)
                
                customer = Customer.objects.create(
                    customer_id=customer_id,
                    customer_type=customer_type,
                    company_name=company_name,
                    registration_number=f"REG-{random.randint(100000, 999999)}",
                    email=f"contact@{company_name.lower().replace(' ', '').replace('.', '')}.com",
                    phone_number=f"+1-{random.randint(200, 999)}-{random.randint(200, 999)}-{random.randint(1000, 9999)}",
                    address=f"{random.randint(100, 9999)} Business Park",
                    city=random.choice(cities),
                    country=random.choice(countries),
                    postal_code=f"{random.randint(10000, 99999)}",
                    risk_level=random.choice(risk_levels),
                    risk_score=random.uniform(0.0, 1.0),
                    is_pep=False,
                    is_sanctioned=random.choice([True, False]) if random.random() < 0.05 else False,
                    kyc_verified=random.choice([True, False]),
                )
            
            created += 1
        
        self.stdout.write(
            self.style.SUCCESS(f'Successfully created {created} sample customers!')
        )

