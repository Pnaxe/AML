from decimal import Decimal
import logging
from random import choice, randint, random
from uuid import uuid4

try:
    from asgiref.sync import async_to_sync
except ModuleNotFoundError:
    async_to_sync = None

try:
    from celery import shared_task
except ModuleNotFoundError:
    def shared_task(*args, **kwargs):
        def decorator(func):
            return func
        return decorator

try:
    from channels.layers import get_channel_layer
except ModuleNotFoundError:
    def get_channel_layer():
        return None

from django.utils import timezone
from faker import Faker

from accounts.models import Customer

from .consumers import TRANSACTIONS_STREAM_GROUP
from .models import Transaction, TransactionDataSource


logger = logging.getLogger(__name__)
fake = Faker()

ZIM_FIRST_NAMES = [
    'Tafadzwa',
    'Panashe',
    'Nyasha',
    'Tinotenda',
    'Rumbidzai',
    'Tadiwa',
    'Kudzai',
    'Anesu',
]

ZIM_LAST_NAMES = [
    'Moyo',
    'Ndlovu',
    'Sibanda',
    'Dube',
    'Mukuruva',
    'Chigumba',
    'Mlambo',
    'Mpofu',
]

GLOBAL_MERCHANTS = [
    'Amazon Marketplace',
    'Netflix',
    'Apple Services',
    'Uber BV',
    'Microsoft Azure',
    'Shopify Payments',
    'Mukuru',
    'WorldRemit',
]

ZIM_CITIES = ['Harare', 'Bulawayo', 'Mutare', 'Gweru', 'Masvingo']
COUNTRY_OPTIONS = [
    ('Zimbabwe', 'South Africa'),
    ('Zimbabwe', 'Botswana'),
    ('Zimbabwe', 'United Kingdom'),
    ('Zimbabwe', 'Kenya'),
    ('South Africa', 'Zimbabwe'),
]
CURRENCY_OPTIONS = ['ZWL', 'USD', 'ZAR', 'GBP', 'BWP']
CHANNEL_OPTIONS = ['MOBILE', 'ONLINE', 'BRANCH', 'ATM', 'POS']


def _normalized_status(transaction):
    return transaction.stream_status


def build_transaction_stream_payload(transaction):
    payload = transaction.to_stream_payload()
    payload['status'] = _normalized_status(transaction)
    return payload


def broadcast_transaction_update(transaction):
    if async_to_sync is None:
        return

    channel_layer = get_channel_layer()
    if channel_layer is None:
        return

    try:
        async_to_sync(channel_layer.group_send)(
            TRANSACTIONS_STREAM_GROUP,
            {
                'type': 'transaction.message',
                'payload': build_transaction_stream_payload(transaction),
            },
        )
    except Exception as exc:
        logger.warning(
            'Failed to broadcast transaction %s to websocket clients: %s',
            transaction.transaction_id,
            exc,
        )


def _ensure_seed_customers():
    active_customers = list(Customer.objects.filter(is_active=True)[:10])
    if len(active_customers) >= 2:
        return active_customers

    for _ in range(2 - len(active_customers)):
        first_name = choice(ZIM_FIRST_NAMES)
        last_name = choice(ZIM_LAST_NAMES)
        customer = Customer.objects.create(
            customer_id=f"CUST-{uuid4().hex[:8].upper()}",
            customer_type='INDIVIDUAL',
            first_name=first_name,
            last_name=last_name,
            email=f"{first_name.lower()}.{last_name.lower()}@example.co.zw",
            phone_number=f"+26377{randint(1000000, 9999999)}",
            address=fake.street_address(),
            city=choice(ZIM_CITIES),
            country='Zimbabwe',
            risk_level=choice(['LOW', 'MEDIUM']),
            is_active=True,
        )
        active_customers.append(customer)

    return active_customers


def _pick_banks():
    sources = list(TransactionDataSource.objects.filter(is_active=True).order_by('name')[:10])
    if sources:
        sender_source = choice(sources)
        receiver_source = choice(sources)
        return sender_source.name, receiver_source.name

    fallback_banks = [
        'CBZ Bank',
        'Steward Bank',
        'Stanbic Bank Zimbabwe',
        'NMB Bank',
        'FBC Bank',
    ]
    return choice(fallback_banks), choice(fallback_banks)


def _pick_transaction_type():
    weighted_types = (
        ['TRANSFER'] * 4
        + ['PAYMENT'] * 3
        + ['WIRE'] * 2
        + ['DEPOSIT'] * 2
        + ['CARD'] * 2
        + ['WITHDRAWAL']
    )
    return choice(weighted_types)


def _pick_status():
    roll = random()
    if roll < 0.78:
        return 'COMPLETED'
    if roll < 0.9:
        return 'PENDING'
    if roll < 0.96:
        return 'FAILED'
    return 'FLAGGED'


@shared_task(name='transactions.tasks.generate_and_stream_transaction')
def generate_and_stream_transaction():
    customers = _ensure_seed_customers()
    sender = choice(customers)
    receiver_candidates = [customer for customer in customers if customer.id != sender.id]
    receiver = choice(receiver_candidates) if receiver_candidates else None

    originating_country, destination_country = choice(COUNTRY_OPTIONS)
    sender_bank, receiver_bank = _pick_banks()
    transaction_type = _pick_transaction_type()
    status = _pick_status()
    amount = Decimal(str(round(fake.pyfloat(left_digits=5, right_digits=2, positive=True, min_value=5, max_value=25000), 2)))
    currency = choice(CURRENCY_OPTIONS)
    now = timezone.now()

    transaction = Transaction.objects.create(
        transaction_id=f"TXN-{now.strftime('%Y%m%d%H%M%S')}-{uuid4().hex[:6].upper()}",
        reference_number=f"REF-{fake.bothify(text='??########').upper()}",
        transaction_type=transaction_type,
        amount=amount,
        currency=currency,
        sender=sender,
        receiver=receiver,
        originating_country=originating_country,
        destination_country=destination_country,
        sender_account=fake.numerify(text='26##########'),
        receiver_account=fake.numerify(text='41##########') if receiver else '',
        sender_bank=sender_bank,
        receiver_bank=receiver_bank if receiver else choice(GLOBAL_MERCHANTS),
        description=fake.sentence(nb_words=8),
        status=status,
        transaction_date=now,
        channel=choice(CHANNEL_OPTIONS),
        device_id=f"DEV-{uuid4().hex[:10].upper()}",
        risk_score=round(random(), 2),
        is_suspicious=status in {'FLAGGED', 'BLOCKED'} or amount >= Decimal('10000.00'),
        amount_threshold_flag=amount >= Decimal('10000.00'),
        high_risk_country_flag=destination_country not in {'Zimbabwe', 'South Africa'},
        unusual_pattern_flag=random() > 0.82,
        velocity_flag=random() > 0.88,
        structuring_flag=random() > 0.9,
    )

    broadcast_transaction_update(transaction)
    return build_transaction_stream_payload(transaction)
