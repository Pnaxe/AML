# AI-Powered Anti-Money Laundering (AML) System

A comprehensive Django-based AML system with AI/ML capabilities for detecting suspicious financial transactions and managing compliance workflows.

## Features

### 🔍 Transaction Monitoring
- **Real-time transaction analysis** with AI-powered risk scoring
- **Multi-factor risk assessment** including amount, velocity, country risk, and customer profiles
- **Automated flag detection** for structuring, velocity, and pattern anomalies
- **Comprehensive transaction tracking** with full audit trails

### 🤖 AI/ML Components
- **Transaction Risk Scorer**: Multi-dimensional risk assessment engine
- **Anomaly Detection**: Statistical and behavioral anomaly identification
- **Structuring Detection**: Identifies smurfing and threshold avoidance patterns
- **Pattern Recognition**: Learns normal behavior and detects deviations
- **Model Management**: Version control and performance tracking for ML models

### 🚨 Alert Management
- **Automated alert generation** based on configurable rules
- **Priority-based case management** with SLA tracking
- **Investigation workflow** with evidence collection and documentation
- **SAR (Suspicious Activity Report) filing support**
- **Alert escalation** and assignment capabilities

### 👥 Customer Risk Profiling
- **KYC (Know Your Customer) management**
- **PEP (Politically Exposed Person) screening**
- **Sanctions list matching**
- **Dynamic risk scoring** based on transaction history
- **Behavioral pattern analysis**

### 📊 Admin Dashboard
- Full-featured Django admin interface
- Real-time monitoring and reporting
- User role management (Admin, Analyst, Investigator, Viewer)
- Comprehensive filtering and search capabilities

## Technology Stack

- **Backend**: Django 5.1.7
- **API**: Django REST Framework 3.15.2
- **Database**: PostgreSQL
- **ML/AI**: NumPy, scikit-learn, Pandas
- **Authentication**: Token-based authentication

## Installation

### Prerequisites
- Python 3.10 or higher
- PostgreSQL 12 or higher
- pip (Python package manager)

### 1. Clone the Repository
```bash
git clone <your-repo-url>
cd AML
```

### 2. Create Virtual Environment
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. Configure PostgreSQL Database

Create a PostgreSQL database:
```sql
CREATE DATABASE aml_database;
CREATE USER postgres WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE aml_database TO postgres;
```

Update database credentials in `aml_system/settings.py`:
```python
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': 'aml_database',
        'USER': 'postgres',
        'PASSWORD': 'your_password',
        'HOST': 'localhost',
        'PORT': '5432',
    }
}
```

### 5. Run Migrations
```bash
python manage.py makemigrations
python manage.py migrate
```

### 6. Create Superuser
```bash
python manage.py createsuperuser
```

### 7. Run Development Server
```bash
python manage.py runserver
```

The application will be available at `http://localhost:8000/`

## API Endpoints

### Authentication
- `POST /api/auth/token/` - Obtain authentication token

### Customers
- `GET /api/accounts/customers/` - List all customers
- `POST /api/accounts/customers/` - Create new customer
- `GET /api/accounts/customers/{id}/` - Get customer details
- `PUT /api/accounts/customers/{id}/` - Update customer
- `POST /api/accounts/customers/{id}/update_risk_profile/` - Update risk profile
- `GET /api/accounts/customers/high_risk/` - List high-risk customers
- `GET /api/accounts/customers/pep/` - List PEP customers
- `GET /api/accounts/customers/sanctioned/` - List sanctioned customers

### Transactions
- `GET /api/transactions/` - List all transactions
- `POST /api/transactions/` - Create new transaction (auto-triggers AML monitoring)
- `GET /api/transactions/{id}/` - Get transaction details
- `POST /api/transactions/{id}/reprocess/` - Reprocess transaction through AML
- `GET /api/transactions/suspicious/` - List suspicious transactions
- `GET /api/transactions/high_risk/` - List high-risk transactions

### Alerts
- `GET /api/alerts/` - List all alerts
- `GET /api/alerts/{id}/` - Get alert details
- `POST /api/alerts/{id}/assign/` - Assign alert to user
- `POST /api/alerts/{id}/resolve/` - Resolve alert
- `POST /api/alerts/{id}/escalate/` - Escalate alert
- `GET /api/alerts/my_alerts/` - Get current user's alerts
- `GET /api/alerts/unassigned/` - List unassigned alerts

### Investigations
- `GET /api/investigations/` - List investigations
- `POST /api/investigations/` - Create investigation
- `POST /api/investigations/{id}/complete/` - Complete investigation

### ML Engine
- `GET /api/ml/models/` - List ML models
- `POST /api/ml/models/{id}/deploy/` - Deploy ML model
- `GET /api/ml/risk-scores/` - List risk scores
- `GET /api/ml/predictions/` - List predictions
- `GET /api/ml/anomalies/` - List detected anomalies
- `POST /api/ml/anomalies/{id}/review/` - Review anomaly

