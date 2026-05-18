import datetime
import json
import os
from pathlib import Path
from urllib.parse import urlparse

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from . import settings


ENV_FILE_PATH = Path(settings.BASE_DIR) / '.env'

DEFAULT_CONFIG = {
    'environment': 'development',
    'coreApiBaseUrl': 'http://localhost:8000/api',
    'transactionFeedApiKey': '',
    'screeningApiKey': '',
    'watchlistApiKey': '',
    'blacklistApiKey': '',
    'modelRegistryApiKey': '',
    'customApiKeys': [],
    'dbHost': os.getenv('DB_HOST', 'localhost'),
    'dbPort': os.getenv('DB_PORT', '3306'),
    'dbName': os.getenv('DB_NAME', 'aml_database'),
    'dbUser': os.getenv('DB_USER', 'root'),
    'dbPassword': os.getenv('DB_PASSWORD', ''),
    'dbSslEnabled': False,
    'redisHost': 'localhost',
    'redisPort': '6379',
    'smtpHost': '',
    'smtpPort': '587',
    'smtpUser': '',
    'smtpPassword': '',
    'smtpFromEmail': '',
    'amlRiskThresholdHigh': '0.70',
    'amlRiskThresholdMedium': '0.40',
    'autoScreeningEnabled': True,
    'autoSarEnabled': True,
    'modelMonitoringEnabled': True,
}


def _parse_bool(value, default=False):
    if isinstance(value, bool):
        return value
    if value is None:
        return default
    return str(value).strip().lower() in {'1', 'true', 'yes', 'on'}


def _parse_custom_api_keys(value):
    if not value:
        return []
    try:
        parsed = json.loads(value)
    except (TypeError, ValueError):
        return []
    if not isinstance(parsed, list):
        return []

    keys = []
    for item in parsed:
        if not isinstance(item, dict):
            continue
        name = str(item.get('name') or '').strip()
        key = str(item.get('key') or '').strip()
        if not name or not key:
            continue
        keys.append({
            'id': str(item.get('id') or '').strip() or name.lower().replace(' ', '-'),
            'name': name,
            'key': key,
            'createdAt': str(item.get('createdAt') or '').strip(),
        })
    return keys


def _load_env_values():
    if not ENV_FILE_PATH.exists():
        return {}

    values = {}
    for line in ENV_FILE_PATH.read_text(encoding='utf-8').splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith('#') or '=' not in stripped:
            continue
        key, value = stripped.split('=', 1)
        values[key.strip()] = value.strip()
    return values


def _split_redis_location(redis_url):
    parsed = urlparse(redis_url or '')
    if parsed.hostname:
        return parsed.hostname, str(parsed.port or 6379)
    return DEFAULT_CONFIG['redisHost'], DEFAULT_CONFIG['redisPort']


def _build_config_payload():
    env_values = _load_env_values()
    redis_host, redis_port = _split_redis_location(
        env_values.get('REDIS_URL', os.getenv('REDIS_URL', 'redis://127.0.0.1:6379/0'))
    )

    payload = {
        **DEFAULT_CONFIG,
        'environment': env_values.get('AML_ENVIRONMENT', DEFAULT_CONFIG['environment']),
        'coreApiBaseUrl': env_values.get('CORE_API_BASE_URL', DEFAULT_CONFIG['coreApiBaseUrl']),
        'transactionFeedApiKey': env_values.get('TRANSACTION_FEED_API_KEY', ''),
        'screeningApiKey': env_values.get('SCREENING_API_KEY', ''),
        'watchlistApiKey': env_values.get('WATCHLIST_API_KEY', ''),
        'blacklistApiKey': env_values.get('BLACKLIST_API_KEY', ''),
        'modelRegistryApiKey': env_values.get('MODEL_REGISTRY_API_KEY', ''),
        'customApiKeys': _parse_custom_api_keys(env_values.get('CUSTOM_API_KEYS', '')),
        'dbHost': env_values.get('DB_HOST', DEFAULT_CONFIG['dbHost']),
        'dbPort': env_values.get('DB_PORT', DEFAULT_CONFIG['dbPort']),
        'dbName': env_values.get('DB_NAME', DEFAULT_CONFIG['dbName']),
        'dbUser': env_values.get('DB_USER', DEFAULT_CONFIG['dbUser']),
        'dbPassword': env_values.get('DB_PASSWORD', DEFAULT_CONFIG['dbPassword']),
        'dbSslEnabled': _parse_bool(env_values.get('DB_SSL_ENABLED'), DEFAULT_CONFIG['dbSslEnabled']),
        'redisHost': redis_host,
        'redisPort': redis_port,
        'smtpHost': env_values.get('SMTP_HOST', ''),
        'smtpPort': env_values.get('SMTP_PORT', DEFAULT_CONFIG['smtpPort']),
        'smtpUser': env_values.get('SMTP_USER', ''),
        'smtpPassword': env_values.get('SMTP_PASSWORD', ''),
        'smtpFromEmail': env_values.get('SMTP_FROM_EMAIL', ''),
        'amlRiskThresholdHigh': env_values.get('AML_RISK_THRESHOLD_HIGH', DEFAULT_CONFIG['amlRiskThresholdHigh']),
        'amlRiskThresholdMedium': env_values.get('AML_RISK_THRESHOLD_MEDIUM', DEFAULT_CONFIG['amlRiskThresholdMedium']),
        'autoScreeningEnabled': _parse_bool(env_values.get('AUTO_SCREENING_ENABLED'), DEFAULT_CONFIG['autoScreeningEnabled']),
        'autoSarEnabled': _parse_bool(env_values.get('AUTO_SAR_ENABLED'), DEFAULT_CONFIG['autoSarEnabled']),
        'modelMonitoringEnabled': _parse_bool(env_values.get('AML_MONITORING_ENABLED'), DEFAULT_CONFIG['modelMonitoringEnabled']),
        'updatedAt': ENV_FILE_PATH.stat().st_mtime if ENV_FILE_PATH.exists() else None,
    }

    if payload['updatedAt'] is not None:
        payload['updatedAt'] = datetime.datetime.fromtimestamp(payload['updatedAt']).isoformat()
    else:
        payload['updatedAt'] = ''
    return payload


