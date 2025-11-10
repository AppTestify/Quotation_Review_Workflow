import axios from 'axios';

export const getQuotations = async (status, supplierId, search) => {
  const params = {};
  if (status) params.status = status;
  if (supplierId) params.supplierId = supplierId;
  if (search) params.search = search;
  const response = await axios.get('/api/quotations', { params });
  return response.data;
};

export const getStatistics = async () => {
  const response = await axios.get('/api/quotations/statistics');
  return response.data;
};

export const getQuotation = async (id) => {
  const response = await axios.get(`/api/quotations/${id}`);
  return response.data;
};

export const uploadQuotation = async (formData) => {
  const response = await axios.post('/api/quotations/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
  return response.data;
};

export const annotateQuotation = async (id, comments, annotations) => {
  const response = await axios.post(`/api/quotations/${id}/annotate`, {
    comments,
    annotations
  });
  return response.data;
};

export const requestChanges = async (id) => {
  const response = await axios.post(`/api/quotations/${id}/request-changes`);
  return response.data;
};

export const approveQuotation = async (id) => {
  const response = await axios.post(`/api/quotations/${id}/approve`);
  return response.data;
};

export const getQuotationHistory = async (id) => {
  const response = await axios.get(`/api/quotations/${id}/history`);
  return response.data;
};

export const getActivityHistory = async (id) => {
  const response = await axios.get(`/api/quotations/${id}/activity-history`);
  return response.data;
};

export const getQuotationHtmlContent = async (id) => {
  const response = await axios.get(`/api/quotations/${id}/html-content`);
  return response.data;
};


