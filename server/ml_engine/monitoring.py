"""
Real-time transaction monitoring service
"""
from django.db import transaction as db_transaction
from django.db.models import Q, Sum
from django.utils import timezone
from datetime import timedelta
from typing import Dict, List
import logging

from transactions.models import Transaction
from accounts.models import Customer
from alerts.models import Alert, AlertRule
from .models import RiskScore, AnomalyDetection, ModelPrediction
from .ml_service import (
    TransactionRiskScorer,
    AnomalyDetector,
    StructuringDetector,
    MLPredictionEngine
)

logger = logging.getLogger(__name__)


REVIEWABLE_TRANSACTION_Q = (
    Q(is_suspicious=True) |
    Q(status__in=['FLAGGED', 'UNDER_REVIEW', 'BLOCKED']) |
    Q(amount_threshold_flag=True) |
    Q(velocity_flag=True) |
    Q(structuring_flag=True) |
    Q(unusual_pattern_flag=True) |
    Q(high_risk_country_flag=True)
)


class TransactionMonitor:
    """
    Real-time transaction monitoring and alert generation
    """
    
    def __init__(self):
        self.risk_scorer = TransactionRiskScorer()
        self.anomaly_detector = AnomalyDetector()
        self.structuring_detector = StructuringDetector()
        self.ml_engine = MLPredictionEngine()
    
    @db_transaction.atomic
    def process_transaction(self, transaction: Transaction) -> Dict:
        """
        Process a transaction through the AML monitoring pipeline
        Returns a dict with monitoring results and any alerts generated
        """
        results = {
            'transaction_id': transaction.transaction_id,
            'monitoring_complete': False,
            'alerts_generated': [],
            'risk_assessment': None,
            'flags_triggered': [],
            'matched_rules': [],
        }
        
        try:
            # 1. Calculate risk score
            risk_data = self.risk_scorer.calculate_risk_score(transaction)
            results['risk_assessment'] = risk_data
            
            # Update transaction risk score
            transaction.risk_score = risk_data['risk_score']
            transaction.is_suspicious = risk_data['risk_level'] in ['HIGH', 'CRITICAL']
            
            # 2. ML Prediction
            ml_prediction = self.ml_engine.predict_transaction_risk(transaction)
            
            # 3. Run specific checks
            self._check_amount_threshold(transaction, results)
            self._check_velocity(transaction, results)
            self._check_structuring(transaction, results)
            self._check_country_risk(transaction, results)
            self._check_customer_risk_rule(transaction, risk_data, results)
            self._check_dormant_account_activity(transaction, results)
            self._check_cash_ratio(transaction, results)
            self._check_round_amount(transaction, results)
            self._check_rapid_movement(transaction, results)
            self._check_pep_sanction(transaction, results)
            
            if results['flags_triggered'] or transaction.status in {'FLAGGED', 'UNDER_REVIEW', 'BLOCKED'}:
                transaction.is_suspicious = True
                if transaction.status == 'PENDING':
                    transaction.status = 'FLAGGED'

            # 4. Generate alerts if needed
            if transaction.is_suspicious:
                alert = self._generate_alert(transaction, risk_data, results['flags_triggered'])
                results['alerts_generated'].append(alert.alert_id)
            
            # 5. Save risk score
            self._save_risk_score(transaction, risk_data)
            
            # 6. Check for anomalies
            anomalies = self.anomaly_detector.detect_anomalies(transaction.sender)
            if anomalies:
                self._process_anomalies(transaction, anomalies)
            
            transaction.save()
            results['monitoring_complete'] = True
            
        except Exception as e:
            logger.error(f"Error monitoring transaction {transaction.transaction_id}: {str(e)}")
            results['error'] = str(e)
        
        return results
    
    def _check_amount_threshold(self, transaction: Transaction, results: Dict):
        """Check if transaction exceeds amount thresholds"""
        rules = self._active_rules('THRESHOLD')
        if not rules:
            large_transaction_threshold = 10000

            if float(transaction.amount) >= large_transaction_threshold:
                transaction.amount_threshold_flag = True
                results['flags_triggered'].append('AMOUNT_THRESHOLD')
            return

        for rule in rules:
            config = rule.threshold_config or {}
            metric = config.get('metric', 'transaction_amount')
            tx_type = str(config.get('transaction_type', '')).strip().upper()
            if tx_type and transaction.transaction_type != tx_type:
                continue
            threshold_amount = self._float_config(config, 'amount', 10000)
            period_hours = self._int_config(config, 'period_hours', 24)

            triggered = False
            if metric == 'daily_transaction_total':
                since = transaction.transaction_date - timedelta(hours=period_hours)
                query = Transaction.objects.filter(
                    sender=transaction.sender,
                    transaction_date__gte=since,
                    transaction_date__lte=transaction.transaction_date,
                )
                if tx_type:
                    query = query.filter(transaction_type=tx_type)
                total = query.aggregate(total=Sum('amount'))['total'] or 0
                triggered = float(total) >= threshold_amount
            else:
                triggered = float(transaction.amount) >= threshold_amount

            if triggered:
                transaction.amount_threshold_flag = True
                self._append_flag(results, 'AMOUNT_THRESHOLD', rule)
                return
    
    def _check_velocity(self, transaction: Transaction, results: Dict):
        """Check transaction velocity"""
        rules = self._active_rules('VELOCITY')
        if not rules:
            rules = [None]

        for rule in rules:
            config = (rule.threshold_config if rule else {}) or {}
            count_threshold = self._int_config(config, 'count', 10)
            period_hours = self._int_config(config, 'period_hours', 24)
            since = transaction.transaction_date - timedelta(hours=period_hours)
            recent_count = Transaction.objects.filter(
                sender=transaction.sender,
                transaction_date__gte=since,
                transaction_date__lte=transaction.transaction_date,
            ).count()

            if recent_count >= count_threshold:
                transaction.velocity_flag = True
                self._append_flag(results, 'HIGH_VELOCITY', rule)
                return
    
    def _check_structuring(self, transaction: Transaction, results: Dict):
        """Check for structuring patterns"""
        rules = self._active_rules('STRUCTURING')
        if rules:
            for rule in rules:
                config = rule.threshold_config or {}
                reporting_limit = self._float_config(config, 'reporting_limit', 10000)
                below_percent = self._float_config(config, 'below_percent', 90) / 100
                min_transactions = self._int_config(config, 'min_transactions', 3)
                period_hours = self._int_config(config, 'period_hours', 24)
                cutoff_time = transaction.transaction_date - timedelta(hours=period_hours)
                suspicious_transactions = Transaction.objects.filter(
                    sender=transaction.sender,
                    transaction_date__gte=cutoff_time,
                    transaction_date__lte=transaction.transaction_date,
                    amount__lt=reporting_limit,
                    amount__gte=reporting_limit * below_percent,
                )
                total_amount = suspicious_transactions.aggregate(total=Sum('amount'))['total'] or 0
                if suspicious_transactions.count() >= min_transactions and float(total_amount) >= reporting_limit:
                    transaction.structuring_flag = True
                    self._append_flag(results, 'STRUCTURING', rule)
                    return
            return
        else:
            structuring_result = self.structuring_detector.detect_structuring(transaction.sender)

        if structuring_result['is_structuring']:
            transaction.structuring_flag = True
            self._append_flag(results, 'STRUCTURING')
    
    def _check_country_risk(self, transaction: Transaction, results: Dict):
        """Check for high-risk countries"""
        rules = self._active_rules('HIGH_RISK_COUNTRY')
        if not rules:
            rules = [None]

        for rule in rules:
            if rule:
                countries = rule.threshold_config.get('countries', [])
            else:
                countries = self.risk_scorer.HIGH_RISK_COUNTRIES
            if isinstance(countries, str):
                high_risk_countries = [part.strip() for part in countries.split(',') if part.strip()]
            else:
                high_risk_countries = [str(country).strip() for country in countries]

            normalized = {country.upper() for country in high_risk_countries}
            if (transaction.originating_country.upper() in normalized or
                transaction.destination_country.upper() in normalized):
                transaction.high_risk_country_flag = True
                self._append_flag(results, 'HIGH_RISK_COUNTRY', rule)
                return

    def _check_customer_risk_rule(self, transaction: Transaction, risk_data: Dict, results: Dict):
        rules = self._active_rules('OTHER')
        for rule in rules:
            config = rule.threshold_config or {}
            if config.get('metric') != 'customer_risk_level':
                continue
            levels = config.get('risk_levels') or ['HIGH', 'CRITICAL']
            levels = [str(level).upper() for level in levels]
            risk_threshold = self._float_config(config, 'risk_score', 0.4)
            amount_threshold = self._float_config(config, 'amount', 0)
            if (
                transaction.sender.risk_level.upper() in levels and
                (
                    risk_data['risk_score'] >= risk_threshold or
                    (amount_threshold > 0 and float(transaction.amount) >= amount_threshold)
                )
            ):
                transaction.unusual_pattern_flag = True
                self._append_flag(results, 'CUSTOMER_RISK', rule)
                return

    def _check_dormant_account_activity(self, transaction: Transaction, results: Dict):
        rules = [
            rule for rule in self._active_rules('UNUSUAL_PATTERN')
            if (rule.threshold_config or {}).get('metric') == 'dormant_account_activity'
        ]
        if not rules:
            return

        for rule in rules:
            config = rule.threshold_config or {}
            inactive_days = self._int_config(config, 'inactive_days', 90)
            amount_threshold = self._float_config(config, 'amount', 5000)
            cutoff = transaction.transaction_date - timedelta(days=inactive_days)
            previous_activity = Transaction.objects.filter(
                sender=transaction.sender,
                transaction_date__lt=transaction.transaction_date,
                transaction_date__gte=cutoff,
            ).exclude(pk=transaction.pk).exists()

            if not previous_activity and float(transaction.amount) >= amount_threshold:
                transaction.unusual_pattern_flag = True
                self._append_flag(results, 'DORMANT_ACCOUNT', rule)
                return

    def _check_cash_ratio(self, transaction: Transaction, results: Dict):
        rules = self._active_rules('LARGE_CASH')
        if not rules:
            return

        for rule in rules:
            config = rule.threshold_config or {}
            ratio_threshold = self._float_config(config, 'cash_ratio_percent', 70)
            period_days = self._int_config(config, 'period_days', 30)
            cash_types = config.get('cash_transaction_types') or ['DEPOSIT', 'WITHDRAWAL', 'ATM']
            cash_channels = config.get('cash_channels') or ['CASH', 'ATM', 'BRANCH']
            cash_types = [str(item).upper() for item in cash_types]
            cash_channels = [str(item).upper() for item in cash_channels]
            since = transaction.transaction_date - timedelta(days=period_days)
            recent = Transaction.objects.filter(
                sender=transaction.sender,
                transaction_date__gte=since,
                transaction_date__lte=transaction.transaction_date,
            )
            total = recent.count()
            if total == 0:
                continue

            cash_count = recent.filter(
                Q(transaction_type__in=cash_types) | Q(channel__in=cash_channels)
            ).count()
            if (cash_count / total) * 100 >= ratio_threshold:
                transaction.unusual_pattern_flag = True
                self._append_flag(results, 'CASH_RATIO', rule)
                return

    def _check_round_amount(self, transaction: Transaction, results: Dict):
        rules = self._active_rules('ROUND_AMOUNT')
        for rule in rules:
            config = rule.threshold_config or {}
            amount_threshold = self._float_config(config, 'amount', 5000)
            multiple = self._float_config(config, 'multiple', 1000)
            amount = float(transaction.amount)
            if multiple > 0 and amount >= amount_threshold and amount % multiple == 0:
                transaction.unusual_pattern_flag = True
                self._append_flag(results, 'ROUND_AMOUNT', rule)
                return

    def _check_rapid_movement(self, transaction: Transaction, results: Dict):
        rules = self._active_rules('RAPID_MOVEMENT')
        for rule in rules:
            config = rule.threshold_config or {}
            amount_threshold = self._float_config(config, 'amount', 5000)
            period_hours = self._int_config(config, 'period_hours', 48)
            since = transaction.transaction_date - timedelta(hours=period_hours)
            related_recent = Transaction.objects.filter(
                Q(sender=transaction.receiver) | Q(receiver=transaction.sender),
                transaction_date__gte=since,
                transaction_date__lte=transaction.transaction_date,
                amount__gte=amount_threshold,
            ).exclude(pk=transaction.pk)
            if transaction.receiver_id and float(transaction.amount) >= amount_threshold and related_recent.exists():
                transaction.unusual_pattern_flag = True
                self._append_flag(results, 'RAPID_MOVEMENT', rule)
                return
    
    def _check_pep_sanction(self, transaction: Transaction, results: Dict):
        """Check PEP and sanctions"""
        pep_rules = self._active_rules('PEP')
        sanction_rules = self._active_rules('SANCTION')
        pep_rule = pep_rules[0] if pep_rules else None
        sanction_rule = sanction_rules[0] if sanction_rules else None

        if transaction.sender.is_sanctioned:
            self._append_flag(results, 'SANCTION', sanction_rule)
        elif transaction.sender.is_pep:
            self._append_flag(results, 'PEP_SANCTION', pep_rule)

        if transaction.receiver:
            if transaction.receiver.is_sanctioned:
                self._append_flag(results, 'SANCTION', sanction_rule)
            elif transaction.receiver.is_pep:
                self._append_flag(results, 'PEP_SANCTION', pep_rule)
    
    def _generate_alert(self, transaction: Transaction, risk_data: Dict, flags: List[str]) -> Alert:
        """Generate an AML alert"""
        # Determine alert type
        if 'STRUCTURING' in flags:
            alert_type = 'STRUCTURING'
        elif 'HIGH_VELOCITY' in flags:
            alert_type = 'VELOCITY'
        elif 'HIGH_RISK_COUNTRY' in flags:
            alert_type = 'HIGH_RISK_COUNTRY'
        elif 'SANCTION' in flags:
            alert_type = 'SANCTION'
        elif 'PEP_SANCTION' in flags:
            alert_type = 'PEP'
        elif 'DORMANT_ACCOUNT' in flags:
            alert_type = 'UNUSUAL_PATTERN'
        elif 'CASH_RATIO' in flags:
            alert_type = 'LARGE_CASH'
        elif 'ROUND_AMOUNT' in flags:
            alert_type = 'ROUND_AMOUNT'
        elif 'RAPID_MOVEMENT' in flags:
            alert_type = 'RAPID_MOVEMENT'
        elif 'CUSTOMER_RISK' in flags:
            alert_type = 'OTHER'
        else:
            alert_type = 'THRESHOLD'

        existing_alert = Alert.objects.filter(
            transactions=transaction,
            alert_type=alert_type,
            status__in=['NEW', 'ASSIGNED', 'IN_PROGRESS', 'ESCALATED'],
        ).first()
        if existing_alert:
            return existing_alert
        
        # Generate alert ID
        alert_id = f"AML-{timezone.now().strftime('%Y%m%d')}-{Alert.objects.count() + 1:06d}"
        
        # Create alert
        alert = Alert.objects.create(
            alert_id=alert_id,
            alert_type=alert_type,
            severity=self._alert_severity(risk_data, flags),
            status='NEW',
            customer=transaction.sender,
            title=f"{alert_type} Alert - {transaction.transaction_id}",
            description=risk_data['explanation'],
            risk_score=risk_data['risk_score'],
            ml_confidence=0.85,
            ml_features=risk_data['risk_factors'],
            priority=1 if self._alert_severity(risk_data, flags) in ['HIGH', 'CRITICAL'] else 3
        )
        
        # Add transaction to alert
        alert.transactions.add(transaction)
        
        logger.info(f"Generated alert {alert_id} for transaction {transaction.transaction_id}")
        
        return alert

    def backfill_missing_alerts(self, limit: int = 500) -> int:
        """
        Create review alerts for already-persisted transactions that are flagged
        but do not yet have an active alert row.
        """
        candidates = (
            Transaction.objects.filter(REVIEWABLE_TRANSACTION_Q)
            .exclude(alerts__status__in=['NEW', 'ASSIGNED', 'IN_PROGRESS', 'ESCALATED'])
            .select_related('sender', 'receiver')
            .distinct()
            .order_by('-transaction_date')[:limit]
        )

        created_count = 0
        for tx in candidates:
            results = {
                'flags_triggered': self._flags_for_transaction(tx),
                'alerts_generated': [],
            }
            risk_data = self.risk_scorer.calculate_risk_score(tx)
            if tx.risk_score != risk_data['risk_score'] or not tx.is_suspicious:
                tx.risk_score = risk_data['risk_score']
                tx.is_suspicious = True
                if tx.status == 'PENDING':
                    tx.status = 'FLAGGED'
                tx.save(update_fields=['risk_score', 'is_suspicious', 'status', 'updated_at'])

            alert = self._generate_alert(tx, risk_data, results['flags_triggered'])
            if alert.alert_id not in results['alerts_generated']:
                created_count += 1

        return created_count

    def _flags_for_transaction(self, transaction: Transaction) -> List[str]:
        flags = []
        if transaction.structuring_flag:
            flags.append('STRUCTURING')
        if transaction.velocity_flag:
            flags.append('HIGH_VELOCITY')
        if transaction.high_risk_country_flag:
            flags.append('HIGH_RISK_COUNTRY')
        if transaction.amount_threshold_flag or float(transaction.amount) >= 10000:
            flags.append('AMOUNT_THRESHOLD')
        if transaction.status in {'FLAGGED', 'UNDER_REVIEW', 'BLOCKED'} and not flags:
            flags.append('MANUAL_FLAG')
        return flags

    def _active_rules(self, rule_type: str):
        return list(AlertRule.objects.filter(is_active=True, rule_type=rule_type).order_by('name'))

    def _append_flag(self, results: Dict, flag: str, rule=None):
        if flag not in results['flags_triggered']:
            results['flags_triggered'].append(flag)
        if rule:
            results.setdefault('matched_rules', []).append({
                'flag': flag,
                'rule_id': rule.id,
                'rule_name': rule.name,
                'severity': rule.severity,
            })

    def _alert_severity(self, risk_data: Dict, flags: List[str]) -> str:
        severity_rank = {'LOW': 1, 'MEDIUM': 2, 'HIGH': 3, 'CRITICAL': 4}
        matched = []
        for flag in flags:
            rule_types = {
                'STRUCTURING': 'STRUCTURING',
                'HIGH_VELOCITY': 'VELOCITY',
                'HIGH_RISK_COUNTRY': 'HIGH_RISK_COUNTRY',
                'SANCTION': 'SANCTION',
                'PEP_SANCTION': 'PEP',
                'DORMANT_ACCOUNT': 'UNUSUAL_PATTERN',
                'CASH_RATIO': 'LARGE_CASH',
                'ROUND_AMOUNT': 'ROUND_AMOUNT',
                'RAPID_MOVEMENT': 'RAPID_MOVEMENT',
                'CUSTOMER_RISK': 'OTHER',
                'AMOUNT_THRESHOLD': 'THRESHOLD',
            }
            rule_type = rule_types.get(flag)
            if rule_type:
                matched.extend(rule.severity for rule in self._active_rules(rule_type))
        matched.append(risk_data.get('risk_level', 'LOW'))
        return max(matched, key=lambda value: severity_rank.get(value, 1))

    def _float_config(self, config: Dict, key: str, default: float) -> float:
        try:
            return float(config.get(key, default))
        except (TypeError, ValueError):
            return default

    def _int_config(self, config: Dict, key: str, default: int) -> int:
        try:
            return int(float(config.get(key, default)))
        except (TypeError, ValueError):
            return default
    
    def _save_risk_score(self, transaction: Transaction, risk_data: Dict):
        """Save risk score to database"""
        RiskScore.objects.create(
            entity_type='TRANSACTION',
            transaction=transaction,
            risk_score=risk_data['risk_score'],
            risk_level=risk_data['risk_level'],
            confidence=0.85,
            risk_factors=risk_data['risk_factors'],
            explanation=risk_data['explanation'],
            expires_at=timezone.now() + timedelta(days=90)
        )
    
    def _process_anomalies(self, transaction: Transaction, anomalies: List[Dict]):
        """Process detected anomalies"""
        for anomaly_data in anomalies:
            AnomalyDetection.objects.create(
                transaction=anomaly_data['transaction'],
                customer=transaction.sender,
                anomaly_score=anomaly_data['anomaly_score'],
                anomaly_type=anomaly_data['anomaly_type'],
                detection_method='Statistical Analysis',
                deviation_details={'details': anomaly_data['details']}
            )