## Usage Examples

### 1. Create a Customer
```bash
curl -X POST http://localhost:8000/api/accounts/customers/ \
  -H "Authorization: Token YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "CUST001",
    "customer_type": "INDIVIDUAL",
    "first_name": "John",
    "last_name": "Doe",
    "email": "john.doe@example.com",
    "country": "US"
  }'
```

### 2. Create a Transaction (Auto-triggers AML Monitoring)
```bash
curl -X POST http://localhost:8000/api/transactions/ \
  -H "Authorization: Token YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "transaction_id": "TXN001",
    "transaction_type": "WIRE",
    "amount": "15000.00",
    "currency": "USD",
    "sender": 1,
    "transaction_date": "2025-10-29T10:00:00Z",
    "originating_country": "US",
    "destination_country": "UK"
  }'
```

## Configuration

### AML Settings (in `settings.py`)

```python
# Risk Thresholds
AML_RISK_THRESHOLD_HIGH = 0.7      # High risk threshold
AML_RISK_THRESHOLD_MEDIUM = 0.4    # Medium risk threshold
AML_MONITORING_ENABLED = True      # Enable/disable monitoring
```

### High-Risk Countries

Update the high-risk country list in `ml_engine/ml_service.py`:

```python
HIGH_RISK_COUNTRIES = [
    'AF', 'IR', 'KP', 'SY', 'YE',  # Add country codes
]
```

## Project Structure

```
AML/
├── aml_system/           # Main project settings
├── accounts/             # Customer and user management
│   ├── models.py        # Customer, CustomUser models
│   ├── views.py         # API views
│   ├── serializers.py   # API serializers
│   └── admin.py         # Admin interface
├── transactions/         # Transaction management
│   ├── models.py        # Transaction, TransactionPattern models
│   ├── views.py         # API views
│   └── serializers.py   # API serializers
├── alerts/              # Alert and case management
│   ├── models.py        # Alert, Investigation, AlertRule models
│   ├── views.py         # API views
│   └── serializers.py   # API serializers
├── ml_engine/           # AI/ML components
│   ├── models.py        # MLModel, RiskScore, AnomalyDetection models
│   ├── ml_service.py    # ML risk scoring engines
│   ├── monitoring.py    # Real-time monitoring service
│   └── views.py         # API views
└── requirements.txt     # Python dependencies
```

## ML Models & Risk Scoring

### Transaction Risk Factors

The system evaluates transactions using multiple risk factors:

1. **Amount Risk** (25%): Based on transaction size
2. **Velocity Risk** (20%): Transaction frequency analysis
3. **Country Risk** (20%): High-risk jurisdiction detection
4. **Customer Profile** (15%): Customer's risk level
5. **Pattern Deviation** (10%): Unusual behavior detection
6. **PEP/Sanctions** (10%): Political exposure and sanctions matching

### Anomaly Detection

Uses statistical methods to identify:
- Statistical outliers (Z-score analysis)
- Time-based anomalies (unusual hours)
- Behavioral changes

### Structuring Detection

Identifies attempts to avoid reporting thresholds:
- Multiple transactions just below $10,000
- Rapid succession of similar amounts
- Pattern-based structuring detection

## Development

### Running Tests
```bash
pytest
```

### Code Formatting
```bash
black .
```

### Linting
```bash
flake8
```

## Production Deployment

### 1. Update Settings for Production

```python
DEBUG = False
ALLOWED_HOSTS = ['your-domain.com']
SECRET_KEY = os.environ.get('SECRET_KEY')
```

### 2. Collect Static Files
```bash
python manage.py collectstatic
```

### 3. Run with Gunicorn
```bash
gunicorn aml_system.wsgi:application
```

## Security Considerations

- ✅ All API endpoints require authentication
- ✅ Role-based access control
- ✅ Sensitive data encryption in transit
- ✅ Audit trails for all transactions and alerts
- ⚠️ Update `SECRET_KEY` for production
- ⚠️ Use environment variables for sensitive configuration
- ⚠️ Enable HTTPS in production
- ⚠️ Regular security audits recommended

## Future Enhancements

- [ ] Advanced ML models (XGBoost, Neural Networks)
- [ ] Network analysis for related entity detection
- [ ] Automated SAR filing
- [ ] Enhanced data visualization dashboard
- [ ] Integration with external sanctions databases
- [ ] Real-time streaming data processing
- [ ] Mobile application

## License

[Add your license here]

## Support

For questions and support, please contact [your-contact-info]

## Contributing

Contributions are welcome! Please read the contributing guidelines before submitting pull requests.

---

**Note**: This system is designed for AML compliance monitoring. Ensure you comply with all local regulations and data protection laws when deploying in production.