def _serialize_for_env(config):
    redis_host = str(config.get('redisHost') or DEFAULT_CONFIG['redisHost']).strip()
    redis_port = str(config.get('redisPort') or DEFAULT_CONFIG['redisPort']).strip()
    redis_url = f'redis://{redis_host}:{redis_port}/0'

    custom_api_keys = config.get('customApiKeys')
    if isinstance(custom_api_keys, list):
        custom_api_keys = [
            {
                'id': str(item.get('id') or '').strip(),
                'name': str(item.get('name') or '').strip(),
                'key': str(item.get('key') or '').strip(),
                'createdAt': str(item.get('createdAt') or '').strip(),
            }
            for item in custom_api_keys
            if isinstance(item, dict) and str(item.get('name') or '').strip() and str(item.get('key') or '').strip()
        ]
    else:
        custom_api_keys = []

    return {
        'AML_ENVIRONMENT': str(config.get('environment') or DEFAULT_CONFIG['environment']).strip(),
        'CORE_API_BASE_URL': str(config.get('coreApiBaseUrl') or DEFAULT_CONFIG['coreApiBaseUrl']).strip(),
        'TRANSACTION_FEED_API_KEY': str(config.get('transactionFeedApiKey') or '').strip(),
        'SCREENING_API_KEY': str(config.get('screeningApiKey') or '').strip(),
        'WATCHLIST_API_KEY': str(config.get('watchlistApiKey') or '').strip(),
        'BLACKLIST_API_KEY': str(config.get('blacklistApiKey') or '').strip(),
        'MODEL_REGISTRY_API_KEY': str(config.get('modelRegistryApiKey') or '').strip(),
        'CUSTOM_API_KEYS': json.dumps(custom_api_keys, separators=(',', ':')),
        'DB_HOST': str(config.get('dbHost') or DEFAULT_CONFIG['dbHost']).strip(),
        'DB_PORT': str(config.get('dbPort') or DEFAULT_CONFIG['dbPort']).strip(),
        'DB_NAME': str(config.get('dbName') or DEFAULT_CONFIG['dbName']).strip(),
        'DB_USER': str(config.get('dbUser') or DEFAULT_CONFIG['dbUser']).strip(),
        'DB_PASSWORD': str(config.get('dbPassword') or '').strip(),
        'DB_SSL_ENABLED': 'true' if _parse_bool(config.get('dbSslEnabled')) else 'false',
        'REDIS_URL': redis_url,
        'SMTP_HOST': str(config.get('smtpHost') or '').strip(),
        'SMTP_PORT': str(config.get('smtpPort') or DEFAULT_CONFIG['smtpPort']).strip(),
        'SMTP_USER': str(config.get('smtpUser') or '').strip(),
        'SMTP_PASSWORD': str(config.get('smtpPassword') or '').strip(),
        'SMTP_FROM_EMAIL': str(config.get('smtpFromEmail') or '').strip(),
        'AML_RISK_THRESHOLD_HIGH': str(config.get('amlRiskThresholdHigh') or DEFAULT_CONFIG['amlRiskThresholdHigh']).strip(),
        'AML_RISK_THRESHOLD_MEDIUM': str(config.get('amlRiskThresholdMedium') or DEFAULT_CONFIG['amlRiskThresholdMedium']).strip(),
        'AUTO_SCREENING_ENABLED': 'true' if _parse_bool(config.get('autoScreeningEnabled')) else 'false',
        'AUTO_SAR_ENABLED': 'true' if _parse_bool(config.get('autoSarEnabled')) else 'false',
        'AML_MONITORING_ENABLED': 'true' if _parse_bool(config.get('modelMonitoringEnabled')) else 'false',
    }


@api_view(['GET', 'PUT'])
@permission_classes([AllowAny])
def system_configuration(request):
    if request.method == 'GET':
        return Response(_build_config_payload())

    current = _build_config_payload()
    next_config = {**current, **request.data}
    env_values = _load_env_values()
    env_values.update(_serialize_for_env(next_config))

    lines = [f'{key}={value}' for key, value in sorted(env_values.items())]
    ENV_FILE_PATH.write_text('\n'.join(lines) + '\n', encoding='utf-8')

    return Response(_build_config_payload())
