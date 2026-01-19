import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// Ensure API_URL ends with /api for all routes
const baseURL = API_URL.endsWith('/api') ? API_URL : `${API_URL}/api`;

const api = axios.create({
    baseURL: baseURL,
    withCredentials: true, // Important for cookies
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor
api.interceptors.request.use(
    (config) => {
        if (typeof window !== 'undefined') {
            const token = localStorage.getItem('token');
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor
api.interceptors.response.use(
    (response) => {
        return response;
    },
    async (error) => {
        const originalRequest = error.config;

        // Skip if the request is already for the refresh endpoint to prevent infinite loops
        if (originalRequest.url?.includes('/auth/refresh')) {
            if (typeof window !== 'undefined') {
                window.location.href = '/login';
            }
            return Promise.reject(error);
        }

        // If 401 and not already retried, try to refresh token
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            try {
                await api.post('/auth/refresh');
                return api(originalRequest);
            } catch (refreshError) {
                // Refresh failed, redirect to login
                if (typeof window !== 'undefined') {
                    window.location.href = '/login';
                }
                return Promise.reject(refreshError);
            }
        }

        return Promise.reject(error);
    }
);

export default api;
