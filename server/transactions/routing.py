from django.urls import path

from .consumers import TransactionsStreamConsumer


websocket_urlpatterns = [
    path('ws/transactions/', TransactionsStreamConsumer.as_asgi()),
]
