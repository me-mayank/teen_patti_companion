import axiosClient from '../../shared/api/axiosClient';

export const register = async (userData) => {
  const response = await axiosClient.post('/auth/register', userData);
  if (response.data.token) {
    localStorage.setItem('token', response.data.token);
  }
  return response.data;
};

export const login = async (userData) => {
  const response = await axiosClient.post('/auth/login', userData);
  if (response.data.token) {
    localStorage.setItem('token', response.data.token);
  }
  return response.data;
};

export const getMe = async () => {
  const response = await axiosClient.get('/auth/me');
  return response.data;
};

export const logout = () => {
  localStorage.removeItem('token');
};
