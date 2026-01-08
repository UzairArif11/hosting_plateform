import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../api';

interface Deployment {
    _id: string;
    projectId: string;
    status: string;
    branch: string;
    commitSha: string;
    commitMessage: string;
    deploymentUrl: string;
    url?: string;
    buildLogs: any[];
    createdAt: string;
    duration: number;
    buildTime?: number;
    error?: string | object;
}

interface DeploymentsState {
    deployments: Deployment[];
    currentDeployment: Deployment | null;
    logs: any[];
    loading: boolean;
    error: string | null;
}

const initialState: DeploymentsState = {
    deployments: [],
    currentDeployment: null,
    logs: [],
    loading: false,
    error: null,
};

export const fetchDeployments = createAsyncThunk(
    'deployments/fetchDeployments',
    async (projectId: string, { rejectWithValue }) => {
        try {
            const response = await api.get(`/api/deployments?projectId=${projectId}`);
            return response.data.deployments;
        } catch (error: any) {
            return rejectWithValue(error.response?.data?.error || 'Failed to fetch deployments');
        }
    }
);

export const createDeployment = createAsyncThunk(
    'deployments/createDeployment',
    async (deploymentData: any, { rejectWithValue }) => {
        try {
            const response = await api.post('/api/deployments', deploymentData);
            return response.data.deployment;
        } catch (error: any) {
            return rejectWithValue(error.response?.data?.error || 'Failed to create deployment');
        }
    }
);

export const fetchDeploymentLogs = createAsyncThunk(
    'deployments/fetchLogs',
    async (deploymentId: string, { rejectWithValue }) => {
        try {
            const response = await api.get(`/api/deployments/${deploymentId}/logs`);
            return response.data.logs;
        } catch (error: any) {
            return rejectWithValue(error.response?.data?.error || 'Failed to fetch logs');
        }
    }
);

const deploymentsSlice = createSlice({
    name: 'deployments',
    initialState,
    reducers: {
        addLog: (state, action) => {
            state.logs.push(action.payload);
        },
        clearLogs: (state) => {
            state.logs = [];
        },
        updateDeploymentStatus: (state, action) => {
            const { deploymentId, status, url } = action.payload;
            const deployment = state.deployments.find(d => d._id === deploymentId);
            if (deployment) {
                deployment.status = status;
                if (url) deployment.deploymentUrl = url;
            }
            if (state.currentDeployment && state.currentDeployment._id === deploymentId) {
                state.currentDeployment.status = status;
                if (url) state.currentDeployment.deploymentUrl = url;
            }
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchDeployments.pending, (state) => {
                state.loading = true;
            })
            .addCase(fetchDeployments.fulfilled, (state, action) => {
                state.loading = false;
                state.deployments = action.payload;
            })
            .addCase(fetchDeployments.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            })
            .addCase(createDeployment.fulfilled, (state, action) => {
                state.deployments.unshift(action.payload);
            })
            .addCase(fetchDeploymentLogs.fulfilled, (state, action) => {
                state.logs = action.payload;
            });
    },
});

export const { addLog, clearLogs, updateDeploymentStatus } = deploymentsSlice.actions;
export default deploymentsSlice.reducer;
