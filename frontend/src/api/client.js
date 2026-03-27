import axios from 'axios';

const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '',
  headers: { 'Content-Type': 'application/json' },
});

// Authorization 헤더 자동 첨부
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('idToken');
  if (token) {
    config.headers.Authorization = token;
  }
  return config;
});

// 401 응답 시 토큰 제거 및 로그인 페이지로 리다이렉트
client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('idToken');
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      window.location.href = '/auth';
    }
    return Promise.reject(err);
  }
);

export default client;
