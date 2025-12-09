import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useQuery } from '@tanstack/react-query'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import RegulatorDashboard from './pages/RegulatorDashboard'
import CustomerList from './pages/CustomerList'
import TransactionList from './pages/TransactionList'
import AlertList from './pages/AlertList'
import Screening from './pages/Screening'
import KYC from './pages/KYC'
import SAR from './pages/SAR'
import Cases from './pages/Cases'
import LawEnforcement from './pages/LawEnforcement'
import ML from './pages/ML'
import Reports from './pages/Reports'
import Configurations from './pages/Configurations'
import { initAuth, getCurrentUser } from './services/auth'

// Component to conditionally render dashboard based on user role
const DashboardRoute = () => {
    const { data: currentUser, isLoading } = useQuery({
        queryKey: ['current-user'],
        queryFn: getCurrentUser,
        retry: false,
        staleTime: 5 * 60 * 1000,
    })

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
            </div>
        )
    }

    const userRole = currentUser?.role || 'VIEWER'
    
    // Show RegulatorDashboard for regulators, regular Dashboard for others
    if (userRole === 'REGULATOR') {
        return <RegulatorDashboard />
    }
    
    return <Dashboard />
}

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            refetchOnWindowFocus: false,
            retry: 1,
        },
    },
})

function App() {
    // Initialize authentication on app load
    initAuth()

    return (
        <QueryClientProvider client={queryClient}>
            <Router>
                <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/*" element={
                        <Layout>
                            <Routes>
                                <Route path="/" element={<DashboardRoute />} />
                                {/* Bank-only pages - Hidden from Regulators */}
                                <Route 
                                    path="/customers" 
                                    element={
                                        <ProtectedRoute allowedRoles={['ADMIN', 'ANALYST', 'INVESTIGATOR', 'VIEWER', 'BANK']}>
                                            <CustomerList />
                                        </ProtectedRoute>
                                    } 
                                />
                                <Route 
                                    path="/transactions" 
                                    element={
                                        <ProtectedRoute allowedRoles={['ADMIN', 'ANALYST', 'INVESTIGATOR', 'VIEWER', 'BANK']}>
                                            <TransactionList />
                                        </ProtectedRoute>
                                    } 
                                />
                                <Route 
                                    path="/alerts" 
                                    element={
                                        <ProtectedRoute allowedRoles={['ADMIN', 'ANALYST', 'INVESTIGATOR', 'VIEWER', 'BANK']}>
                                            <AlertList />
                                        </ProtectedRoute>
                                    } 
                                />
                                <Route 
                                    path="/screening" 
                                    element={
                                        <ProtectedRoute allowedRoles={['ADMIN', 'ANALYST', 'INVESTIGATOR', 'VIEWER', 'BANK']}>
                                            <Screening />
                                        </ProtectedRoute>
                                    } 
                                />
                                <Route 
                                    path="/kyc" 
                                    element={
                                        <ProtectedRoute allowedRoles={['ADMIN', 'ANALYST', 'INVESTIGATOR', 'VIEWER', 'BANK']}>
                                            <KYC />
                                        </ProtectedRoute>
                                    } 
                                />
                                <Route 
                                    path="/cases" 
                                    element={
                                        <ProtectedRoute allowedRoles={['ADMIN', 'ANALYST', 'INVESTIGATOR', 'VIEWER', 'BANK']}>
                                            <Cases />
                                        </ProtectedRoute>
                                    } 
                                />
                                <Route 
                                    path="/ml" 
                                    element={
                                        <ProtectedRoute allowedRoles={['ADMIN', 'ANALYST', 'INVESTIGATOR', 'VIEWER', 'BANK']}>
                                            <ML />
                                        </ProtectedRoute>
                                    } 
                                />
                                <Route 
                                    path="/configurations" 
                                    element={
                                        <ProtectedRoute allowedRoles={['ADMIN', 'ANALYST', 'INVESTIGATOR', 'VIEWER', 'BANK']}>
                                            <Configurations />
                                        </ProtectedRoute>
                                    } 
                                />
                                {/* Regulator-accessible pages */}
                                <Route path="/sar" element={<SAR />} />
                                <Route 
                                    path="/law-enforcement" 
                                    element={
                                        <ProtectedRoute allowedRoles={['REGULATOR']}>
                                            <LawEnforcement />
                                        </ProtectedRoute>
                                    } 
                                />
                                <Route path="/reports" element={<Reports />} />
                            </Routes>
                        </Layout>
                    } />
                </Routes>
            </Router>
        </QueryClientProvider>
    )
}

export default App
