import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
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
import { initAuth } from './services/auth'

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
                                <Route path="/" element={<Dashboard />} />
                                <Route path="/customers" element={<CustomerList />} />
                                <Route path="/transactions" element={<TransactionList />} />
                                <Route path="/alerts" element={<AlertList />} />
                                <Route path="/screening" element={<Screening />} />
                                <Route path="/kyc" element={<KYC />} />
                                <Route path="/sar" element={<SAR />} />
                                <Route path="/cases" element={<Cases />} />
                                <Route path="/law-enforcement" element={<LawEnforcement />} />
                                <Route path="/ml" element={<ML />} />
                                <Route path="/reports" element={<Reports />} />
                                <Route path="/configurations" element={<Configurations />} />
                            </Routes>
                        </Layout>
                    } />
                </Routes>
            </Router>
        </QueryClientProvider>
    )
}

export default App
