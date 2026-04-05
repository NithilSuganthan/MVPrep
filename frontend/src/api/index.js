import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || (import.meta.env.MODE === 'production' ? '/api' : 'http://localhost:3001/api'),
});

// Configure Axios to automatically attach JWT token to every request
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth Endpoints
export const login = (data) => api.post('/login', data);
export const register = (data) => api.post('/register', data);

// Passkey Auth Endpoints
export const generateRegistrationOptions = () => api.post('/passkeys/generate-registration');
export const verifyRegistration = (data) => api.post('/passkeys/verify-registration', data);
export const generateAuthenticationOptions = () => api.post('/passkeys/generate-authentication');
export const verifyAuthentication = (data) => api.post('/passkeys/verify-authentication', data);

// App Endpoints
export const getDashboardInfo = () => api.get('/dashboard');
export const getNotes = () => api.get('/notes');
export const getSubjects = () => api.get('/subjects');
export const getSubject = (id) => api.get(`/subjects/${id}`);
export const createSubject = (data) => api.post('/subjects', data);
export const updateChapter = (id, data) => api.patch(`/chapters/${id}`, data);
export const createChapter = (data) => api.post('/chapters', data);
export const createRevisionPlan = (data) => api.post('/revision-plan', data);
export const getRevisionPlans = () => api.get('/revision-plans');
export const incrementPomodoro = () => api.post('/pomodoro');
export const getSettings = () => api.get('/settings');
export const saveSettings = (data) => api.put('/settings', data);
export const testNotification = () => api.post('/notify-test');
export const getActivity = () => api.get('/activity');
export const saveFocusTime = (data) => api.post('/focus-time', data);

// AI Assistant Endpoints
export const getChatSessions = () => api.get('/chat-sessions');
export const getChats = (sessionId) => api.get(`/chats/${sessionId}`);
export const sendChatMessage = (data) => api.post('/chats', data); // { message, sessionId }
export const deleteChatSession = (id) => api.delete(`/chat-sessions/${id}`);

// Admin Endpoints
export const getAdminStats = () => api.get('/admin/stats');
export const getAdminUsers = () => api.get('/admin/users');
export const getAdminUserDetails = (id) => api.get(`/admin/users/${id}/details`);
export const changeAdminUserLevel = (id, level) => api.put(`/admin/users/${id}/level`, { level });
export const sendAdminNotification = (data) => api.post('/admin/notify', data);
export const deleteAdminUser = (id) => api.delete(`/admin/users/${id}`);
export const getAdminList = () => api.get('/admin/admins');
export const addAdmin = (email) => api.post('/admin/admins', { email });
export const removeAdmin = (email) => api.delete(`/admin/admins/${encodeURIComponent(email)}`);

export default api;
