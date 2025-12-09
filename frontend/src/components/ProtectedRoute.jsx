import { Navigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getCurrentUser } from '../services/auth'

const ProtectedRoute = ({ children, allowedRoles = [] }) => {
    const { data: currentUser, isLoading } = useQuery({
        queryKey: ['current-user'],
        queryFn: getCurrentUser,
        retry: false,
        staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    })

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-gray-500">Loading...</div>
            </div>
        )
    }

    if (!currentUser) {
        return <Navigate to="/login" replace />
    }

    const userRole = currentUser?.role || 'VIEWER'

    // If allowedRoles is empty, allow all authenticated users
    if (allowedRoles.length === 0) {
        return children
    }

    // Check if user role is in allowed roles
    if (!allowedRoles.includes(userRole)) {
        // Regulators trying to access restricted pages should be redirected to dashboard
        return <Navigate to="/" replace />
    }

    return children
}

export default ProtectedRoute

