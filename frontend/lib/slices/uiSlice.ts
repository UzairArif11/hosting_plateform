import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface UIState {
    sidebarOpen: boolean;
    modalOpen: boolean;
    modalType: string | null;
    modalData: any;
    theme: 'light' | 'dark';
}

const initialState: UIState = {
    sidebarOpen: true,
    modalOpen: false,
    modalType: null,
    modalData: null,
    theme: 'dark',
};

const uiSlice = createSlice({
    name: 'ui',
    initialState,
    reducers: {
        toggleSidebar: (state) => {
            state.sidebarOpen = !state.sidebarOpen;
        },
        setSidebarOpen: (state, action: PayloadAction<boolean>) => {
            state.sidebarOpen = action.payload;
        },
        openModal: (state, action: PayloadAction<{ type: string; data?: any }>) => {
            state.modalOpen = true;
            state.modalType = action.payload.type;
            state.modalData = action.payload.data || null;
        },
        closeModal: (state) => {
            state.modalOpen = false;
            state.modalType = null;
            state.modalData = null;
        },
        setTheme: (state, action: PayloadAction<'light' | 'dark'>) => {
            state.theme = action.payload;
        },
    },
});

export const { toggleSidebar, setSidebarOpen, openModal, closeModal, setTheme } = uiSlice.actions;
export default uiSlice.reducer;
