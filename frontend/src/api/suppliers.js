import apiClient from '../config/axios';

export const inviteSupplier = async (name, email) => {
  const response = await apiClient.post('/api/auth/suppliers/invite', {
    name,
    email
  });
  return response.data;
};

export const getSuppliers = async () => {
  const response = await apiClient.get('/api/auth/suppliers');
  return response.data;
};

export const getSupplier = async (id) => {
  const response = await apiClient.get(`/api/auth/suppliers/${id}`);
  return response.data;
};

export const updateSupplierStatus = async (id, status) => {
  const response = await apiClient.patch(`/api/auth/suppliers/${id}/status`, {
    status
  });
  return response.data;
};

export const deleteSupplier = async (id) => {
  const response = await apiClient.delete(`/api/auth/suppliers/${id}`);
  return response.data;
};

