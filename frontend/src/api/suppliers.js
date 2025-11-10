import axios from 'axios';

export const inviteSupplier = async (name, email) => {
  const response = await axios.post('/api/auth/suppliers/invite', {
    name,
    email
  });
  return response.data;
};

export const getSuppliers = async () => {
  const response = await axios.get('/api/auth/suppliers');
  return response.data;
};

export const getSupplier = async (id) => {
  const response = await axios.get(`/api/auth/suppliers/${id}`);
  return response.data;
};

export const updateSupplierStatus = async (id, status) => {
  const response = await axios.patch(`/api/auth/suppliers/${id}/status`, {
    status
  });
  return response.data;
};

export const deleteSupplier = async (id) => {
  const response = await axios.delete(`/api/auth/suppliers/${id}`);
  return response.data;
};

