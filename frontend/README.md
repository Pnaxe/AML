# AML System React Frontend

This is the React frontend for the AML (Anti-Money Laundering) System.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

The app will be available at `http://localhost:3000`

## Building for Production

To build the React app for production:

```bash
npm run build
```

This will create a production build in `../static/react/` that can be served by Django.

## Features

- React 18 with Vite
- React Router for navigation
- React Query for data fetching
- Axios for API calls
- Tailwind CSS for styling
- Integrated with Django REST Framework API

## API Integration

The frontend connects to the Django backend API at `/api/`. Make sure your Django server is running on `http://localhost:8000`.

## Development

- The Vite dev server proxies API requests to Django
- Hot module replacement (HMR) is enabled
- The app uses session authentication with CSRF tokens

