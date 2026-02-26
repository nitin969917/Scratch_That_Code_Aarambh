import axios from 'axios';

const api = axios.create({
    baseURL: '/',
    headers: {
        'Content-Type': 'application/json',
    }
});

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

export const sendChatMessage = (id, query) => api.post(`/subject/${id}/chat/`, { query });
export const getChatHistory = (id) => api.get(`/subject/${id}/chat/history/`);
export const generateQuiz = (id) => api.post(`/subject/${id}/generate-quiz/`);

export default api;
