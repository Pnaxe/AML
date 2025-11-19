# Quick Start Guide - AML System

Get your AI-powered Anti-Money Laundering system up and running in minutes!

## Prerequisites Checklist

- [ ] Python 3.10+ installed
- [ ] PostgreSQL 12+ installed and running
- [ ] Git installed
- [ ] Virtual environment tool (venv/virtualenv)

## 5-Minute Setup

### Step 1: Install Dependencies

```bash
# Create and activate virtual environment
python -m venv venv

# Windows
venv\Scripts\activate

# Linux/Mac
source venv/bin/activate

# Install packages
pip install -r requirements.txt
```

### Step 2: Configure Database

**Create PostgreSQL Database:**

```bash
# Connect to PostgreSQL
psql -U postgres

# In PostgreSQL prompt:
CREATE DATABASE aml_database;
\q
```

**Update Database Settings:**

Edit `aml_system/settings.py`:

```python
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': 'aml_database',
        'USER': 'postgres',
        'PASSWORD': 'your_password',  # <-- Change this
        'HOST': 'localhost',
        'PORT': '5432',
    }
}
```

### Step 3: Initialize Database

```bash
# Create database tables
python manage.py migrate

# Create admin user
python manage.py createsuperuser
# Follow prompts to set username, email, password
```

### Step 4: Start the Server

```bash
python manage.py runserver
```

✅ Your AML system is now running at **http://localhost:8000/**

## First Steps

### Access Admin Panel

1. Navigate to **http://localhost:8000/admin/**
2. Login with your superuser credentials
3. Explore the dashboard

### Get API Token

```bash
curl -X POST http://localhost:8000/api/auth/token/ \
  -H "Content-Type: application/json" \
  -d '{"username": "your_username", "password": "your_password"}'
```

Save the token returned - you'll need it for API calls!

### Create Your First Customer

**Via Admin Panel:**
1. Go to Accounts → Customers → Add Customer
2. Fill in customer details
3. Save

**Via API:**

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

### Create Your First Transaction

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

**What happens next?**
- Transaction is automatically analyzed by the AI/ML engine
- Risk score is calculated
- If suspicious, an alert is automatically generated
- You can view alerts in the admin panel or via API

### View Alerts

**Via Admin Panel:**
- Go to Alerts → Alerts

**Via API:**

```bash
curl -X GET http://localhost:8000/api/alerts/ \
  -H "Authorization: Token YOUR_TOKEN"
```

## Test the AI/ML Features

### 1. Create a High-Risk Transaction

```python
# Open Django shell
python manage.py shell

# Run this code:
from accounts.models import Customer
from transactions.models import Transaction
from datetime import datetime

# Create high-risk customer
customer = Customer.objects.create(
    customer_id='HIGHRISK001',
    customer_type='INDIVIDUAL',
    first_name='High',
    last_name='Risk',
    country='IR',  # High-risk country
    is_pep=True,
    risk_level='HIGH'
)

# Create large transaction
transaction = Transaction.objects.create(
    transaction_id='TXNHIGH001',
    transaction_type='WIRE',
    amount=150000.00,  # Large amount
    currency='USD',
    sender=customer,
    transaction_date=datetime.now(),
    originating_country='IR',
    destination_country='US'
)

# Process through AML
from ml_engine.monitoring import TransactionMonitor
monitor = TransactionMonitor()
results = monitor.process_transaction(transaction)
print(results)
```

You should see:
- High risk score
- Multiple flags triggered
- Alert automatically created

### 2. Check Risk Scores

```bash
curl -X GET http://localhost:8000/api/ml/risk-scores/ \
  -H "Authorization: Token YOUR_TOKEN"
```

### 3. View Anomalies

```bash
curl -X GET http://localhost:8000/api/ml/anomalies/ \
  -H "Authorization: Token YOUR_TOKEN"
```

## Common Issues & Solutions

### Issue: Can't connect to PostgreSQL

**Solution:**
```bash
# Check if PostgreSQL is running
# Windows:
net start postgresql-x64-XX

# Linux:
sudo service postgresql start

# Mac:
brew services start postgresql
```

### Issue: Migration errors

**Solution:**
```bash
# Delete migrations and recreate
find . -path "*/migrations/*.py" -not -name "__init__.py" -delete
find . -path "*/migrations/*.pyc" -delete
python manage.py makemigrations
python manage.py migrate
```

### Issue: Import errors

**Solution:**
```bash
# Make sure virtual environment is activated
# Reinstall dependencies
pip install -r requirements.txt --force-reinstall
```

## Next Steps

1. **Explore the API**: Check out the full API documentation in README.md
2. **Configure Rules**: Set up custom alert rules via admin panel
3. **Customize Risk Factors**: Modify `ml_engine/ml_service.py` to adjust risk weights
4. **Add More Customers**: Build your customer database
5. **Run Batch Processing**: Process historical transactions

## Need Help?

- 📖 Full documentation: See `README.md`
- 🔧 Management commands: See `manage_commands.md`
- 💻 API endpoints: Listed in `README.md`

## Production Checklist

Before deploying to production:

- [ ] Change `SECRET_KEY` in settings.py
- [ ] Set `DEBUG = False`
- [ ] Update `ALLOWED_HOSTS`
- [ ] Use environment variables for sensitive data
- [ ] Enable HTTPS
- [ ] Set up proper logging
- [ ] Configure backup strategy
- [ ] Review security settings

---

**Congratulations! Your AML system is ready to use! 🎉**

