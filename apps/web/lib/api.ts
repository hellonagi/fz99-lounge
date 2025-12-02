import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Handle authentication errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (typeof window !== 'undefined') {
      // If token is invalid (401 Unauthorized only)
      // Note: 403 Forbidden is for permission errors, not authentication errors
      if (error.response?.status === 401) {
        // Clear authentication data
        localStorage.removeItem('token');
        localStorage.removeItem('auth-storage');

        // Redirect to home page
        window.location.href = '/';
      }
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  getProfile: () => api.get('/auth/profile'),
  logout: () => api.get('/auth/logout'),
};

// Users API
export const usersApi = {
  getMe: () => api.get('/users/me'),
  updateDisplayName: (displayName: string) => api.put('/users/me/display-name', { displayName }),
  updateProfile: (data: { youtubeUrl?: string; twitchUrl?: string }) =>
    api.put('/users/me', data),
  getUser: (id: string) => api.get(`/users/${id}`),
  getUserByProfileId: (profileId: number) => api.get(`/users/profile/${profileId}`),
  getLeaderboard: (mode: 'GP' | 'CLASSIC' = 'GP', limit = 100) =>
    api.get(`/users/leaderboard?mode=${mode}&limit=${limit}`),
};

// Lobbies API
export const lobbiesApi = {
  create: (data: {
    gameMode: 'GP' | 'CLASSIC';
    leagueType: string;
    scheduledStart: string;
    minPlayers?: number;
    maxPlayers?: number;
    notes?: string;
  }) => api.post('/lobbies', data),
  getNext: (mode: 'GP' | 'CLASSIC' = 'GP') =>
    api.get(`/lobbies/next?mode=${mode}`),
  getAll: (mode?: 'GP' | 'CLASSIC', status?: 'WAITING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED') => {
    const params = new URLSearchParams();
    if (mode) params.append('mode', mode);
    if (status) params.append('status', status);
    return api.get(`/lobbies?${params.toString()}`);
  },
  getById: (id: string) => api.get(`/lobbies/${id}`),
  join: (id: string) => api.post(`/lobbies/${id}/join`),
  leave: (id: string) => api.delete(`/lobbies/${id}/leave`),
  cancel: (id: string) => api.patch(`/lobbies/${id}/cancel`),
  delete: (id: string) => api.delete(`/lobbies/${id}`),
};

// Seasons API
export const seasonsApi = {
  getActive: (mode: 'GP' | 'CLASSIC' = 'GP') =>
    api.get(`/seasons/active?mode=${mode}`),
  getAll: () => api.get('/seasons'),
  getById: (id: string) => api.get(`/seasons/${id}`),
  create: (data: {
    gameMode: 'GP' | 'CLASSIC';
    seasonNumber: number;
    description?: string;
    startDate: string;
    endDate?: string;
  }) => api.post('/seasons', data),
  update: (id: string, data: {
    seasonNumber?: number;
    description?: string;
    startDate?: string;
    endDate?: string;
  }) => api.patch(`/seasons/${id}`, data),
  toggleStatus: (id: string, data: { isActive: boolean }) =>
    api.patch(`/seasons/${id}/toggle-status`, data),
  delete: (id: string) => api.delete(`/seasons/${id}`),
};

// Matches API
export const matchesApi = {
  getById: (id: string) => api.get(`/matches/${id}`),
  getByModeSeasonGame: (mode: string, season: number, game: number) =>
    api.get(`/matches/${mode}/${season}/${game}`),
  submitScore: (mode: string, season: number, game: number, data: {
    reportedPoints: number;
    machine: string;
    assistEnabled: boolean;
    targetUserId?: string;
  }) => api.post(`/matches/${mode}/${season}/${game}/score`, data),
};

// Screenshots API
export const screenshotsApi = {
  submit: (matchId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('matchId', matchId);
    return api.post('/screenshots/submit', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  getSubmissions: (matchId: string) => api.get(`/screenshots/match/${matchId}/submissions`),
  getOfficial: (matchId: string) => api.get(`/screenshots/match/${matchId}/official`),
};
