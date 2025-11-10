import axios from 'axios';

export const forgotPassword = async (email) => {
  const response = await axios.post('/api/auth/forgot-password', { email });
  return response.data;
};

export const resetPassword = async (token, password) => {
  const response = await axios.post('/api/auth/reset-password', { token, password });
  return response.data;
};

export const verifyEmail = async (token) => {
  const response = await axios.get('/api/auth/verify-email', { params: { token } });
  return response.data;
};

export const resendVerification = async () => {
  const response = await axios.post('/api/auth/resend-verification');
  return response.data;
};

export const updateProfile = async (name, email) => {
  const response = await axios.put('/api/auth/profile', { name, email });
  return response.data;
};

export const changePassword = async (currentPassword, newPassword) => {
  const response = await axios.put('/api/auth/change-password', {
    currentPassword,
    newPassword
  });
  return response.data;
};

