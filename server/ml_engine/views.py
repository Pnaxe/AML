from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone
from django.conf import settings
from django.db.models import QuerySet
from pathlib import Path
import re
from urllib.parse import unquote

import joblib
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score
from sklearn.model_selection import train_test_split

from .models import MLModel, RiskScore, ModelPrediction, AnomalyDetection
from .serializers import (
    MLModelSerializer,
    RiskScoreSerializer,
    ModelPredictionSerializer,
    AnomalyDetectionSerializer
)
from transactions.models import Transaction


class MLModelViewSet(viewsets.ModelViewSet):
    """
    ViewSet for ML Model management
    """
    queryset = MLModel.objects.all()
    serializer_class = MLModelSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['model_type', 'status', 'algorithm']
    ordering = ['-created_at']

    def _normalize_training_dataframe(self, df: pd.DataFrame) -> pd.DataFrame:
        df = df.copy()
        df.columns = [str(c).strip().lower() for c in df.columns]

        alias_map = {
            'is_suspicious': ['is_suspicious', 'label', 'target', 'y'],
            'amount': ['amount', 'transaction_amount'],
            'transaction_type': ['transaction_type', 'type'],
            'status': ['status', 'transaction_status'],
            'currency': ['currency'],
            'hour_of_day': ['hour_of_day', 'hour'],
            'day_of_week': ['day_of_week', 'weekday'],
            'is_cross_border': ['is_cross_border', 'cross_border'],
            'sender_risk_score': ['sender_risk_score', 'risk_score', 'customer_risk_score'],
            'sender_is_pep': ['sender_is_pep', 'is_pep', 'pep_flag'],
            'sender_is_sanctioned': ['sender_is_sanctioned', 'is_sanctioned', 'sanctioned_flag'],
            'velocity_flag': ['velocity_flag'],
            'structuring_flag': ['structuring_flag'],
            'unusual_pattern_flag': ['unusual_pattern_flag'],
            'high_risk_country_flag': ['high_risk_country_flag'],
            'amount_threshold_flag': ['amount_threshold_flag'],
        }

        renamed = {}
        for canonical, aliases in alias_map.items():
            for col in aliases:
                if col in df.columns:
                    renamed[col] = canonical
                    break
        df = df.rename(columns=renamed)

        if 'is_suspicious' not in df.columns:
            raise ValueError('Dataset must include an `is_suspicious` (or label/target) column.')
        if 'amount' not in df.columns:
            raise ValueError('Dataset must include an `amount` column.')

        defaults = {
            'transaction_type': 'TRANSFER',
            'status': 'COMPLETED',
            'currency': 'USD',
            'hour_of_day': 12,
            'day_of_week': 2,
            'is_cross_border': 0,
            'sender_risk_score': 0.0,
            'sender_is_pep': 0,
            'sender_is_sanctioned': 0,
            'velocity_flag': 0,
            'structuring_flag': 0,
            'unusual_pattern_flag': 0,
            'high_risk_country_flag': 0,
            'amount_threshold_flag': 0,
        }
        for col, default in defaults.items():
            if col not in df.columns:
                df[col] = default

        # Keep only the canonical training schema and drop all other uploaded columns
        # (e.g. IDs like customer_id/account_number) so sklearn only receives model features.
        allowed_cols = [
            'amount',
            'transaction_type',
            'status',
            'currency',
            'hour_of_day',
            'day_of_week',
            'is_cross_border',
            'sender_risk_score',
            'sender_is_pep',
            'sender_is_sanctioned',
            'velocity_flag',
            'structuring_flag',
            'unusual_pattern_flag',
            'high_risk_country_flag',
            'amount_threshold_flag',
            'is_suspicious',
        ]
        df = df[[col for col in allowed_cols if col in df.columns]]

        numeric_cols = [
            'amount',
            'hour_of_day',
            'day_of_week',
            'is_cross_border',
            'sender_risk_score',
            'sender_is_pep',
            'sender_is_sanctioned',
            'velocity_flag',
            'structuring_flag',
            'unusual_pattern_flag',
            'high_risk_country_flag',
            'amount_threshold_flag',
            'is_suspicious',
        ]
        for col in numeric_cols:
            df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)

        df['is_suspicious'] = (df['is_suspicious'] > 0).astype(int)
        return df

    def _load_dataframe_from_dataset_path(self, file_path: Path) -> pd.DataFrame:
        lower = file_path.name.lower()
        if lower.endswith('.csv'):
            return pd.read_csv(file_path)
        if lower.endswith('.xlsx') or lower.endswith('.xls'):
            return pd.read_excel(file_path)
        raise ValueError('Unsupported dataset format. Use CSV or Excel.')

    def _train_model_from_dataframe(self, df: pd.DataFrame, name: str, algorithm: str, test_size: float, description: str):
        if len(df) < 30:
            raise ValueError('At least 30 rows are required to train a model.')
        if df['is_suspicious'].nunique() < 2:
            raise ValueError('Training data must include both suspicious and non-suspicious samples.')

        y = df['is_suspicious']
        X = df.drop(columns=['is_suspicious'])
        X = pd.get_dummies(X, columns=['transaction_type', 'status', 'currency'], drop_first=False)
        feature_columns = list(X.columns)

        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=test_size, random_state=42, stratify=y
        )

        if algorithm == 'LOGISTIC_REGRESSION':
            model = LogisticRegression(max_iter=500, random_state=42)
            hyperparameters = {'max_iter': 500, 'random_state': 42}
        else:
            algorithm = 'RANDOM_FOREST'
            model = RandomForestClassifier(
                n_estimators=200,
                max_depth=12,
                min_samples_split=8,
                random_state=42,
                n_jobs=-1
            )
            hyperparameters = {
                'n_estimators': 200,
                'max_depth': 12,
                'min_samples_split': 8,
                'random_state': 42
            }

        model.fit(X_train, y_train)
        pred = model.predict(X_test)
        pred_proba = model.predict_proba(X_test)[:, 1] if hasattr(model, 'predict_proba') else pred

        accuracy = float(accuracy_score(y_test, pred))
        precision = float(precision_score(y_test, pred, zero_division=0))
        recall = float(recall_score(y_test, pred, zero_division=0))
        f1 = float(f1_score(y_test, pred, zero_division=0))
        try:
            auc_roc = float(roc_auc_score(y_test, pred_proba))
        except Exception:
            auc_roc = 0.0

        safe_name = re.sub(r'[^a-zA-Z0-9_-]+', '-', name).strip('-').lower() or 'transaction-risk-model'
        version = timezone.now().strftime('%Y.%m.%d.%H%M%S')
        model_dir = Path(settings.MEDIA_ROOT) / 'ml_models'
        model_dir.mkdir(parents=True, exist_ok=True)
        artifact_path = model_dir / f'{safe_name}_v{version}.joblib'

        joblib.dump(
            {
                'model': model,
                'feature_columns': feature_columns,
                'algorithm': algorithm,
                'trained_at': timezone.now().isoformat()
            },
            artifact_path
        )

        ml_model = MLModel.objects.create(
            name=name,
            model_type='TRANSACTION_RISK',
            version=version,
            status='TESTING',
            description=description,
            algorithm=algorithm,
            accuracy=accuracy,
            precision=precision,
            recall=recall,
            f1_score=f1,
            auc_roc=auc_roc,
            training_data_size=int(len(df)),
            features_used=feature_columns,
            hyperparameters=hyperparameters,
            model_file_path=str(artifact_path),
            trained_at=timezone.now(),
        )

        return {
            'message': 'Model trained successfully',
            'model_id': ml_model.id,
            'name': ml_model.name,
            'version': ml_model.version,
            'algorithm': ml_model.algorithm,
            'metrics': {
                'accuracy': accuracy,
                'precision': precision,
                'recall': recall,
                'f1_score': f1,
                'auc_roc': auc_roc,
            },
            'training_data_size': int(len(df)),
            'model_file_path': str(artifact_path),
        }

    @action(detail=False, methods=['post'])
    def train(self, request):
        """
        Train a transaction-risk model from existing transaction records.
        Expects:
        {
          "name": "Transaction Risk Model",
          "algorithm": "RANDOM_FOREST" | "LOGISTIC_REGRESSION",
          "test_size": 0.2
        }
        """
        name = (request.data.get('name') or 'Transaction Risk Model').strip()
        algorithm = (request.data.get('algorithm') or 'RANDOM_FOREST').strip().upper()
        test_size = request.data.get('test_size', 0.2)

        try:
            test_size = float(test_size)
        except (TypeError, ValueError):
            return Response({'error': 'test_size must be a float between 0.1 and 0.5'}, status=status.HTTP_400_BAD_REQUEST)

        if test_size < 0.1 or test_size > 0.5:
            return Response({'error': 'test_size must be between 0.1 and 0.5'}, status=status.HTTP_400_BAD_REQUEST)

        qs: QuerySet[Transaction] = Transaction.objects.select_related('sender', 'receiver').all()
        rows = []
        for tx in qs:
            cross_border = bool(
                tx.destination_country and
                tx.originating_country and
                tx.destination_country != tx.originating_country
            )
            rows.append({
                'amount': float(tx.amount),
                'transaction_type': tx.transaction_type,
                'status': tx.status,
                'currency': tx.currency,
                'hour_of_day': tx.transaction_date.hour if tx.transaction_date else 0,
                'day_of_week': tx.transaction_date.weekday() if tx.transaction_date else 0,
                'is_cross_border': int(cross_border),
                'sender_risk_score': float(getattr(tx.sender, 'risk_score', 0.0) or 0.0),
                'sender_is_pep': int(bool(getattr(tx.sender, 'is_pep', False))),
                'sender_is_sanctioned': int(bool(getattr(tx.sender, 'is_sanctioned', False))),
                'velocity_flag': int(tx.velocity_flag),
                'structuring_flag': int(tx.structuring_flag),
                'unusual_pattern_flag': int(tx.unusual_pattern_flag),
                'high_risk_country_flag': int(tx.high_risk_country_flag),
                'amount_threshold_flag': int(tx.amount_threshold_flag),
                'is_suspicious': int(tx.is_suspicious),
            })

        try:
            df = self._normalize_training_dataframe(pd.DataFrame(rows))
            result = self._train_model_from_dataframe(
                df=df,
                name=name,
                algorithm=algorithm,
                test_size=test_size,
                description='Trained in-app from transaction history.'
            )
            return Response(result, status=status.HTTP_201_CREATED)
        except ValueError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def datasets(self, request):
        """
        List uploaded training datasets from media/ml_datasets.
        """
        dataset_dir = Path(settings.MEDIA_ROOT) / 'ml_datasets'
        dataset_dir.mkdir(parents=True, exist_ok=True)
        results = []
        for fp in sorted(dataset_dir.glob('*'), key=lambda p: p.stat().st_mtime, reverse=True):
            if not fp.is_file():
                continue
            if not fp.name.lower().endswith(('.csv', '.xlsx', '.xls')):
                continue
            stat = fp.stat()
            results.append({
                'dataset_file': fp.name,
                'size_bytes': stat.st_size,
                'uploaded_at': timezone.datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
            })
        return Response({'count': len(results), 'results': results})

    @action(detail=False, methods=['post'], parser_classes=[MultiPartParser, FormParser])
    def upload_dataset(self, request):
        """
        Upload and store a dataset file for later training.
        """
        data_file = request.FILES.get('file')
        dataset_name = (request.data.get('dataset_name') or '').strip()
        if not data_file:
            return Response({'error': 'file is required'}, status=status.HTTP_400_BAD_REQUEST)

        original_name = data_file.name
        lower = original_name.lower()
        if not lower.endswith(('.csv', '.xlsx', '.xls')):
            return Response({'error': 'Unsupported file format. Use CSV or Excel.'}, status=status.HTTP_400_BAD_REQUEST)

        safe_base = re.sub(r'[^a-zA-Z0-9_-]+', '-', dataset_name).strip('-').lower() if dataset_name else ''
        original_base = re.sub(r'[^a-zA-Z0-9_.-]+', '-', original_name).strip('-')
        timestamp = timezone.now().strftime('%Y%m%d%H%M%S')
        target_name = f"{safe_base or original_base.rsplit('.', 1)[0]}_{timestamp}.{original_name.rsplit('.', 1)[-1]}"

        dataset_dir = Path(settings.MEDIA_ROOT) / 'ml_datasets'
        dataset_dir.mkdir(parents=True, exist_ok=True)
        target_path = dataset_dir / target_name

        with open(target_path, 'wb+') as dest:
            for chunk in data_file.chunks():
                dest.write(chunk)

        return Response(
            {
                'message': 'Dataset uploaded successfully',
                'dataset_file': target_name,
                'size_bytes': target_path.stat().st_size,
            },
            status=status.HTTP_201_CREATED
        )

    @action(detail=False, methods=['post'])
    def train_dataset(self, request):
        """
        Train a transaction-risk model from a previously uploaded dataset file.
        Expects:
        {
          "dataset_file": "my_dataset_20260303123000.csv",
          "name": "Transaction Risk Model",
          "algorithm": "RANDOM_FOREST",
          "test_size": 0.2
        }
        """
        dataset_file = unquote((request.data.get('dataset_file') or '').strip())
        name = (request.data.get('name') or 'Transaction Risk Model').strip()
        algorithm = (request.data.get('algorithm') or 'RANDOM_FOREST').strip().upper()
        test_size = request.data.get('test_size', 0.2)

        if not dataset_file:
            return Response({'error': 'dataset_file is required'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            test_size = float(test_size)
        except (TypeError, ValueError):
            return Response({'error': 'test_size must be a float between 0.1 and 0.5'}, status=status.HTTP_400_BAD_REQUEST)
        if test_size < 0.1 or test_size > 0.5:
            return Response({'error': 'test_size must be between 0.1 and 0.5'}, status=status.HTTP_400_BAD_REQUEST)

        dataset_dir = Path(settings.MEDIA_ROOT) / 'ml_datasets'
        file_path = dataset_dir / dataset_file
        if not file_path.exists() or not file_path.is_file():
            return Response({'error': 'Dataset file not found.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            df = self._load_dataframe_from_dataset_path(file_path)
            df = self._normalize_training_dataframe(df)
            result = self._train_model_from_dataframe(
                df=df,
                name=name,
                algorithm=algorithm,
                test_size=test_size,
                description=f'Trained in-app from uploaded dataset: {dataset_file}'
            )
            result['source_file'] = dataset_file
            return Response(result, status=status.HTTP_201_CREATED)
        except ValueError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as exc:
            return Response({'error': f'Unable to train from dataset: {str(exc)}'}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'], parser_classes=[MultiPartParser, FormParser])
    def train_from_file(self, request):
        """
        Train a transaction-risk model from uploaded dataset file.
        Accepted files: CSV, XLSX, XLS
        Required columns:
          - is_suspicious (or label/target/y)
          - amount
        """
        name = (request.data.get('name') or 'Transaction Risk Model').strip()
        algorithm = (request.data.get('algorithm') or 'RANDOM_FOREST').strip().upper()
        test_size = request.data.get('test_size', 0.2)
        data_file = request.FILES.get('file')

        try:
            test_size = float(test_size)
        except (TypeError, ValueError):
            return Response({'error': 'test_size must be a float between 0.1 and 0.5'}, status=status.HTTP_400_BAD_REQUEST)

        if test_size < 0.1 or test_size > 0.5:
            return Response({'error': 'test_size must be between 0.1 and 0.5'}, status=status.HTTP_400_BAD_REQUEST)
        if not data_file:
            return Response({'error': 'file is required'}, status=status.HTTP_400_BAD_REQUEST)

        file_name = data_file.name.lower()
        try:
            if file_name.endswith('.csv'):
                df = pd.read_csv(data_file)
            elif file_name.endswith('.xlsx') or file_name.endswith('.xls'):
                df = pd.read_excel(data_file)
            else:
                return Response({'error': 'Unsupported file format. Use CSV or Excel.'}, status=status.HTTP_400_BAD_REQUEST)

            df = self._normalize_training_dataframe(df)
            result = self._train_model_from_dataframe(
                df=df,
                name=name,
                algorithm=algorithm,
                test_size=test_size,
                description=f'Trained in-app from uploaded dataset: {data_file.name}'
            )
            result['source_file'] = data_file.name
            return Response(result, status=status.HTTP_201_CREATED)
        except ValueError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as exc:
            return Response({'error': f'Unable to parse or train from file: {str(exc)}'}, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'])
    def deploy(self, request, pk=None):
        """
        Deploy a model (set as active)
        """
        model = self.get_object()
        
        # Deactivate other models of same type
        MLModel.objects.filter(
            model_type=model.model_type,
            status='ACTIVE'
        ).update(status='ARCHIVED')
        
        # Activate this model
        model.status = 'ACTIVE'
        model.deployed_at = timezone.now()
        model.save()
        
        return Response({
            'message': 'Model deployed successfully',
            'model_name': model.name,
            'version': model.version
        })

    @action(detail=True, methods=['post'])
    def toggle_active(self, request, pk=None):
        """
        Toggle a model on or off.
        ACTIVE -> ARCHIVED
        any other status -> ACTIVE (and archive other active models of same type)
        """
        model = self.get_object()

        if model.status == 'ACTIVE':
            model.status = 'ARCHIVED'
            model.save(update_fields=['status', 'updated_at'])
            return Response({
                'message': 'Model turned off successfully',
                'model_name': model.name,
                'version': model.version,
                'status': model.status,
            })

        MLModel.objects.filter(
            model_type=model.model_type,
            status='ACTIVE'
        ).exclude(pk=model.pk).update(status='ARCHIVED')

        model.status = 'ACTIVE'
        model.deployed_at = timezone.now()
        model.save(update_fields=['status', 'deployed_at', 'updated_at'])

        return Response({
            'message': 'Model turned on successfully',
            'model_name': model.name,
            'version': model.version,
            'status': model.status,
        })


class RiskScoreViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for Risk Scores (read-only)
    """
    queryset = RiskScore.objects.all()
    serializer_class = RiskScoreSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['entity_type', 'risk_level', 'customer', 'transaction']
    ordering = ['-calculated_at']


class ModelPredictionViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for Model Predictions (read-only)
    """
    queryset = ModelPrediction.objects.all()
    serializer_class = ModelPredictionSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['ml_model', 'is_suspicious', 'transaction']
    ordering = ['-predicted_at']
    
    @action(detail=True, methods=['post'])
    def provide_feedback(self, request, pk=None):
        """
        Provide feedback on a prediction for model retraining
        """
        prediction = self.get_object()
        actual_outcome = request.data.get('actual_outcome')
        
        if actual_outcome is None:
            return Response(
                {'error': 'actual_outcome is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        prediction.actual_outcome = actual_outcome
        prediction.feedback_provided = True
        prediction.save()
        
        return Response({
            'message': 'Feedback recorded successfully',
            'prediction_id': prediction.id
        })


class AnomalyDetectionViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Anomaly Detection
    """
    queryset = AnomalyDetection.objects.all()
    serializer_class = AnomalyDetectionSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = [
        'customer', 'transaction', 'anomaly_type',
        'reviewed', 'is_confirmed_anomaly'
    ]
    ordering = ['-detected_at']
    
    @action(detail=True, methods=['post'])
    def review(self, request, pk=None):
        """
        Review an anomaly
        """
        anomaly = self.get_object()
        is_confirmed = request.data.get('is_confirmed_anomaly')
        
        anomaly.reviewed = True
        anomaly.reviewed_at = timezone.now()
        
        if is_confirmed is not None:
            anomaly.is_confirmed_anomaly = is_confirmed
        
        anomaly.save()
        
        return Response({
            'message': 'Anomaly reviewed successfully',
            'anomaly_id': anomaly.id
        })
    
    @action(detail=False, methods=['get'])
    def unreviewed(self, request):
        """
        Get unreviewed anomalies
        """
        unreviewed = self.queryset.filter(reviewed=False)
        page = self.paginate_queryset(unreviewed)
        
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        
        serializer = self.get_serializer(unreviewed, many=True)
        return Response(serializer.data)
