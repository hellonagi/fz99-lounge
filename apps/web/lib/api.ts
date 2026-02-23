import axios from 'axios';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || '';

export const api = axios.create({
  baseURL: `${BASE_URL}/api`,
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
        // Skip redirect for auth profile check (prevents infinite loop for unauthenticated users)
        const isProfileCheck = error.config?.url?.includes('/auth/profile');
        if (!isProfileCheck) {
          // Clear authentication data
          localStorage.removeItem('token');
          localStorage.removeItem('auth-storage');

          // Redirect to home page
          window.location.href = '/';
        }
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
  getUserByProfileId: (profileId: number, seasonNumber?: number, category?: 'GP' | 'CLASSIC' | 'TEAM_CLASSIC') => {
    const params = new URLSearchParams();
    if (seasonNumber !== undefined) params.append('seasonNumber', String(seasonNumber));
    if (category) params.append('category', category);
    const query = params.toString();
    return api.get(`/users/profile/${profileId}${query ? `?${query}` : ''}`);
  },
  getUserSeasons: (userId: number, category?: 'GP' | 'CLASSIC' | 'TEAM_CLASSIC') => {
    const params = category ? `?category=${category}` : '';
    return api.get(`/users/${userId}/seasons${params}`);
  },
  getLeaderboard: (mode: 'GP' | 'CLASSIC' = 'GP', seasonNumber?: number, page = 1, limit = 20) => {
    const params = new URLSearchParams({ mode, page: String(page), limit: String(limit) });
    if (seasonNumber !== undefined) params.append('seasonNumber', String(seasonNumber));
    return api.get(`/users/leaderboard?${params.toString()}`);
  },
  getMatchHistory: (userId: number, limit = 20, offset = 0, category?: 'GP' | 'CLASSIC' | 'TEAM_CLASSIC', seasonNumber?: number) => {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (category) params.append('category', category);
    if (seasonNumber !== undefined) params.append('seasonNumber', String(seasonNumber));
    return api.get(`/users/${userId}/matches?${params.toString()}`);
  },
  getRatingHistory: (userId: number, category?: 'GP' | 'CLASSIC' | 'TEAM_CLASSIC', seasonNumber?: number) => {
    const params = new URLSearchParams();
    if (category) params.append('category', category);
    if (seasonNumber !== undefined) params.append('seasonNumber', String(seasonNumber));
    const query = params.toString();
    return api.get(`/users/${userId}/rating-history${query ? `?${query}` : ''}`);
  },
  getTrackStats: (userId: number, category?: 'GP' | 'CLASSIC' | 'TEAM_CLASSIC') => {
    const params = category ? `?category=${category}` : '';
    return api.get(`/users/${userId}/track-stats${params}`);
  },
  getFeaturedWeekly: () => api.get('/users/featured-weekly'),
};

// Matches API (for waiting room management - was lobbies)
export const matchesApi = {
  create: (data: {
    seasonId: number;
    inGameMode: string;
    leagueType?: string;
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
  getResults: (params: {
    category: 'CLASSIC' | 'TEAM_CLASSIC';
    seasonNumber: number;
    page?: number;
    limit?: number;
  }) => {
    const searchParams = new URLSearchParams();
    searchParams.append('category', params.category);
    searchParams.append('seasonNumber', String(params.seasonNumber));
    if (params.page) searchParams.append('page', String(params.page));
    if (params.limit) searchParams.append('limit', String(params.limit));
    return api.get(`/matches/results?${searchParams.toString()}`);
  },
  getById: (id: number) => api.get(`/matches/${id}`),
  join: (id: number) => api.post(`/matches/${id}/join`),
  leave: (id: number) => api.delete(`/matches/${id}/leave`),
  cancel: (id: number) => api.patch(`/matches/${id}/cancel`),
  delete: (id: number) => api.delete(`/matches/${id}`),
  getWeek: (from: string, to: string) => {
    const params = new URLSearchParams({ from, to });
    return api.get(`/matches/week?${params.toString()}`);
  },
};

// Recurring Matches API
export const recurringMatchesApi = {
  create: (data: {
    eventCategory: string;
    inGameMode: string;
    leagueType?: string;
    minPlayers?: number;
    maxPlayers?: number;
    rules: Array<{ daysOfWeek: number[]; timeOfDay: string }>;
    name?: string;
    notes?: string;
  }) => api.post('/recurring-matches', data),
  getAll: () => api.get('/recurring-matches'),
  update: (id: number, data: Record<string, unknown>) =>
    api.patch(`/recurring-matches/${id}`, data),
  toggle: (id: number, enabled: boolean) =>
    api.patch(`/recurring-matches/${id}/toggle`, { enabled }),
  delete: (id: number) => api.delete(`/recurring-matches/${id}`),
};

// Seasons API
export const seasonsApi = {
  getActive: (category: 'GP' | 'CLASSIC' | 'TEAM_CLASSIC' = 'GP') =>
    api.get(`/seasons/active?category=${category}`),
  getAll: (category?: 'GP' | 'CLASSIC' | 'TEAM_CLASSIC') => {
    const params = category ? `?category=${category}` : '';
    return api.get(`/seasons${params}`);
  },
  getById: (id: number) => api.get(`/seasons/${id}`),
  create: (data: {
    category: 'GP' | 'CLASSIC' | 'TEAM_CLASSIC';
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
    reportedPoints?: number;
    machine: string;
    assistEnabled: boolean;
    targetUserId?: number;
    raceResults?: Array<{
      raceNumber: number;
      position?: number;
      isEliminated: boolean;
      isDisconnected: boolean;
    }>;
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
  updateTracks: (category: string, season: number, match: number, tracks: (number | null)[]) =>
    api.patch(`/games/${category}/${season}/${match}/tracks`, { tracks }),
  // Split vote
  getSplitVoteStatus: (category: string, season: number, match: number) =>
    api.get<{
      currentVotes: number;
      requiredVotes: number;
      hasVoted: boolean;
      passcode: string;
      passcodeVersion: number;
    }>(`/games/${category}/${season}/${match}/split-vote`),
  castSplitVote: (category: string, season: number, match: number) =>
    api.post<{
      regenerated: boolean;
      currentVotes: number;
      requiredVotes: number;
      passcode: string;
      passcodeVersion: number;
    }>(`/games/${category}/${season}/${match}/split-vote`),
  regeneratePasscode: (category: string, season: number, match: number) =>
    api.post<{
      regenerated: boolean;
      currentVotes: number;
      requiredVotes: number;
      passcode: string;
      passcodeVersion: number;
    }>(`/games/${category}/${season}/${match}/regenerate-passcode`),
  // Score verification
  verifyScore: (category: string, season: number, match: number, userId: number) =>
    api.post(`/games/${category}/${season}/${match}/participants/${userId}/verify`),
  rejectScore: (category: string, season: number, match: number, userId: number) =>
    api.post(`/games/${category}/${season}/${match}/participants/${userId}/reject`),
};

// Tracks API
export interface Track {
  id: number;
  name: string;
  league: string;
  bannerPath: string;
  mirrorOfId: number | null;
}

export const tracksApi = {
  getAll: (league?: string) => {
    const params = league ? `?league=${league}` : '';
    return api.get<Track[]>(`/tracks${params}`);
  },
  getById: (id: number) => api.get<Track>(`/tracks/${id}`),
};

// Screenshots API
export type ScreenshotType = 'INDIVIDUAL' | 'INDIVIDUAL_1' | 'INDIVIDUAL_2' | 'FINAL_SCORE' | 'FINAL_SCORE_1' | 'FINAL_SCORE_2';

export const screenshotsApi = {
  submit: (gameId: number, file: File, type: ScreenshotType = 'INDIVIDUAL') => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('gameId', String(gameId));
    formData.append('type', type);
    return api.post('/screenshots/submit', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  getSubmissions: (gameId: number, type?: ScreenshotType) => {
    const params = type ? `?type=${type}` : '';
    return api.get(`/screenshots/game/${gameId}/submissions${params}`);
  },
  getOfficial: (gameId: number) => api.get(`/screenshots/game/${gameId}/official`),
  verify: (submissionId: number) => api.post(`/screenshots/${submissionId}/verify`),
  reject: (submissionId: number) => api.post(`/screenshots/${submissionId}/reject`),
  getProgress: (gameId: number) => api.get(`/screenshots/game/${gameId}/progress`),
};

// Permissions API (ADMIN only)
export const permissionsApi = {
  getModerators: () => api.get('/permissions/moderators'),
  setUserPermissions: (userId: number, permissions: string[]) =>
    api.put(`/permissions/users/${userId}`, { permissions }),
};

// Admin API
export const adminApi = {
  recalculateRatings: (category: string, season: number, fromMatchNumber: number) =>
    api.post<{
      success: boolean;
      message: string;
      recalculatedMatches: number;
      affectedUsers: number;
    }>(`/admin/rating/recalculate/${category}/${season}/from/${fromMatchNumber}`),
  getUsers: (page: number = 1, limit: number = 20, search?: string) => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (search) params.append('search', search);
    return api.get(`/admin/users?${params.toString()}`);
  },
  updateUserRole: (userId: number, role: 'PLAYER' | 'MODERATOR') =>
    api.patch(`/admin/users/${userId}/role`, { role }),
};
