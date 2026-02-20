import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import api from '../api';

interface Project {
    _id: string;
    name: string;
    repository: any;
    framework: string;
    status: string;
    deploymentUrl: string;
    productionDeployment: string;
    stats: any;
    deploymentCount: number;
    environmentVariables?: Record<string, string>;
    latestDeployment?: {
        _id: string;
        status: string;
        createdAt: string;
        deploymentUrl?: string;
    };
    createdAt: string;
    updatedAt: string;
}

interface ProjectsState {
    projects: Project[];
    currentProject: Project | null;
    loading: boolean;
    error: string | null;
    total: number;
    page: number;
    limit: number;
}

const initialState: ProjectsState = {
    projects: [],
    currentProject: null,
    loading: false,
    error: null,
    total: 0,
    page: 1,
    limit: 20,
};

export const fetchProjects = createAsyncThunk(
    'projects/fetchProjects',
    async ({ page = 1, limit = 20 }: { page?: number; limit?: number }, { rejectWithValue }) => {
        try {
            const response = await api.get(`/projects?page=${page}&limit=${limit}`);
            return response.data;
        } catch (error: any) {
            return rejectWithValue(error.response?.data?.error || 'Failed to fetch projects');
        }
    }
);

export const fetchProject = createAsyncThunk(
    'projects/fetchProject',
    async (projectId: string, { rejectWithValue }) => {
        try {
            const response = await api.get(`/projects/${projectId}`);
            return response.data.project;
        } catch (error: any) {
            return rejectWithValue(error.response?.data?.error || 'Failed to fetch project');
        }
    }
);

export const createProject = createAsyncThunk(
    'projects/createProject',
    async (projectData: any, { rejectWithValue }) => {
        try {
            const response = await api.post('/projects', projectData);
            return response.data.project;
        } catch (error: any) {
            return rejectWithValue(error.response?.data?.error || 'Failed to create project');
        }
    }
);

export const deleteProject = createAsyncThunk(
    'projects/deleteProject',
    async (projectId: string, { rejectWithValue }) => {
        try {
            await api.delete(`/projects/${projectId}`);
            return projectId;
        } catch (error: any) {
            return rejectWithValue(error.response?.data?.error || 'Failed to delete project');
        }
    }
);

const projectsSlice = createSlice({
    name: 'projects',
    initialState,
    reducers: {
        clearCurrentProject: (state) => {
            state.currentProject = null;
        },
        clearError: (state) => {
            state.error = null;
        },
    },
    extraReducers: (builder) => {
        builder
            // Fetch projects
            .addCase(fetchProjects.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchProjects.fulfilled, (state, action) => {
                state.loading = false;
                state.projects = action.payload.projects;
                state.total = action.payload.pagination?.total || 0;
                state.page = action.payload.pagination?.page || 1;
            })
            .addCase(fetchProjects.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            })
            // Fetch single project
            .addCase(fetchProject.pending, (state) => {
                state.loading = true;
            })
            .addCase(fetchProject.fulfilled, (state, action) => {
                state.loading = false;
                state.currentProject = action.payload;
            })
            .addCase(fetchProject.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            })
            // Create project
            .addCase(createProject.fulfilled, (state, action) => {
                state.projects.unshift(action.payload);
                state.total += 1;
            })
            // Delete project
            .addCase(deleteProject.fulfilled, (state, action) => {
                state.projects = state.projects.filter(p => p._id !== action.payload);
                state.total -= 1;
            });
    },
});

export const { clearCurrentProject, clearError } = projectsSlice.actions;
export default projectsSlice.reducer;
