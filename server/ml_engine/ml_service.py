"""
AI/ML Service for AML Transaction Monitoring and Risk Scoring
"""
import numpy as np
from datetime import datetime, timedelta
from django.db.models import Count, Avg, Sum, Q
from django.conf import settings
from typing import Dict, List, Tuple
import logging

from transactions.models import Transaction
from accounts.models import Customer
from .models import RiskScore, AnomalyDetection, ModelPrediction

logger = logging.getLogger(__name__)


class TransactionRiskScorer:
    """
    AI-powered transaction risk scoring engine
    Uses rule-based and ML-based approaches for risk assessment
    """
    
    # Risk weights for different factors
    RISK_WEIGHTS = {
        'amount': 0.25,
        'velocity': 0.20,
        'country_risk': 0.20,
        'customer_profile': 0.15,
        'pattern_deviation': 0.10,
        'pep_sanction': 0.10,
    }
    
    # High-risk country codes (example list)
    HIGH_RISK_COUNTRIES = [
        'AF', 'IR', 'KP', 'SY', 'YE',  # Example high-risk jurisdictions
    ]
    
    def __init__(self):
        self.threshold_high = getattr(settings, 'AML_RISK_THRESHOLD_HIGH', 0.7)
        self.threshold_medium = getattr(settings, 'AML_RISK_THRESHOLD_MEDIUM', 0.4)
    
    def calculate_risk_score(self, transaction: Transaction) -> Dict:
        """
        Calculate comprehensive risk score for a transaction
        Returns a dictionary with risk score and contributing factors
        """
        risk_factors = {}
        
        # 1. Amount-based risk
        risk_factors['amount'] = self._calculate_amount_risk(transaction)
        
        # 2. Velocity risk (transaction frequency)
        risk_factors['velocity'] = self._calculate_velocity_risk(transaction)
        
        # 3. Country risk
        risk_factors['country_risk'] = self._calculate_country_risk(transaction)
        
        # 4. Customer profile risk
        risk_factors['customer_profile'] = self._calculate_customer_profile_risk(transaction)
        
        # 5. Pattern deviation
        risk_factors['pattern_deviation'] = self._calculate_pattern_deviation(transaction)
        
        # 6. PEP and Sanctions risk
        risk_factors['pep_sanction'] = self._calculate_pep_sanction_risk(transaction)
        
        # Calculate weighted risk score
        total_risk = sum(
            risk_factors[factor] * self.RISK_WEIGHTS[factor]
            for factor in risk_factors
        )
        
        # Determine risk level
        if total_risk >= self.threshold_high:
            risk_level = 'HIGH'
        elif total_risk >= self.threshold_medium:
            risk_level = 'MEDIUM'
        else:
            risk_level = 'LOW'
        
        return {
            'risk_score': round(total_risk, 3),
            'risk_level': risk_level,
            'risk_factors': risk_factors,
            'explanation': self._generate_explanation(risk_factors, total_risk)
        }
    
    def _calculate_amount_risk(self, transaction: Transaction) -> float:
        """Calculate risk based on transaction amount"""
        amount = float(transaction.amount)
        
        # Thresholds (in USD equivalent)
        if amount >= 100000:
            return 1.0
        elif amount >= 50000:
            return 0.8
        elif amount >= 10000:
            return 0.5
        elif amount >= 5000:
            return 0.3
        else:
            return 0.1
    
    def _calculate_velocity_risk(self, transaction: Transaction) -> float:
        """Calculate risk based on transaction velocity"""
        # Count transactions from sender in last 24 hours
        day_ago = datetime.now() - timedelta(hours=24)
        recent_count = Transaction.objects.filter(
            sender=transaction.sender,
            transaction_date__gte=day_ago
        ).count()
        
        # Risk increases with frequency
        if recent_count >= 20:
            return 1.0
        elif recent_count >= 10:
            return 0.7
        elif recent_count >= 5:
            return 0.4
        else:
            return 0.1
    
    def _calculate_country_risk(self, transaction: Transaction) -> float:
        """Calculate risk based on countries involved"""
        risk = 0.0
        
        # Check originating country
        if transaction.originating_country in self.HIGH_RISK_COUNTRIES:
            risk += 0.5
        
        # Check destination country
        if transaction.destination_country in self.HIGH_RISK_COUNTRIES:
            risk += 0.5
        
        return min(risk, 1.0)
    
    def _calculate_customer_profile_risk(self, transaction: Transaction) -> float:
        """Calculate risk based on customer profile"""
        sender = transaction.sender
        
        # Use customer's existing risk score
        if hasattr(sender, 'risk_score'):
            return min(sender.risk_score, 1.0)
        
        return 0.0
    
    def _calculate_pattern_deviation(self, transaction: Transaction) -> float:
        """
        Calculate risk based on deviation from normal patterns
        Compares current transaction against historical patterns
        """
        sender = transaction.sender
        amount = float(transaction.amount)
        
        # Get historical average
        historical = Transaction.objects.filter(
            sender=sender,
            status='COMPLETED',
            transaction_date__lt=transaction.transaction_date
        ).aggregate(
            avg_amount=Avg('amount'),
            count=Count('id')
        )
        
        if not historical['count'] or historical['count'] < 3:
            # Not enough history, low confidence
            return 0.2
        
        avg_amount = float(historical['avg_amount'] or 0)
        
        if avg_amount == 0:
            return 0.0
        
        # Calculate deviation ratio
        deviation_ratio = amount / avg_amount
        
        # High deviation = higher risk
        if deviation_ratio >= 10:
            return 1.0
        elif deviation_ratio >= 5:
            return 0.7
        elif deviation_ratio >= 3:
            return 0.4
        else:
            return 0.1
    
    def _calculate_pep_sanction_risk(self, transaction: Transaction) -> float:
        """Calculate risk based on PEP and sanctions status"""
        sender = transaction.sender
        receiver = transaction.receiver
        
        risk = 0.0
        
        # Check sender
        if sender.is_pep:
            risk += 0.5
        if sender.is_sanctioned:
            risk = 1.0  # Maximum risk
        
        # Check receiver if exists
        if receiver:
            if receiver.is_pep:
                risk += 0.3
            if receiver.is_sanctioned:
                risk = 1.0  # Maximum risk
        
        return min(risk, 1.0)
    
    def _generate_explanation(self, risk_factors: Dict, total_risk: float) -> str:
        """Generate human-readable explanation of risk score"""
        high_risk_factors = [
            factor for factor, score in risk_factors.items()
            if score >= 0.5
        ]
        
        if not high_risk_factors:
            return "Transaction appears normal with no significant risk factors."
        
        factor_names = {
            'amount': 'High transaction amount',
            'velocity': 'High transaction frequency',
            'country_risk': 'High-risk country involved',
            'customer_profile': 'Customer risk profile',
            'pattern_deviation': 'Unusual transaction pattern',
            'pep_sanction': 'PEP or sanctions match',
        }
        
        explanations = [factor_names.get(f, f) for f in high_risk_factors]
        
        return "Risk factors: " + ", ".join(explanations)


