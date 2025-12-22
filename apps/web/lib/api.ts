import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Send cookies with requests
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
  updateProfile: (data: { displayName?: string; country?: string; youtubeUrl?: string; twitchUrl?: string }) =>
    api.put('/users/me/profile', data),
  updateStreamUrls: (data: { youtubeUrl?: string; twitchUrl?: string }) =>
    api.put('/users/me', data),
  getSuggestedCountry: () => api.get<{ country: string | null }>('/users/me/suggested-country'),
  getUser: (id: string) => api.get(`/users/${id}`),
  getUserByProfileId: (profileId: number) => api.get(`/users/profile/${profileId}`),
  getLeaderboard: (mode: 'GP' | 'CLASSIC' = 'GP', limit = 100) =>
    api.get(`/users/leaderboard?mode=${mode}&limit=${limit}`),
};

// Matches API (for waiting room management - was lobbies)
export const matchesApi = {
  create: (data: {
    seasonId: number;
    inGameMode: string;
    leagueType: string;
    scheduledStart: string;
    minPlayers?: number;
    maxPlayers?: number;
    notes?: string;
  }) => api.post('/matches', data),
  getNext: (category?: 'GP' | 'CLASSIC') => {
    const params = new URLSearchParams();
    if (category) params.append('category', category);
    return api.get(`/matches/next?${params.toString()}`);
  },
  getAll: (category?: 'GP' | 'CLASSIC', status?: 'WAITING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED') => {
    const params = new URLSearchParams();
    if (category) params.append('category', category);
    if (status) params.append('status', status);
    return api.get(`/matches?${params.toString()}`);
  },
  getRecent: (limit: number = 5) => api.get(`/matches/recent?limit=${limit}`),
  getById: (id: number) => api.get(`/matches/${id}`),
  join: (id: number) => api.post(`/matches/${id}/join`),
  leave: (id: number) => api.delete(`/matches/${id}/leave`),
  cancel: (id: number) => api.patch(`/matches/${id}/cancel`),
  delete: (id: number) => api.delete(`/matches/${id}`),
};

// Seasons API
export const seasonsApi = {
  getActive: (category: 'GP' | 'CLASSIC' = 'GP') =>
    api.get(`/seasons/active?category=${category}`),
  getAll: (category?: 'GP' | 'CLASSIC') => {
    const params = category ? `?category=${category}` : '';
    return api.get(`/seasons${params}`);
  },
  getById: (id: number) => api.get(`/seasons/${id}`),
  create: (data: {
    category: 'GP' | 'CLASSIC';
    seasonNumber: number;
    description?: string;
    startDate: string;
    endDate?: string;
  }) => api.post('/seasons', data),
  update: (id: number, data: {
    seasonNumber?: number;
    description?: string;
    startDate?: string;
    endDate?: string;
  }) => api.patch(`/seasons/${id}`, data),
  toggleStatus: (id: number, data: { isActive: boolean }) =>
    api.patch(`/seasons/${id}/toggle-status`, data),
  delete: (id: number) => api.delete(`/seasons/${id}`),
};

// Games API (for score submission - was matches)
export const gamesApi = {
  getById: (id: number) => api.get(`/games/${id}`),
  getByCategorySeasonMatch: (category: string, season: number, match: number) =>
    api.get(`/games/${category}/${season}/${match}`),
  submitScore: (category: string, season: number, match: number, data: {
    reportedPoints: number;
    machine: string;
    assistEnabled: boolean;
    targetUserId?: number;
  }) => api.post(`/games/${category}/${season}/${match}/score`, data),
  // Moderator actions
  updateScore: (category: string, season: number, match: number, userId: number, data: {
    raceResults: Array<{
      raceNumber: number;
      position?: number;
      isEliminated: boolean;
    }>;
  }) => api.patch(`/games/${category}/${season}/${match}/score/${userId}`, data),
  endMatch: (category: string, season: number, match: number) =>
    api.post(`/games/${category}/${season}/${match}/end`),
};

// Screenshots API
export const screenshotsApi = {
  submit: (gameId: number, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('gameId', String(gameId));
    return api.post('/screenshots/submit', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  getSubmissions: (gameId: number) => api.get(`/screenshots/game/${gameId}/submissions`),
  getOfficial: (gameId: number) => api.get(`/screenshots/game/${gameId}/official`),
};
