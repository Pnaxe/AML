"""
Utility functions for ML engine
"""
from typing import List, Dict
import logging

logger = logging.getLogger(__name__)


def calculate_weighted_score(factors: Dict[str, float], weights: Dict[str, float]) -> float:
    """
    Calculate weighted risk score from multiple factors
    
    Args:
        factors: Dictionary of risk factors and their scores
        weights: Dictionary of weights for each factor
    
    Returns:
        Weighted risk score (0.0 to 1.0)
    """
    total_score = 0.0
    total_weight = 0.0
    
    for factor, score in factors.items():
        if factor in weights:
            total_score += score * weights[factor]
            total_weight += weights[factor]
    
    if total_weight == 0:
        return 0.0
    
    return min(total_score / total_weight, 1.0)


def normalize_score(value: float, min_val: float, max_val: float) -> float:
    """
    Normalize a value to 0-1 range
    
    Args:
        value: Value to normalize
        min_val: Minimum possible value
        max_val: Maximum possible value
    
    Returns:
        Normalized score (0.0 to 1.0)
    """
    if max_val == min_val:
        return 0.0
    
    normalized = (value - min_val) / (max_val - min_val)
    return max(0.0, min(1.0, normalized))


def get_risk_level_from_score(score: float, 
                               threshold_high: float = 0.7,
                               threshold_medium: float = 0.4) -> str:
    """
    Convert risk score to risk level category
    
    Args:
        score: Risk score (0.0 to 1.0)
        threshold_high: Threshold for HIGH risk
        threshold_medium: Threshold for MEDIUM risk
    
    Returns:
        Risk level string ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')
    """
    if score >= 0.9:
        return 'CRITICAL'
    elif score >= threshold_high:
        return 'HIGH'
    elif score >= threshold_medium:
        return 'MEDIUM'
    else:
        return 'LOW'


def extract_top_risk_factors(risk_factors: Dict[str, float], top_n: int = 3) -> List[Dict]:
    """
    Extract top N risk factors by score
    
    Args:
        risk_factors: Dictionary of risk factors and scores
        top_n: Number of top factors to return
    
    Returns:
        List of top risk factors with details
    """
    sorted_factors = sorted(
        risk_factors.items(),
        key=lambda x: x[1],
        reverse=True
    )
    
    return [
        {'factor': factor, 'score': score}
        for factor, score in sorted_factors[:top_n]
    ]


def format_currency(amount: float, currency: str = 'USD') -> str:
    """
    Format currency amount for display
    
    Args:
        amount: Amount to format
        currency: Currency code
    
    Returns:
        Formatted currency string
    """
    return f"{currency} {amount:,.2f}"


def calculate_z_score(value: float, mean: float, std: float) -> float:
    """
    Calculate Z-score for anomaly detection
    
    Args:
        value: Value to evaluate
        mean: Mean of the distribution
        std: Standard deviation
    
    Returns:
        Z-score
    """
    if std == 0:
        return 0.0
    
    return abs((value - mean) / std)


def is_outlier(value: float, mean: float, std: float, threshold: float = 3.0) -> bool:
    """
    Determine if a value is an outlier
    
    Args:
        value: Value to evaluate
        mean: Mean of the distribution
        std: Standard deviation
        threshold: Z-score threshold for outliers
    
    Returns:
        True if outlier, False otherwise
    """
    z_score = calculate_z_score(value, mean, std)
    return z_score > threshold

