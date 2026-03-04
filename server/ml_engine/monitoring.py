"""
Real-time transaction monitoring service
"""
from django.db import transaction as db_transaction
from django.utils import timezone
from datetime import datetime, timedelta
from typing import Dict, List
import logging

from transactions.models import Transaction
from accounts.models import Customer
from alerts.models import Alert
from .models import RiskScore, AnomalyDetection, ModelPrediction
from .ml_service import (
    TransactionRiskScorer,
    AnomalyDetector,
    StructuringDetector,
    MLPredictionEngine
)

logger = logging.getLogger(__name__)


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
            'flags_triggered': []
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
            self._check_pep_sanction(transaction, results)
            
            # 4. Generate alerts if needed
            if transaction.is_suspicious or results['flags_triggered']:
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
        LARGE_TRANSACTION_THRESHOLD = 10000
        
        if float(transaction.amount) >= LARGE_TRANSACTION_THRESHOLD:
            transaction.amount_threshold_flag = True
            results['flags_triggered'].append('AMOUNT_THRESHOLD')
    
    def _check_velocity(self, transaction: Transaction, results: Dict):
        """Check transaction velocity"""
        day_ago = timezone.now() - timedelta(hours=24)
        recent_count = Transaction.objects.filter(
            sender=transaction.sender,
            transaction_date__gte=day_ago
        ).count()
        
        if recent_count >= 10:
            transaction.velocity_flag = True
            results['flags_triggered'].append('HIGH_VELOCITY')
    
    def _check_structuring(self, transaction: Transaction, results: Dict):
        """Check for structuring patterns"""
        structuring_result = self.structuring_detector.detect_structuring(transaction.sender)
        
        if structuring_result['is_structuring']:
            transaction.structuring_flag = True
            results['flags_triggered'].append('STRUCTURING')
    
    def _check_country_risk(self, transaction: Transaction, results: Dict):
        """Check for high-risk countries"""
        high_risk_countries = self.risk_scorer.HIGH_RISK_COUNTRIES
        
        if (transaction.originating_country in high_risk_countries or
            transaction.destination_country in high_risk_countries):
            transaction.high_risk_country_flag = True
            results['flags_triggered'].append('HIGH_RISK_COUNTRY')
    
    def _check_pep_sanction(self, transaction: Transaction, results: Dict):
        """Check PEP and sanctions"""
        if transaction.sender.is_pep or transaction.sender.is_sanctioned:
            results['flags_triggered'].append('PEP_SANCTION')
        
        if transaction.receiver:
            if transaction.receiver.is_pep or transaction.receiver.is_sanctioned:
                results['flags_triggered'].append('PEP_SANCTION')
    
    def _generate_alert(self, transaction: Transaction, risk_data: Dict, flags: List[str]) -> Alert:
        """Generate an AML alert"""
        # Determine alert type
        if 'STRUCTURING' in flags:
            alert_type = 'STRUCTURING'
        elif 'HIGH_VELOCITY' in flags:
            alert_type = 'VELOCITY'
        elif 'HIGH_RISK_COUNTRY' in flags:
            alert_type = 'HIGH_RISK_COUNTRY'
        elif 'PEP_SANCTION' in flags:
            alert_type = 'PEP'
        else:
            alert_type = 'THRESHOLD'
        
        # Generate alert ID
        alert_id = f"AML-{timezone.now().strftime('%Y%m%d')}-{Alert.objects.count() + 1:06d}"
        
        # Create alert
        alert = Alert.objects.create(
            alert_id=alert_id,
            alert_type=alert_type,
            severity=risk_data['risk_level'],
            status='NEW',
            customer=transaction.sender,
            title=f"{alert_type} Alert - {transaction.transaction_id}",
            description=risk_data['explanation'],
            risk_score=risk_data['risk_score'],
            ml_confidence=0.85,
            ml_features=risk_data['risk_factors'],
            priority=1 if risk_data['risk_level'] == 'HIGH' else 3
        )
        
        # Add transaction to alert
        alert.transactions.add(transaction)
        
        logger.info(f"Generated alert {alert_id} for transaction {transaction.transaction_id}")
        
        return alert
    
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