class AnomalyDetector:
    """
    Unsupervised learning-based anomaly detection
    Identifies unusual patterns in transaction behavior
    """
    
    def detect_anomalies(self, customer: Customer, lookback_days: int = 30) -> List[Dict]:
        """
        Detect anomalies in customer's recent transactions
        Returns list of detected anomalies
        """
        anomalies = []
        
        # Get recent transactions
        cutoff_date = datetime.now() - timedelta(days=lookback_days)
        recent_transactions = Transaction.objects.filter(
            sender=customer,
            transaction_date__gte=cutoff_date
        ).order_by('transaction_date')
        
        if recent_transactions.count() < 5:
            # Not enough data for anomaly detection
            return anomalies
        
        # Extract features
        amounts = [float(t.amount) for t in recent_transactions]
        
        # Statistical anomaly detection (Isolation Forest concept simplified)
        mean_amount = np.mean(amounts)
        std_amount = np.std(amounts)
        
        for transaction in recent_transactions:
            amount = float(transaction.amount)
            
            # Z-score based anomaly detection
            if std_amount > 0:
                z_score = abs((amount - mean_amount) / std_amount)
                
                if z_score > 3:  # More than 3 standard deviations
                    anomalies.append({
                        'transaction': transaction,
                        'anomaly_score': min(z_score / 5, 1.0),
                        'anomaly_type': 'Statistical Outlier',
                        'details': f'Amount is {z_score:.2f} standard deviations from mean'
                    })
        
        # Time-based anomaly detection
        anomalies.extend(self._detect_time_anomalies(recent_transactions))
        
        return anomalies
    
    def _detect_time_anomalies(self, transactions) -> List[Dict]:
        """Detect time-based anomalies (e.g., unusual hours)"""
        anomalies = []
        
        # Extract hours of transactions
        hours = [t.transaction_date.hour for t in transactions]
        
        for transaction in transactions:
            hour = transaction.transaction_date.hour
            
            # Flag transactions at unusual hours (e.g., 2 AM - 5 AM)
            if 2 <= hour <= 5:
                anomalies.append({
                    'transaction': transaction,
                    'anomaly_score': 0.6,
                    'anomaly_type': 'Unusual Time',
                    'details': f'Transaction at {hour}:00 (unusual hour)'
                })
        
        return anomalies


