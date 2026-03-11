import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import api from '../api';

interface User {
    id: string;
    username: string;
    email: string;
    displayName: string;
    avatar: string;
    role: string;
    status: string;
    subscriptionStatus: string;
    plan: any;
    trialDaysRemaining: number;
    isTrialActive: boolean;
    resourceAllocation: any;
    currentUsage: any;
    currentResourceUsage: any;
    displayedResources: {
        cpu: number;
        ram: number;
        storage: number;
        bandwidth: number;
        projects: number;
        containers: number;
    } | null;
    resourceUsagePercentage: any;
    createdAt: string;
    apiKey?: string;
    githubUsername?: string;
    githubId?: string;
    googleId?: string;
    provider?: string;
    // Suspension fields
    suspendedAt?: string;
    suspendedBy?: string;
    suspensionReason?: string;
    autoSuspended?: boolean;
    planType?: string;
}

interface AuthState {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    loading: boolean;
    error: string | null;
}

const initialState: AuthState = {
    user: null,
    token: null,
    isAuthenticated: false,
    loading: false,
    error: null,
};

// Async thunks
export const getCurrentUser = createAsyncThunk(
    'auth/getCurrentUser',
    async (_, { rejectWithValue }) => {
        try {
            const response = await api.get('/auth/me');
            return response.data.user;
        } catch (error: any) {
            return rejectWithValue(error.response?.data?.error || 'Failed to get user');
        }
    }
);

export const logout = createAsyncThunk(
    'auth/logout',
    async (_, { rejectWithValue }) => {
        try {
            await api.post('/auth/logout');
            return null;
        } catch (error: any) {
            return rejectWithValue(error.response?.data?.error || 'Failed to logout');
        }
    }
);

export const refreshToken = createAsyncThunk(
    'auth/refreshToken',
    async (_, { rejectWithValue }) => {
        try {
            const response = await api.post('/auth/refresh');
            return response.data.token;
        } catch (error: any) {
            return rejectWithValue(error.response?.data?.error || 'Failed to refresh token');
        }
    }
);

const authSlice = createSlice({
    name: 'auth',
    initialState,
    reducers: {
        setUser: (state, action: PayloadAction<User>) => {
            state.user = action.payload;
            state.isAuthenticated = true;
        },
        setToken: (state, action: PayloadAction<string>) => {
            state.token = action.payload;
        },
        clearAuth: (state) => {
            state.user = null;
            state.token = null;
            state.isAuthenticated = false;
            state.error = null;
        },
        clearError: (state) => {
            state.error = null;
        },
    },
    extraReducers: (builder) => {
        builder
            // Get current user
            .addCase(getCurrentUser.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(getCurrentUser.fulfilled, (state, action) => {
                state.loading = false;
                state.user = action.payload;
                state.isAuthenticated = true;
            })
            .addCase(getCurrentUser.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
                state.isAuthenticated = false;
            })
            // Logout
            .addCase(logout.fulfilled, (state) => {
                state.user = null;
                state.token = null;
                state.isAuthenticated = false;
            })
            // Refresh token
            .addCase(refreshToken.fulfilled, (state, action) => {
                state.token = action.payload;
            });
    },
});

export const { setUser, setToken, clearAuth, clearError } = authSlice.actions;
export default authSlice.reducer;
