# React Frontend Setup Guide

This guide will help you set up and run the React frontend for your AML System.

## Prerequisites

- Node.js (v18 or higher) and npm installed
- Django backend running on `http://localhost:8000`

## Quick Start

### 1. Install Dependencies

Navigate to the frontend directory and install npm packages:

```bash
cd frontend
npm install
```

### 2. Start Development Server

Run the React development server:

```bash
npm run dev
```

The React app will be available at `http://localhost:3000`

### 3. Start Django Backend

In a separate terminal, make sure your Django server is running:

```bash
python manage.py runserver
```

## Project Structure

```
frontend/
├── src/
│   ├── components/      # Reusable React components
│   │   └── Layout.jsx   # Main layout with sidebar
│   ├── pages/           # Page components
│   │   ├── Dashboard.jsx
│   │   ├── CustomerList.jsx
│   │   ├── TransactionList.jsx
│   │   └── AlertList.jsx
│   ├── services/        # API service layer
│   │   └── api.js       # Axios configuration and API endpoints
│   ├── App.jsx          # Main app component with routing
│   ├── main.jsx         # React entry point
│   └── index.css        # Global styles with Tailwind
├── package.json
├── vite.config.js       # Vite configuration
└── tailwind.config.js   # Tailwind CSS configuration
```

## API Endpoints

The React app connects to these Django REST Framework endpoints:

- **Customers**: `/api/customers/`
- **Transactions**: `/api/transactions/`
- **Alerts**: `/api/alerts/`
- **ML Models**: `/api/ml-models/`
- **Risk Scores**: `/api/risk-scores/`
- **Predictions**: `/api/predictions/`
- **Anomalies**: `/api/anomalies/`

## Authentication

The app uses Django's session authentication. Make sure you're logged in to Django admin (`/admin/login/`) before accessing the React app.

## Development Workflow

1. **Frontend Development**: 
   - Edit files in `frontend/src/`
   - Changes hot-reload automatically
   - Vite proxies API requests to Django

2. **Backend Development**:
   - API changes in Django are immediately available
   - No restart needed for frontend

## Building for Production

To create a production build:

```bash
cd frontend
npm run build
```

This creates optimized files in `static/react/` that Django can serve.

## Adding New Pages

1. Create a new component in `frontend/src/pages/`
2. Add a route in `frontend/src/App.jsx`
3. Add a navigation link in `frontend/src/components/Layout.jsx`

## Adding New API Calls

1. Add API functions in `frontend/src/services/api.js`
2. Use React Query hooks in your components:

```jsx
import { useQuery } from '@tanstack/react-query'
import { customersAPI } from '../services/api'

const MyComponent = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['customers'],
    queryFn: () => customersAPI.list(),
  })
  
  // Use data in your component
}
```

## Troubleshooting

### CORS Errors
- Make sure `corsheaders` is in `INSTALLED_APPS`
- Check `CORS_ALLOWED_ORIGINS` in `settings.py` includes `http://localhost:3000`

### 401 Unauthorized
- Log in to Django admin first
- Check that session cookies are being sent (check browser DevTools)

### API Not Found
- Verify Django server is running on port 8000
- Check that API routes are registered in `urls.py`

## Next Steps

- Add authentication/login page
- Implement forms for creating/editing resources
- Add filtering and pagination
- Add real-time updates with WebSockets
- Add charts and visualizations

