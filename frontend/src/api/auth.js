import apiClient from '../config/axios';

export const forgotPassword = async (email) => {
  const response = await apiClient.post('/api/auth/forgot-password', { email });
  return response.data;
};

export const resetPassword = async (token, password) => {
  const response = await apiClient.post('/api/auth/reset-password', { token, password });
  return response.data;
};

export const verifyEmail = async (token) => {
  const response = await apiClient.get('/api/auth/verify-email', { params: { token } });
  return response.data;
};

export const resendVerification = async () => {
  const response = await apiClient.post('/api/auth/resend-verification');
  return response.data;
};

export const updateProfile = async (name, email) => {
  const response = await apiClient.put('/api/auth/profile', { name, email });
  return response.data;
};

export const changePassword = async (currentPassword, newPassword) => {
  const response = await apiClient.put('/api/auth/change-password', {
    currentPassword,
    newPassword
  });
  return response.data;
};