class CustomerRiskProfiler:
    """
    Periodic customer risk profiling
    Updates customer risk scores based on transaction history
    """
    
    def update_customer_risk(self, customer: Customer) -> Dict:
        """
        Update customer's risk profile
        Returns updated risk assessment
        """
        # Get transaction history (last 90 days)
        cutoff_date = timezone.now() - timedelta(days=90)
        transactions = Transaction.objects.filter(
            sender=customer,
            transaction_date__gte=cutoff_date
        )
        
        if not transactions.exists():
            return {
                'customer_id': customer.customer_id,
                'risk_score': 0.0,
                'risk_level': 'LOW'
            }
        
        # Calculate aggregated metrics
        total_amount = sum(float(t.amount) for t in transactions)
        avg_risk = sum(t.risk_score for t in transactions) / transactions.count()
        suspicious_count = transactions.filter(is_suspicious=True).count()
        
        # Calculate customer risk score
        risk_score = min(
            (avg_risk * 0.6) +
            (suspicious_count / max(transactions.count(), 1) * 0.4),
            1.0
        )
        
        # Determine risk level
        if risk_score >= 0.7:
            risk_level = 'HIGH'
        elif risk_score >= 0.4:
            risk_level = 'MEDIUM'
        else:
            risk_level = 'LOW'
        
        # Update customer
        customer.risk_score = risk_score
        customer.risk_level = risk_level
        customer.save()
        
        # Save risk score
        RiskScore.objects.create(
            entity_type='CUSTOMER',
            customer=customer,
            risk_score=risk_score,
            risk_level=risk_level,
            confidence=0.80,
            risk_factors={
                'avg_transaction_risk': avg_risk,
                'suspicious_ratio': suspicious_count / max(transactions.count(), 1),
                'total_volume': total_amount
            }
        )
        
        return {
            'customer_id': customer.customer_id,
            'risk_score': risk_score,
            'risk_level': risk_level,
            'transactions_analyzed': transactions.count()
        }

