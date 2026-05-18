try:
    import pymysql
    pymysql.install_as_MySQLdb()
except ModuleNotFoundError:
    pass

try:
    from .celery import app as celery_app
except ModuleNotFoundError:
    celery_app = None

__all__ = ('celery_app',)
