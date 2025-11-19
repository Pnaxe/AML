import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { loginWithToken } from '../services/auth'
import logoFull from '../assets/img/logoipsum-350.png'

const Login = () => {
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [hasLoginError, setHasLoginError] = useState(false)
    const [showPassword, setShowPassword] = useState(false)
    const navigate = useNavigate()
    const queryClient = useQueryClient()

    // Use token authentication (Django REST Framework)
    const loginMutation = useMutation({
        mutationFn: async ({ username, password }) => {
            // Use token authentication - this is the standard for Django REST Framework
            return await loginWithToken(username, password)
        },
        onSuccess: () => {
            // Invalidate user query to refetch user info
            queryClient.invalidateQueries({ queryKey: ['current-user'] })
            // Redirect to dashboard on successful login
            navigate('/')
        },
        onError: (error) => {
            if (error.response?.status === 401 || error.response?.status === 400) {
                // Set error state to make fields red instead of showing message
                setHasLoginError(true)
                setError('')
            } else if (error.response?.status === 403) {
                setError('Access denied. Please contact your administrator.')
                setHasLoginError(false)
            } else if (error.response?.status === 404) {
                setError('Login endpoint not found. Please check server configuration.')
                setHasLoginError(false)
            } else {
                setError(error.response?.data?.message || error.message || 'An error occurred during login. Please try again.')
                setHasLoginError(false)
            }
        }
    })

    const handleSubmit = (e) => {
        e.preventDefault()
        setError('')
        setHasLoginError(false)
        
        if (!username.trim() || !password.trim()) {
            setError('Please enter both username and password.')
            return
        }

        loginMutation.mutate({ username, password })
    }

    // Clear error state when user starts typing
    const handleUsernameChange = (e) => {
        setUsername(e.target.value)
        if (hasLoginError) {
            setHasLoginError(false)
        }
    }

    const handlePasswordChange = (e) => {
        setPassword(e.target.value)
        if (hasLoginError) {
            setHasLoginError(false)
        }
    }

    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8" style={{ fontFamily: "'Nunito', sans-serif" }}>
            <div className="max-w-lg w-full space-y-8 bg-white p-8 rounded-lg shadow-lg">
                {/* Logo */}
                <div className="flex justify-center">
                    <img 
                        src={logoFull} 
                        alt="Logo" 
                        className="h-16 w-auto object-contain"
                    />
                </div>

                {/* Title */}
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-gray-900">Sign in to your account</h2>
                    <p className="mt-2 text-sm text-gray-600">
                        AML System - Anti-Money Laundering Platform
                    </p>
                </div>

                {/* Login Form */}
                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
                            {error}
                        </div>
                    )}

                    <div className="space-y-4">
                        {/* Username Field */}
                        <div>
                            <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                                Username
                            </label>
                            <input
                                id="username"
                                name="username"
                                type="text"
                                autoComplete="username"
                                required
                                value={username}
                                onChange={handleUsernameChange}
                                className={`appearance-none relative block w-full px-3 py-2 border placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-2 focus:z-10 sm:text-sm ${
                                    hasLoginError 
                                        ? 'border-red-500 focus:ring-red-500 focus:border-red-500' 
                                        : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                                }`}
                                placeholder="Enter your username"
                            />
                        </div>

                        {/* Password Field */}
                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                                Password
                            </label>
                            <div className="relative">
                                <input
                                    id="password"
                                    name="password"
                                    type={showPassword ? 'text' : 'password'}
                                    autoComplete="current-password"
                                    required
                                    value={password}
                                    onChange={handlePasswordChange}
                                    className={`appearance-none relative block w-full px-3 py-2 border placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-2 focus:z-10 sm:text-sm pr-10 ${
                                        hasLoginError 
                                            ? 'border-red-500 focus:ring-red-500 focus:border-red-500' 
                                            : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                                    }`}
                                    placeholder="Enter your password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                                >
                                    {showPassword ? (
                                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.29 3.29m0 0A9.97 9.97 0 015.12 5.12m3.29 3.29L12 12m-3.59-3.59L12 12m0 0l3.29 3.29M12 12l3.29-3.29m0 0a9.97 9.97 0 011.98-1.98m0 0L21 3"></path>
                                        </svg>
                                    ) : (
                                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                                        </svg>
                                    )}
                                </button>
                            </div>
                            {hasLoginError && (
                                <p className="mt-1 text-xs text-red-600">Invalid username or password. Please try again.</p>
                            )}
                        </div>
                    </div>

                    {/* Remember Me & Forgot Password */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center">
                            <input
                                id="remember-me"
                                name="remember-me"
                                type="checkbox"
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700">
                                Remember me
                            </label>
                        </div>

                        <div className="text-sm">
                            <a href="#" className="font-medium text-blue-600 hover:text-blue-500">
                                Forgot password?
                            </a>
                        </div>
                    </div>

                    {/* Submit Button */}
                    <div>
                        <button
                            type="submit"
                            disabled={loginMutation.isLoading}
                            className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                        >
                            {loginMutation.isLoading ? (
                                <span className="flex items-center">
                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Signing in...
                                </span>
                            ) : (
                                'Sign in'
                            )}
                        </button>
                    </div>

                    {/* Help Text */}
                    <div className="text-center">
                        <p className="text-xs text-gray-500">
                            Need help? Contact your system administrator
                        </p>
                    </div>
                </form>
            </div>
        </div>
    )
}

export default Login

