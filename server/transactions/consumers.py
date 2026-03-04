import json

from channels.generic.websocket import AsyncWebsocketConsumer


TRANSACTIONS_STREAM_GROUP = 'transactions_stream'


class TransactionsStreamConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        await self.channel_layer.group_add(TRANSACTIONS_STREAM_GROUP, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(TRANSACTIONS_STREAM_GROUP, self.channel_name)

    async def transaction_message(self, event):
        await self.send(text_data=json.dumps(event['payload']))
