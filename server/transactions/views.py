from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.shortcuts import render
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Q
from django.db.utils import OperationalError, ProgrammingError
from django.core.management import call_command
from io import StringIO
from datetime import datetime
from decimal import Decimal, InvalidOperation
import pandas as pd
import logging
from accounts.models import Customer

from .models import Transaction, TransactionPattern, TransactionDataSource
from .serializers import (
    TransactionSerializer,
    TransactionCreateSerializer,
    TransactionPatternSerializer,
    TransactionDataSourceSerializer
)
from .tasks import broadcast_transaction_update
from ml_engine.monitoring import TransactionMonitor

logger = logging.getLogger(__name__)


class TransactionViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Transaction CRUD and monitoring
    """
    queryset = Transaction.objects.all()
    # TODO: Change back to [IsAuthenticated] in production
    permission_classes = [AllowAny]  # Temporarily allowing unauthenticated access for development
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = [
        'transaction_type', 'status', 'is_suspicious',
        'sender', 'receiver', 'currency'
    ]
    search_fields = ['transaction_id', 'reference_number', 'description']
    ordering_fields = ['transaction_date', 'amount', 'risk_score']
    ordering = ['-transaction_date']
    
    def get_serializer_class(self):
        if self.action == 'create':
            return TransactionCreateSerializer
        return TransactionSerializer

    def perform_create(self, serializer):
        """
        Save a transaction and immediately run AML monitoring.
        """
        tx = serializer.save()
        try:
            monitor = TransactionMonitor()
            monitor.process_transaction(tx)
        except Exception as e:
            logger.error(f"AML monitoring failed for transaction {tx.transaction_id}: {str(e)}")
        broadcast_transaction_update(tx)
    
    @action(detail=True, methods=['post'])
    def reprocess(self, request, pk=None):
        """
        Reprocess a transaction through AML monitoring
        """
        transaction = self.get_object()
        monitor = TransactionMonitor()
        results = monitor.process_transaction(transaction)
        
        return Response({
            'message': 'Transaction reprocessed successfully',
            'results': results
        })
    
    @action(detail=False, methods=['post'])
    def monitor_all(self, request):
        """
        Run AML monitoring on all transactions
        """
        try:
            transactions = self.queryset.all()
            monitor = TransactionMonitor()
            processed_count = 0
            alerts_generated = 0
            
            for transaction in transactions:
                try:
                    results = monitor.process_transaction(transaction)
                    processed_count += 1
                    if results.get('alerts_generated'):
                        alerts_generated += len(results['alerts_generated'])
                except Exception as e:
                    logger.error(f"Error processing transaction {transaction.transaction_id}: {str(e)}")
                    continue
            
            return Response({
                'message': f'Monitoring completed for {processed_count} transaction(s)',
                'processed_count': processed_count,
                'alerts_generated': alerts_generated,
                'total_transactions': transactions.count()
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({
                'error': str(e),
                'message': 'Failed to monitor transactions'
            }, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['get'])
    def suspicious(self, request):
        """
        Get all suspicious transactions
        """
        suspicious = self.queryset.filter(is_suspicious=True)
        page = self.paginate_queryset(suspicious)
        
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        
        serializer = self.get_serializer(suspicious, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def high_risk(self, request):
        """
        Get high-risk transactions
        """
        high_risk = self.queryset.filter(risk_score__gte=0.7)
        page = self.paginate_queryset(high_risk)
        
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        
        serializer = self.get_serializer(high_risk, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['post'])
    def bulk_import(self, request):
        """
        Bulk import sample transactions
        """
        count = request.data.get('count', 200)
        
        try:
            # Call the management command
            out = StringIO()
            call_command('create_sample_transactions', count=count, stdout=out)
            output = out.getvalue()

            # Ensure newly created transactions are AML-checked.
            monitor = TransactionMonitor()
            processed_count = 0
            for tx in Transaction.objects.all():
                try:
                    monitor.process_transaction(tx)
                    processed_count += 1
                except Exception as monitor_err:
                    logger.error(f"Failed to monitor transaction {tx.transaction_id}: {str(monitor_err)}")
            
            return Response({
                'message': f'Successfully imported {count} transactions',
                'output': output,
                'aml_processed': processed_count
            }, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({
                'error': str(e),
                'message': 'Failed to import transactions'
            }, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['delete'])
    def clear_all(self, request):
        """
        Clear all transactions from the database
        """
        try:
            count = Transaction.objects.count()
            Transaction.objects.all().delete()
            
            return Response({
                'message': f'Successfully cleared {count} transaction(s)',
                'deleted_count': count
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({
                'error': str(e),
                'message': 'Failed to clear transactions'
            }, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['post'])
    def import_excel(self, request):
        """
        Import transactions from Excel file
        Expected columns:
        - transaction_id (required, unique)
        - reference_number (optional)
        - transaction_type (required: DEPOSIT, WITHDRAWAL, TRANSFER, PAYMENT, WIRE, ATM, CHECK, CARD, CRYPTO, OTHER)
        - amount (required, decimal)
        - currency (optional, default: USD)
        - sender_customer_id (required, must exist in Customer table)
        - receiver_customer_id (optional, must exist if provided)
        - originating_country (optional)
        - destination_country (optional)
        - sender_account (optional)
        - receiver_account (optional)
        - sender_bank (optional)
        - receiver_bank (optional)
        - description (optional)
        - status (optional: PENDING, COMPLETED, FAILED, FLAGGED, UNDER_REVIEW, CLEARED, BLOCKED)
        - transaction_date (required, datetime format)
        - ip_address (optional)
        - device_id (optional)
        - channel (optional)
        """
        if 'file' not in request.FILES:
            return Response({
                'error': 'No file provided',
                'message': 'Please upload an Excel file'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        file = request.FILES['file']
        
        # Validate file extension
        if not file.name.endswith(('.xlsx', '.xls')):
            return Response({
                'error': 'Invalid file type',
                'message': 'Please upload an Excel file (.xlsx or .xls)'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            # Read Excel file
            df = pd.read_excel(file)
            
            # Strip whitespace from column names
            df.columns = df.columns.str.strip()
            
            # Required columns
            required_columns = ['transaction_id', 'transaction_type', 'amount', 'sender_customer_id', 'transaction_date']
            
            # Check for required columns (case-insensitive)
            actual_columns_lower = {col.lower(): col for col in df.columns}
            missing_columns = []
            
            for req_col in required_columns:
                if req_col.lower() not in actual_columns_lower:
                    missing_columns.append(req_col)
            
            if missing_columns:
                return Response({
                    'error': 'Missing required columns',
                    'message': f'Excel file must contain the following columns: {", ".join(required_columns)}',
                    'missing_columns': missing_columns,
                    'found_columns': list(df.columns)
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Create a mapping for case-insensitive column access
            column_map = {col.lower(): col for col in df.columns}
            
            # Helper function to get column value (case-insensitive)
            def get_col(row, col_name):
                col_key = col_name.lower()
                if col_key in column_map:
                    return row.get(column_map[col_key])
                return None
            
            # Validation results
            validation_errors = []
            valid_rows = []
            imported_count = 0
            skipped_count = 0
            
            # Get all customer IDs for validation
            customer_ids = set(Customer.objects.filter(is_active=True).values_list('id', flat=True))
            
            # Transaction type choices
            valid_transaction_types = [choice[0] for choice in Transaction.TRANSACTION_TYPE_CHOICES]
            valid_statuses = [choice[0] for choice in Transaction.STATUS_CHOICES]
            
            # Check for duplicate transaction_ids in the file
            existing_transaction_ids = set(Transaction.objects.values_list('transaction_id', flat=True))
            
            for index, row in df.iterrows():
                row_num = index + 2  # Excel row numbers start at 1, plus header row
                row_errors = []
                
                # Validate transaction_id
                transaction_id_val = get_col(row, 'transaction_id')
                transaction_id = str(transaction_id_val if transaction_id_val is not None else '').strip()
                if not transaction_id:
                    row_errors.append(f'Row {row_num}: transaction_id is required')
                elif transaction_id in existing_transaction_ids:
                    row_errors.append(f'Row {row_num}: transaction_id "{transaction_id}" already exists')
                
                # Validate transaction_type
                transaction_type_val = get_col(row, 'transaction_type')
                transaction_type = str(transaction_type_val if transaction_type_val is not None else '').strip().upper()
                if not transaction_type:
                    row_errors.append(f'Row {row_num}: transaction_type is required')
                elif transaction_type not in valid_transaction_types:
                    row_errors.append(f'Row {row_num}: Invalid transaction_type "{transaction_type}". Must be one of: {", ".join(valid_transaction_types)}')
                
                # Validate amount
                try:
                    amount_val = get_col(row, 'amount')
                    amount = Decimal(str(amount_val if amount_val is not None else 0))
                    if amount <= 0:
                        row_errors.append(f'Row {row_num}: amount must be greater than 0')
                except (ValueError, InvalidOperation):
                    row_errors.append(f'Row {row_num}: Invalid amount format')
                    amount = None
                
                # Validate sender_customer_id
                try:
                    sender_id_val = get_col(row, 'sender_customer_id')
                    sender_id = int(sender_id_val if sender_id_val is not None else 0)
                    if sender_id not in customer_ids:
                        row_errors.append(f'Row {row_num}: sender_customer_id "{sender_id}" does not exist')
                except (ValueError, TypeError):
                    row_errors.append(f'Row {row_num}: Invalid sender_customer_id format')
                    sender_id = None
                
                # Validate receiver_customer_id (optional)
                receiver_id = None
                receiver_id_val = get_col(row, 'receiver_customer_id')
                if receiver_id_val is not None and pd.notna(receiver_id_val):
                    try:
                        receiver_id = int(receiver_id_val)
                        if receiver_id not in customer_ids:
                            row_errors.append(f'Row {row_num}: receiver_customer_id "{receiver_id}" does not exist')
                    except (ValueError, TypeError):
                        row_errors.append(f'Row {row_num}: Invalid receiver_customer_id format')
                
                # Validate transaction_date
                transaction_date = None
                transaction_date_val = get_col(row, 'transaction_date')
                if transaction_date_val is not None and pd.notna(transaction_date_val):
                    try:
                        if isinstance(transaction_date_val, pd.Timestamp):
                            transaction_date = transaction_date_val.to_pydatetime()
                        elif isinstance(transaction_date_val, datetime):
                            transaction_date = transaction_date_val
                        else:
                            transaction_date = pd.to_datetime(transaction_date_val).to_pydatetime()
                    except (ValueError, TypeError):
                        row_errors.append(f'Row {row_num}: Invalid transaction_date format')
                else:
                    row_errors.append(f'Row {row_num}: transaction_date is required')
                
                # Validate status (optional)
                status_val = get_col(row, 'status')
                transaction_status = str(status_val if status_val is not None else 'PENDING').strip().upper()
                if transaction_status and transaction_status not in valid_statuses:
                    row_errors.append(f'Row {row_num}: Invalid status "{transaction_status}". Must be one of: {", ".join(valid_statuses)}')
                    transaction_status = 'PENDING'
                
                # Validate currency (optional, default to USD)
                currency_val = get_col(row, 'currency')
                currency = str(currency_val if currency_val is not None else 'USD').strip().upper()[:3]
                if not currency:
                    currency = 'USD'
                
                if row_errors:
                    validation_errors.extend(row_errors)
                    skipped_count += 1
                else:
                    # Store valid row data
                    def safe_get(col_name, default=''):
                        val = get_col(row, col_name)
                        if val is None or (isinstance(val, float) and pd.isna(val)):
                            return default
                        return str(val).strip()
                    
                    valid_rows.append({
                        'transaction_id': transaction_id,
                        'reference_number': safe_get('reference_number'),
                        'transaction_type': transaction_type,
                        'amount': amount,
                        'currency': currency,
                        'sender_id': sender_id,
                        'receiver_id': receiver_id,
                        'originating_country': safe_get('originating_country'),
                        'destination_country': safe_get('destination_country'),
                        'sender_account': safe_get('sender_account'),
                        'receiver_account': safe_get('receiver_account'),
                        'sender_bank': safe_get('sender_bank'),
                        'receiver_bank': safe_get('receiver_bank'),
                        'description': safe_get('description'),
                        'status': transaction_status,
                        'transaction_date': transaction_date,
                        'ip_address': safe_get('ip_address') or None,
                        'device_id': safe_get('device_id'),
                        'channel': safe_get('channel'),
                    })
            
            # If there are validation errors, return them
            if validation_errors:
                return Response({
                    'error': 'Validation failed',
                    'message': f'Found {len(validation_errors)} validation error(s). {skipped_count} row(s) will be skipped.',
                    'validation_errors': validation_errors[:50],  # Limit to first 50 errors
                    'total_errors': len(validation_errors),
                    'valid_rows': len(valid_rows),
                    'skipped_rows': skipped_count
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Import valid transactions
            monitor = TransactionMonitor()
            for row_data in valid_rows:
                try:
                    sender = Customer.objects.get(id=row_data['sender_id'], is_active=True)
                    receiver = None
                    if row_data['receiver_id']:
                        receiver = Customer.objects.get(id=row_data['receiver_id'], is_active=True)
                    
                    transaction = Transaction.objects.create(
                        transaction_id=row_data['transaction_id'],
                        reference_number=row_data['reference_number'],
                        transaction_type=row_data['transaction_type'],
                        amount=row_data['amount'],
                        currency=row_data['currency'],
                        sender=sender,
                        receiver=receiver,
                        originating_country=row_data['originating_country'],
                        destination_country=row_data['destination_country'],
                        sender_account=row_data['sender_account'],
                        receiver_account=row_data['receiver_account'],
                        sender_bank=row_data['sender_bank'],
                        receiver_bank=row_data['receiver_bank'],
                        description=row_data['description'],
                        status=row_data['status'],
                        transaction_date=row_data['transaction_date'],
                        ip_address=row_data['ip_address'],
                        device_id=row_data['device_id'],
                        channel=row_data['channel'],
                    )
                    try:
                        monitor.process_transaction(transaction)
                    except Exception as monitor_error:
                        logger.error(f"AML monitoring failed for imported transaction {transaction.transaction_id}: {str(monitor_error)}")
                    broadcast_transaction_update(transaction)
                    imported_count += 1
                    existing_transaction_ids.add(transaction.transaction_id)  # Update to prevent duplicates
                except Exception as e:
                    validation_errors.append(f'Row with transaction_id "{row_data["transaction_id"]}": {str(e)}')
                    skipped_count += 1
            
            if validation_errors:
                return Response({
                    'error': 'Import completed with errors',
                    'message': f'Imported {imported_count} transaction(s), {skipped_count} skipped',
                    'validation_errors': validation_errors,
                    'imported_count': imported_count,
                    'skipped_count': skipped_count
                }, status=status.HTTP_207_MULTI_STATUS)
            
            return Response({
                'message': f'Successfully imported {imported_count} transaction(s)',
                'imported_count': imported_count,
                'skipped_count': skipped_count
            }, status=status.HTTP_201_CREATED)
            
        except pd.errors.EmptyDataError:
            return Response({
                'error': 'Empty file',
                'message': 'The Excel file is empty'
            }, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({
                'error': 'Import failed',
                'message': f'Failed to import transactions: {str(e)}'
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get', 'post'])
    def sources(self, request):
        """
        Manage transaction data source configurations.
        """
        if request.method.lower() == 'get':
            try:
                sources = TransactionDataSource.objects.all().order_by('name')
                serializer = TransactionDataSourceSerializer(sources, many=True)
                return Response({'count': len(serializer.data), 'results': serializer.data})
            except (OperationalError, ProgrammingError):
                # Table may not exist before migrations are applied.
                return Response({
                    'count': 0,
                    'results': [],
                    'message': 'Transaction data source table is not ready. Run migrations.'
                }, status=status.HTTP_200_OK)

        source_id = request.data.get('id')
        try:
            if source_id:
                try:
                    instance = TransactionDataSource.objects.get(id=source_id)
                except TransactionDataSource.DoesNotExist:
                    return Response({'error': 'Source not found'}, status=status.HTTP_404_NOT_FOUND)
                serializer = TransactionDataSourceSerializer(instance, data=request.data, partial=True)
            else:
                serializer = TransactionDataSourceSerializer(data=request.data)

            serializer.is_valid(raise_exception=True)
            source = serializer.save()
            return Response(TransactionDataSourceSerializer(source).data, status=status.HTTP_201_CREATED if not source_id else status.HTTP_200_OK)
        except (OperationalError, ProgrammingError):
            return Response({
                'error': 'Transaction data source table is not ready. Run migrations.'
            }, status=status.HTTP_503_SERVICE_UNAVAILABLE)


class TransactionPatternViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for Transaction Patterns (read-only)
    """
    queryset = TransactionPattern.objects.all()
    serializer_class = TransactionPatternSerializer
    # TODO: Change back to [IsAuthenticated] in production
    permission_classes = [AllowAny]  # Temporarily allowing unauthenticated access for development
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['customer', 'sudden_increase_flag', 'dormant_account_activity']
    ordering = ['-last_updated']


def transaction_stream_demo(request):
    return render(request, 'transactions_stream.html')