class StructuringDetector:
    """
    Detects structuring/smurfing patterns
    Identifies attempts to avoid reporting thresholds
    """
    
    REPORTING_THRESHOLD = 10000  # USD
    STRUCTURING_WINDOW_HOURS = 24
    STRUCTURING_MIN_TRANSACTIONS = 3
    
    def detect_structuring(self, customer: Customer) -> Dict:
        """
        Detect potential structuring activity
        Returns structuring indicators
        """
        # Look for multiple transactions just below threshold
        cutoff_time = datetime.now() - timedelta(hours=self.STRUCTURING_WINDOW_HOURS)
        
        suspicious_transactions = Transaction.objects.filter(
            sender=customer,
            transaction_date__gte=cutoff_time,
            amount__lt=self.REPORTING_THRESHOLD,
            amount__gte=self.REPORTING_THRESHOLD * 0.8  # 80% of threshold
        )
        
        count = suspicious_transactions.count()
        total_amount = suspicious_transactions.aggregate(Sum('amount'))['amount__sum'] or 0
        
        is_structuring = (
            count >= self.STRUCTURING_MIN_TRANSACTIONS and
            total_amount >= self.REPORTING_THRESHOLD
        )
        
        return {
            'is_structuring': is_structuring,
            'transaction_count': count,
            'total_amount': float(total_amount),
            'confidence': min(count / 10, 1.0),
            'transactions': list(suspicious_transactions)
        }


class MLPredictionEngine:
    """
    Machine Learning prediction engine
    Note: This is a placeholder for actual ML model integration
    In production, you would load trained models (sklearn, TensorFlow, PyTorch)
    """
    
    def predict_transaction_risk(self, transaction: Transaction) -> Dict:
        """
        Predict transaction risk using ML model
        This is a simplified version - in production, load actual trained model
        """
        # Extract features
        features = self._extract_features(transaction)
        
        # In production: model.predict(features)
        # For now, use rule-based approximation
        scorer = TransactionRiskScorer()
        risk_data = scorer.calculate_risk_score(transaction)
        
        # Simulate ML prediction
        prediction = {
            'is_suspicious': risk_data['risk_score'] >= 0.6,
            'suspicion_score': risk_data['risk_score'],
            'confidence': 0.85,  # Simulated confidence
            'features': features,
            'model_version': '1.0.0'
        }
        
        return prediction
    
    def _extract_features(self, transaction: Transaction) -> Dict:
        """Extract features for ML model"""
        return {
            'amount': float(transaction.amount),
            'transaction_type': transaction.transaction_type,
            'sender_risk_level': transaction.sender.risk_level,
            'is_cross_border': (
                transaction.originating_country != transaction.destination_country
                if transaction.destination_country else False
            ),
            'sender_is_pep': transaction.sender.is_pep,
            'sender_is_sanctioned': transaction.sender.is_sanctioned,
            'hour_of_day': transaction.transaction_date.hour,
            'day_of_week': transaction.transaction_date.weekday(),
        }

