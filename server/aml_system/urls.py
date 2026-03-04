"""
URL configuration for aml_system project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.1/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework.routers import DefaultRouter
from rest_framework.authtoken.views import obtain_auth_token
import accounts.views as accounts_views
import accounts.auth_views as accounts_auth_views
import transactions.views as transactions_views
import alerts.views as alerts_views
import ml_engine.views as ml_engine_views

# Import KYC views if available
try:
    import kyc.views as kyc_views
    KYC_AVAILABLE = True
except ImportError:
    KYC_AVAILABLE = False

# Import Watchlist Screening views if available
try:
    import watchlist_screening.views as screening_views
    SCREENING_AVAILABLE = True
except ImportError:
    SCREENING_AVAILABLE = False

# Import Law Enforcement views if available
try:
    import law_enforcement.views as law_enforcement_views
    LAW_ENFORCEMENT_AVAILABLE = True
except ImportError:
    LAW_ENFORCEMENT_AVAILABLE = False

# API Router
router = DefaultRouter()
router.register(r'customers', accounts_views.CustomerViewSet, basename='customer')
router.register(r'transactions', transactions_views.TransactionViewSet, basename='transaction')
router.register(r'transaction-patterns', transactions_views.TransactionPatternViewSet, basename='transaction-pattern')
router.register(r'alerts', alerts_views.AlertViewSet, basename='alert')
router.register(r'investigations', alerts_views.InvestigationViewSet, basename='investigation')
router.register(r'alert-rules', alerts_views.AlertRuleViewSet, basename='alert-rule')
router.register(r'ml-models', ml_engine_views.MLModelViewSet, basename='ml-model')
router.register(r'risk-scores', ml_engine_views.RiskScoreViewSet, basename='risk-score')
router.register(r'predictions', ml_engine_views.ModelPredictionViewSet, basename='prediction')
router.register(r'anomalies', ml_engine_views.AnomalyDetectionViewSet, basename='anomaly')

# Register KYC endpoints if available
if KYC_AVAILABLE:
    router.register(r'kyc-profiles', kyc_views.KYCProfileViewSet, basename='kyc-profile')
    router.register(r'kyc-documents', kyc_views.KYCDocumentViewSet, basename='kyc-document')
    router.register(r'kyc-verification-steps', kyc_views.KYCVerificationStepViewSet, basename='kyc-verification-step')

# Register Screening endpoints if available
if SCREENING_AVAILABLE:
    router.register(r'screening', screening_views.ScreeningViewSet, basename='screening')

# Register Law Enforcement endpoints if available
if LAW_ENFORCEMENT_AVAILABLE:
    router.register(r'sar-transmissions', law_enforcement_views.SARTransmissionViewSet, basename='sar-transmission')
    router.register(r'law-enforcement-agencies', law_enforcement_views.LawEnforcementAgencyViewSet, basename='law-enforcement-agency')

urlpatterns = [
    # Admin
    path('admin/', admin.site.urls),
    
    # API Routes
    path('api/', include(router.urls)),
    path('api/auth/token/', obtain_auth_token, name='api_token_auth'),
    path('api/auth/user/', accounts_auth_views.current_user, name='api_current_user'),
    path('api/auth/change-password/', accounts_auth_views.change_password, name='api_change_password'),
    path('api-auth/', include('rest_framework.urls')),  # Browsable API login
    path(
        'transactions/stream-demo/',
        transactions_views.transaction_stream_demo,
        name='transaction-stream-demo',
    ),
    
    # Note: All frontend routes are now handled by React
    # The React app should be served separately or through a reverse proxy
]

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
