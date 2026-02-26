import axios from 'axios';

const api = axios.create({
    baseURL: '/',
    headers: {
        'Content-Type': 'application/json',
    }
});

export const checkAuth = () => api.get('/api/auth/check/');
export const login = (username, password) => api.post('/api/auth/login/', { username, password });
export const register = (username, password) => api.post('/api/auth/register/', { username, password });
export const logout = () => api.post('/api/auth/logout/');

export const getSubjects = () => api.get('/api/subjects/');
export const createSubject = (name) => api.post('/api/subjects/create/', { name });
export const deleteSubject = (id) => api.post(`/api/subjects/${id}/delete/`); // Using POST for compatibility as registered
export const getSubjectNotes = (id) => api.get(`/api/subjects/${id}/notes/`);
export const deleteNote = (id) => api.post(`/api/notes/${id}/delete/`);
export const uploadNote = (id, file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/api/subjects/${id}/upload/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    });
};

export const sendChatMessage = (id, query, session_id) => api.post(`/subject/${id}/chat/`, { query, session_id });
export const getChatHistory = (id, session_id) => {
    let url = `/subject/${id}/chat/history/`;
    if (session_id) {
        url += `?session_id=${session_id}`;
    }
    return api.get(url);
};
export const getChatSessions = (id) => api.get(`/api/subjects/${id}/chat-sessions/`);
export const deleteChatSession = (id, sessionId) => api.delete(`/api/subjects/${id}/chat-sessions/${sessionId}/`);

export const generateQuiz = (id, mcqCount = 5, shortCount = 3) =>
    api.post(`/subject/${id}/generate-quiz/?mcq_count=${mcqCount}&short_count=${shortCount}`);

export default api;
