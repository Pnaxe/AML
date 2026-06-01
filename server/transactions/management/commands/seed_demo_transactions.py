from datetime import timedelta
from decimal import Decimal
import random

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.db.models import Count
from django.utils import timezone

from accounts.models import Customer
from alerts.models import Alert
from transactions.models import Transaction


class Command(BaseCommand):
    help = "Seed customers and a mixed transaction dataset directly into the database."

    zim_first_names = [
        "Tawanda", "Nyasha", "Tendai", "Rudo", "Kudakwashe", "Farai", "Tatenda",
        "Chipo", "Memory", "Blessing", "Panashe", "Anesu", "Tapiwa", "Shamiso",
        "Simbarashe", "Tinashe", "Kudzai", "Rufaro", "Munashe", "Nokutenda",
        "Sipho", "Nomalanga", "Thabani", "Nqobile", "Sibusisiwe", "Lerato",
    ]
    zim_last_names = [
        "Moyo", "Ndlovu", "Sibanda", "Dube", "Chirisa", "Mugabe", "Mawere",
        "Chimedza", "Mutasa", "Mushonga", "Gumbo", "Mutsvangwa", "Mupfumi",
        "Matema", "Nyoni", "Mpofu", "Chikanda", "Mashingaidze", "Madziva",
        "Makoni", "Chiwenga", "Hove", "Chari", "Zhou",
    ]
    world_names = [
        ("James", "Smith", "United States"),
        ("Emma", "Wilson", "United Kingdom"),
        ("Aarav", "Sharma", "India"),
        ("Wei", "Chen", "China"),
        ("Luca", "Rossi", "Italy"),
        ("Sofia", "Garcia", "Spain"),
        ("Noah", "Muller", "Germany"),
        ("Amina", "Khan", "UAE"),
        ("Thabo", "Mokoena", "South Africa"),
        ("Marie", "Dubois", "France"),
        ("Hana", "Kim", "South Korea"),
        ("Yuki", "Tanaka", "Japan"),
    ]
    zim_cities = [
        "Harare", "Bulawayo", "Mutare", "Gweru", "Masvingo", "Kwekwe",
        "Kadoma", "Chinhoyi", "Marondera", "Victoria Falls", "Bindura",
    ]
    world_cities = [
        "London", "New York", "Johannesburg", "Dubai", "Mumbai", "Beijing",
        "Berlin", "Paris", "Toronto", "Singapore", "Tokyo", "Sydney",
    ]
    zim_companies = [
        "Harare Mining Holdings", "Zambezi Agro Exports", "Mbare Traders",
        "Bulawayo Engineering", "Mutare Timber Works", "Great Zimbabwe Foods",
        "Victoria Falls Hospitality", "Mashonaland Logistics", "Matabeleland Finance",
        "Sable Textiles", "Borrowdale Capital", "Chitungwiza Retail Group",
    ]
    world_companies = [
        "Global Meridian Trading", "BlueBridge Capital", "Northstar Logistics",
        "Apex Digital Markets", "Greenfield Energy", "Atlas Commodity Partners",
        "Pacific Crown Holdings", "EuroLink Payments",
    ]
    banks = [
        "CBZ Bank", "Steward Bank", "FBC Bank", "Stanbic Bank Zimbabwe",
        "BancABC Zimbabwe", "Ecobank Zimbabwe", "Standard Chartered",
        "Nedbank", "Absa", "HSBC", "Barclays", "Citibank",
    ]
    channels = ["ONLINE", "MOBILE", "BRANCH", "ATM", "WIRE", "CARD", "CASH"]
    transaction_types = ["DEPOSIT", "WITHDRAWAL", "TRANSFER", "PAYMENT", "WIRE", "ATM", "CARD", "CRYPTO"]
    normal_countries = [
        "Zimbabwe", "South Africa", "Botswana", "Zambia", "Mozambique", "United Kingdom",
        "United States", "China", "India", "UAE", "Germany", "Canada", "Singapore",
    ]
    high_risk_countries = ["IR", "KP", "SY", "YE", "MM", "RU", "AF"]

    def add_arguments(self, parser):
        parser.add_argument("--count", type=int, default=20_000)
        parser.add_argument("--customers", type=int, default=2_000)
        parser.add_argument("--batch-size", type=int, default=10_000)
        parser.add_argument("--alert-sample", type=int, default=500)
        parser.add_argument("--prefix", default="AML2026")
        parser.add_argument("--clear-demo", action="store_true")

    def handle(self, *args, **options):
        count = options["count"]
        customer_count = options["customers"]
        batch_size = options["batch_size"]
        prefix = options["prefix"]
        alert_sample = options["alert_sample"]

        if options["clear_demo"]:
            self._clear_demo(prefix)

        self._ensure_demo_customers(prefix, customer_count, batch_size)
        customers = list(
            Customer.objects.filter(customer_id__startswith=f"{prefix}-CUST-")
            .values("id", "customer_type", "country", "risk_level", "is_pep", "is_sanctioned")
        )
        if len(customers) < 2:
            raise CommandError("At least two demo customers are required.")

        by_risk = {
            level: [c for c in customers if c["risk_level"] == level]
            for level in ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
        }
        suspicious_alert_ids = []
        base_time = timezone.now()
        created = 0

        self.stdout.write(f"Seeding {count:,} transactions in batches of {batch_size:,}...")
        for start in range(0, count, batch_size):
            end = min(start + batch_size, count)
            rows = []
            for index in range(start, end):
                suspicious_kind = self._suspicious_kind(index)
                tx = self._make_transaction(prefix, index, customers, by_risk, base_time, suspicious_kind)
                rows.append(tx)

            Transaction.objects.bulk_create(rows, batch_size=batch_size)
            created += len(rows)

            if alert_sample and len(suspicious_alert_ids) < alert_sample:
                room = alert_sample - len(suspicious_alert_ids)
                suspicious_alert_ids.extend(
                    tx.transaction_id for tx in rows if tx.is_suspicious
                )
                suspicious_alert_ids = suspicious_alert_ids[:alert_sample]

            if created % max(batch_size * 5, 1) == 0 or created == count:
                self.stdout.write(f"Created {created:,}/{count:,} transactions")

        if alert_sample:
            self._create_alert_sample(prefix, suspicious_alert_ids)

        self._print_summary(prefix)

    def _clear_demo(self, prefix):
        self.stdout.write("Clearing existing demo transactions, alerts, and customers...")
        tx_ids = Transaction.objects.filter(transaction_id__startswith=f"{prefix}-TX-").values_list("id", flat=True)
        Alert.transactions.through.objects.filter(transaction_id__in=tx_ids).delete()
        Alert.objects.filter(alert_id__startswith=f"{prefix}-ALERT-").delete()
        Transaction.objects.filter(transaction_id__startswith=f"{prefix}-TX-").delete()
        Customer.objects.filter(customer_id__startswith=f"{prefix}-CUST-").delete()

    def _ensure_demo_customers(self, prefix, target_count, batch_size):
        existing = Customer.objects.filter(customer_id__startswith=f"{prefix}-CUST-").count()
        if existing >= target_count:
            self.stdout.write(f"Using existing {existing:,} customers.")
            return

        self.stdout.write(f"Creating {target_count - existing:,} customers...")
        now = timezone.now()
        rows = []
        for index in range(existing, target_count):
            rows.append(self._make_customer(prefix, index, now))
            if len(rows) >= batch_size:
                Customer.objects.bulk_create(rows, batch_size=batch_size)
                rows = []
        if rows:
            Customer.objects.bulk_create(rows, batch_size=batch_size)

    def _make_customer(self, prefix, index, now):
        customer_id = f"{prefix}-CUST-{index + 1:06d}"
        is_corporate = index % 5 == 0
        is_world = index % 10 == 0
        is_pep = index % 97 == 0
        is_sanctioned = index % 389 == 0
        risk_level = "LOW"
        risk_score = 0.18
        if is_sanctioned:
            risk_level, risk_score = "CRITICAL", 0.94
        elif is_pep or index % 41 == 0:
            risk_level, risk_score = "HIGH", 0.78
        elif index % 13 == 0:
            risk_level, risk_score = "MEDIUM", 0.48

        if is_corporate:
            company = random.choice(self.world_companies if is_world else self.zim_companies)
            country = random.choice(self.normal_countries[1:] if is_world else ["Zimbabwe"])
            city = random.choice(self.world_cities if is_world else self.zim_cities)
            return Customer(
                customer_id=customer_id,
                customer_type="CORPORATE",
                company_name=f"{company} {index + 1}",
                registration_number=f"REG-{prefix}-{index + 1:06d}",
                email=f"accounts{index + 1}@zimfinance.co.zw",
                phone_number=f"+2637{random.randint(10000000, 99999999)}",
                address=f"{random.randint(1, 999)} Enterprise Park",
                city=city,
                country=country,
                postal_code=f"{random.randint(1000, 9999)}",
                risk_level=risk_level,
                risk_score=risk_score,
                is_pep=is_pep,
                pep_details="Politically exposed entity relationship" if is_pep else "",
                is_sanctioned=is_sanctioned,
                sanction_details="Sanctions screening match" if is_sanctioned else "",
                kyc_verified=not is_sanctioned,
                kyc_verification_date=now if not is_sanctioned else None,
                kyc_document_type="Company Registration",
                created_at=now,
                updated_at=now,
                is_active=True,
            )

        if is_world:
            first, last, country = random.choice(self.world_names)
            city = random.choice(self.world_cities)
        else:
            first = random.choice(self.zim_first_names)
            last = random.choice(self.zim_last_names)
            country = "Zimbabwe"
            city = random.choice(self.zim_cities)

        return Customer(
            customer_id=customer_id,
            customer_type="INDIVIDUAL",
            first_name=first,
            last_name=last,
            date_of_birth=timezone.now().date() - timedelta(days=random.randint(21 * 365, 68 * 365)),
            email=f"{first.lower()}.{last.lower()}{index + 1}@mail.co.zw",
            phone_number=f"+2637{random.randint(10000000, 99999999)}",
            address=f"{random.randint(1, 999)} {city} Road",
            city=city,
            country=country,
            postal_code=f"{random.randint(1000, 9999)}",
            risk_level=risk_level,
            risk_score=risk_score,
            is_pep=is_pep,
            pep_details="Politically exposed person profile" if is_pep else "",
            is_sanctioned=is_sanctioned,
            sanction_details="Sanctions screening match" if is_sanctioned else "",
            kyc_verified=not is_sanctioned,
            kyc_verification_date=now if not is_sanctioned else None,
            kyc_document_type="National ID",
            created_at=now,
            updated_at=now,
            is_active=True,
        )

    def _suspicious_kind(self, index):
        if index % 997 == 0:
            return "SANCTION"
        if index % 251 == 0:
            return "HIGH_RISK_COUNTRY"
        if index % 173 == 0:
            return "STRUCTURING"
        if index % 137 == 0:
            return "VELOCITY"
        if index % 89 == 0:
            return "ROUND_AMOUNT"
        if index % 53 == 0:
            return "THRESHOLD"
        return None

    def _make_transaction(self, prefix, index, customers, by_risk, base_time, suspicious_kind):
        sender_pool = by_risk["HIGH"] + by_risk["CRITICAL"] if suspicious_kind in {"SANCTION", "THRESHOLD"} else customers
        sender = random.choice(sender_pool or customers)
        receiver = random.choice(customers)
        if receiver["id"] == sender["id"]:
            receiver = random.choice(customers)

        tx_type = random.choice(self.transaction_types)
        amount = self._amount_for(tx_type, suspicious_kind, index)
        origin = sender["country"] or "Zimbabwe"
        destination = receiver["country"] or random.choice(self.normal_countries)
        flags = {
            "velocity_flag": suspicious_kind == "VELOCITY",
            "structuring_flag": suspicious_kind == "STRUCTURING",
            "unusual_pattern_flag": suspicious_kind == "ROUND_AMOUNT",
            "high_risk_country_flag": suspicious_kind == "HIGH_RISK_COUNTRY",
            "amount_threshold_flag": suspicious_kind in {"THRESHOLD", "SANCTION"} or amount >= Decimal("10000.00"),
        }
        if suspicious_kind == "HIGH_RISK_COUNTRY":
            destination = random.choice(self.high_risk_countries)

        suspicious = suspicious_kind is not None or sender["is_pep"] or sender["is_sanctioned"]
        risk_score = self._risk_score(suspicious_kind, sender)
        status = "FLAGGED" if suspicious else random.choices(
            ["COMPLETED", "CLEARED", "PENDING", "FAILED"], weights=[78, 12, 8, 2], k=1
        )[0]
        days_ago = random.randint(0, 180)
        tx_date = base_time - timedelta(days=days_ago, hours=random.randint(0, 23), minutes=random.randint(0, 59))
        now = timezone.now()

        return Transaction(
            transaction_id=f"{prefix}-TX-{index + 1:09d}",
            reference_number=f"{prefix}-REF-{index + 1:09d}",
            transaction_type=tx_type,
            amount=amount,
            currency=random.choices(["USD", "ZWL", "ZAR", "GBP", "EUR"], weights=[54, 24, 12, 5, 5], k=1)[0],
            sender_id=sender["id"],
            receiver_id=receiver["id"] if tx_type in {"TRANSFER", "WIRE", "PAYMENT", "CRYPTO"} else None,
            originating_country=origin,
            destination_country=destination,
            sender_account=f"ZW{random.randint(1000000000, 9999999999)}",
            receiver_account=f"ZW{random.randint(1000000000, 9999999999)}",
            sender_bank=random.choice(self.banks),
            receiver_bank=random.choice(self.banks),
            description=self._description(tx_type, suspicious_kind),
            status=status,
            transaction_date=tx_date,
            created_at=now,
            updated_at=now,
            risk_score=risk_score,
            is_suspicious=suspicious,
            ip_address=f"10.{random.randint(0, 255)}.{random.randint(0, 255)}.{random.randint(1, 254)}",
            device_id=f"DEV-{random.randint(100000, 999999)}",
            channel=random.choice(self.channels),
            **flags,
        )

    def _amount_for(self, tx_type, suspicious_kind, index):
        if suspicious_kind == "STRUCTURING":
            return Decimal(str(9000 + (index % 900))).quantize(Decimal("0.01"))
        if suspicious_kind == "ROUND_AMOUNT":
            return Decimal(random.choice([5000, 10000, 15000, 25000, 50000])).quantize(Decimal("0.01"))
        if suspicious_kind in {"THRESHOLD", "SANCTION", "HIGH_RISK_COUNTRY"}:
            return Decimal(random.randint(10000, 250000)).quantize(Decimal("0.01"))
        if tx_type == "WIRE":
            return Decimal(random.randint(500, 35000)).quantize(Decimal("0.01"))
        if tx_type == "CRYPTO":
            return Decimal(random.randint(50, 18000)).quantize(Decimal("0.01"))
        if tx_type in {"DEPOSIT", "WITHDRAWAL"}:
            return Decimal(random.randint(20, 12000)).quantize(Decimal("0.01"))
        return Decimal(random.randint(5, 7500)).quantize(Decimal("0.01"))

    def _risk_score(self, suspicious_kind, sender):
        if sender["is_sanctioned"] or suspicious_kind == "SANCTION":
            return round(random.uniform(0.91, 0.99), 3)
        if suspicious_kind:
            return round(random.uniform(0.72, 0.92), 3)
        if sender["is_pep"] or sender["risk_level"] in {"HIGH", "CRITICAL"}:
            return round(random.uniform(0.48, 0.75), 3)
        return round(random.uniform(0.02, 0.38), 3)

    def _description(self, tx_type, suspicious_kind):
        if suspicious_kind == "STRUCTURING":
            return "Structuring pattern: repeated deposits below reporting threshold"
        if suspicious_kind == "HIGH_RISK_COUNTRY":
            return "High-risk jurisdiction transfer"
        if suspicious_kind == "VELOCITY":
            return "Velocity pattern: frequent customer activity"
        if suspicious_kind == "ROUND_AMOUNT":
            return "Large round-number transaction"
        if suspicious_kind == "SANCTION":
            return "Sanctioned or critical-risk customer activity"
        return f"{tx_type.title()} transaction"

    def _create_alert_sample(self, prefix, transaction_ids):
        if not transaction_ids:
            return
        self.stdout.write(f"Creating alert sample for {len(transaction_ids):,} suspicious transactions...")
        txs = list(
            Transaction.objects.filter(transaction_id__in=transaction_ids)
            .values("id", "transaction_id", "sender_id", "risk_score", "structuring_flag", "velocity_flag",
                    "high_risk_country_flag", "amount_threshold_flag", "unusual_pattern_flag")
        )
        now = timezone.now()
        alerts = []
        alert_links = []
        for idx, tx in enumerate(txs, start=1):
            alert_type = "THRESHOLD"
            if tx["structuring_flag"]:
                alert_type = "STRUCTURING"
            elif tx["velocity_flag"]:
                alert_type = "VELOCITY"
            elif tx["high_risk_country_flag"]:
                alert_type = "HIGH_RISK_COUNTRY"
            elif tx["unusual_pattern_flag"]:
                alert_type = "ROUND_AMOUNT"
            severity = "CRITICAL" if tx["risk_score"] >= 0.9 else "HIGH"
            alert_id = f"{prefix}-ALERT-{idx:06d}"
            alerts.append(Alert(
                alert_id=alert_id,
                alert_type=alert_type,
                severity=severity,
                status="NEW",
                customer_id=tx["sender_id"],
                title=f"{alert_type} alert - {tx['transaction_id']}",
                description="Alert generated from transaction monitoring rules.",
                risk_score=tx["risk_score"],
                ml_confidence=0.85,
                ml_features={"seeded_record": True, "alert_type": alert_type},
                priority=1 if severity == "CRITICAL" else 2,
                triggered_at=now,
                updated_at=now,
            ))
            alert_links.append((alert_id, tx["id"]))
        Alert.objects.bulk_create(alerts, batch_size=1_000)
        alert_pk_by_alert_id = dict(
            Alert.objects.filter(alert_id__in=[alert_id for alert_id, _ in alert_links])
            .values_list("alert_id", "id")
        )
        through_rows = []
        for alert_id, tx_id in alert_links:
            alert_pk = alert_pk_by_alert_id.get(alert_id)
            if alert_pk:
                through_rows.append(Alert.transactions.through(alert_id=alert_pk, transaction_id=tx_id))
        Alert.transactions.through.objects.bulk_create(through_rows, batch_size=1_000)

    def _print_summary(self, prefix):
        tx_qs = Transaction.objects.filter(transaction_id__startswith=f"{prefix}-TX-")
        cust_qs = Customer.objects.filter(customer_id__startswith=f"{prefix}-CUST-")
        self.stdout.write(self.style.SUCCESS("Seed complete."))
        self.stdout.write(f"Customers: {cust_qs.count():,}")
        self.stdout.write(f"Transactions: {tx_qs.count():,}")
        self.stdout.write(f"Suspicious transactions: {tx_qs.filter(is_suspicious=True).count():,}")
        self.stdout.write(f"Alerts: {Alert.objects.filter(alert_id__startswith=f'{prefix}-ALERT-').count():,}")
        self.stdout.write(f"Customer countries: {list(cust_qs.values('country').annotate(c=Count('id')).order_by('-c')[:8])}")
        self.stdout.write(f"Transaction flags: {list(tx_qs.values('status').annotate(c=Count('id')).order_by('-c'))}")
