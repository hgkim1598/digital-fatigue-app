import client from './client';

// Auth (인증 불필요)
export const signup = (data) => client.post('/api/auth/signup', data);
export const login = (data) => client.post('/api/auth/login', data);

// Symptoms
export const createSymptom = (data) => client.post('/api/symptoms', data);
export const getSymptoms = () => client.get('/api/symptoms');

// Screen Time
export const recordScreenTime = (data) => client.post('/api/screen-time', data);
export const getScreenTime = () => client.get('/api/screen-time');

// Analysis
export const getWeeklyAnalysis = () => client.get('/api/analysis/weekly');
export const getRanking = () => client.get('/api/analysis/ranking');

// Supplement
export const getSupplementInfo = () => client.get('/api/supplement-info');

// Chat
export const sendChat = (data) => client.post('https://xa4udeuj9b.execute-api.us-east-1.amazonaws.com/prod/api/supplement-info', data);
export const getChatHistory = () => client.get('/api/chat/history');
