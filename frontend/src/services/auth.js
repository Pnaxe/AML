import axios from 'axios'
import { base_url } from './api'

// Configure axios to include credentials (cookies) for session authentication
axios.defaults.withCredentials = true
axios.defaults.xsrfCookieName = 'csrftoken'
axios.defaults.xsrfHeaderName = 'X-CSRFToken'

/**
 * Login user with username and password using Django session authentication
 * This will work with a custom Django login endpoint at /api/auth/login/
 * @param {string} username 
 * @param {string} password 
 * @returns {Promise} Response with user data
 */
export const login = async (username, password) => {
    try {
        // First, get CSRF token from Django
        await axios.get('http://localhost:8000/api/auth/csrf/', {
            withCredentials: true
        }).catch(() => {
            // CSRF endpoint might not exist, that's okay
        })

        // Get CSRF token from cookies
        const csrfToken = getCookie('csrftoken')

        // Login using custom Django endpoint or token auth
        const response = await axios.post(`${base_url}/auth/login/`, {
            username,
            password
        }, {
            headers: {
                'Content-Type': 'application/json',
                ...(csrfToken && { 'X-CSRFToken': csrfToken })
            },
            withCredentials: true
        })

        // Update CSRF token in headers
        const newCsrfToken = getCookie('csrftoken')
        if (newCsrfToken) {
            axios.defaults.headers.common['X-CSRFToken'] = newCsrfToken
        }

        return response
    } catch (error) {
        throw error
    }
}

/**
 * Alternative login using Django REST Framework token authentication
 * @param {string} username 
 * @param {string} password 
 * @returns {Promise} Response with token
 */
export const loginWithToken = async (username, password) => {
    try {
        const response = await axios.post(`${base_url}/auth/token/`, {
            username,
            password
        }, {
            withCredentials: true
        })

        if (response.data.token) {
            // Store token in localStorage
            localStorage.setItem('auth_token', response.data.token)
            // Store username for later use
            localStorage.setItem('username', username)
            // Set token in axios headers
            axios.defaults.headers.common['Authorization'] = `Token ${response.data.token}`
        }

        return response
    } catch (error) {
        throw error
    }
}

/**
 * Logout user
 */
export const logout = async () => {
    try {
        // Remove token and username from localStorage
        localStorage.removeItem('auth_token')
        localStorage.removeItem('username')
        // Remove token from axios headers
        delete axios.defaults.headers.common['Authorization']
        delete axios.defaults.headers.common['X-CSRFToken']

        // Call Django logout endpoint if available
        try {
            await axios.post('http://localhost:8000/api-auth/logout/', {}, {
                withCredentials: true
            })
        } catch (error) {
            // Logout endpoint might not exist, that's okay
            console.log('Logout endpoint not available')
        }
    } catch (error) {
        console.error('Logout error:', error)
    }
}

/**
 * Check if user is authenticated
 * @returns {Promise<boolean>}
 */
export const checkAuth = async () => {
    try {
        // Try to get current user info
        const response = await axios.get(`${base_url}/customers/`, {
            params: { page_size: 1 },
            withCredentials: true
        })
        return true
    } catch (error) {
        if (error.response?.status === 401 || error.response?.status === 403) {
            return false
        }
        // Other errors might mean server is down, but we'll assume not authenticated
        return false
    }
}

/**
 * Get CSRF token from cookies
 * @param {string} name 
 * @returns {string|null}
 */
function getCookie(name) {
    let cookieValue = null
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';')
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim()
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1))
                break
            }
        }
    }
    return cookieValue
}

/**
 * Get current logged-in user information
 * @returns {Promise} Response with user data
 */
export const getCurrentUser = async () => {
    // Ensure token is in axios headers
    const token = localStorage.getItem('auth_token')
    if (token) {
        axios.defaults.headers.common['Authorization'] = `Token ${token}`
    }

    try {
        // First, try a custom endpoint that returns current user
        const response = await axios.get(`${base_url}/auth/user/`, {
            headers: {
                'Authorization': `Token ${token}`
            },
            withCredentials: true
        })
        return response.data
    } catch (error) {
        console.error('Error fetching user from /api/auth/user/:', error.response?.status, error.response?.data)

        // If custom endpoint doesn't exist, try Django REST Framework's built-in user endpoint
        try {
            const response = await axios.get('http://localhost:8000/api-auth/user/', {
                headers: {
                    'Authorization': `Token ${token}`
                },
                withCredentials: true
            })
            return response.data
        } catch (drfError) {
            console.error('Error fetching user from /api-auth/user/:', drfError.response?.status, drfError.response?.data)

            // If both fail, use stored username as fallback
            if (token) {
                const storedUsername = localStorage.getItem('username')
                if (storedUsername) {
                    console.log('Using stored username as fallback:', storedUsername)
                    return {
                        username: storedUsername,
                        email: `${storedUsername}@example.com` // Fallback email
                    }
                }
            }

            // If all methods fail, return null
            console.log('User endpoint not available and no stored username')
            return null
        }
    }
}

/**
 * Change user password
 * @param {string} currentPassword 
 * @param {string} newPassword 
 * @returns {Promise} Response with success message
 */
export const changePassword = async (currentPassword, newPassword) => {
    try {
        // Ensure token is in axios headers
        const token = localStorage.getItem('auth_token')
        if (!token) {
            throw new Error('Authentication required')
        }

        axios.defaults.headers.common['Authorization'] = `Token ${token}`

        const response = await axios.post(`${base_url}/auth/change-password/`, {
            current_password: currentPassword,
            new_password: newPassword
        }, {
            headers: {
                'Authorization': `Token ${token}`
            },
            withCredentials: true
        })

        return response.data
    } catch (error) {
        throw error
    }
}

/**
 * Initialize authentication - check for existing token
 */
export const initAuth = () => {
    const token = localStorage.getItem('auth_token')
    if (token) {
        axios.defaults.headers.common['Authorization'] = `Token ${token}`
    }

    // Get CSRF token from cookies
    const csrfToken = getCookie('csrftoken')
    if (csrfToken) {
        axios.defaults.headers.common['X-CSRFToken'] = csrfToken
    }
}

