// src/config/api.js
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5001";

export const API_ENDPOINTS = {
  SEND_EMAIL: `${API_BASE_URL}/api/sendEmail`,
  CREATE_USER: `${API_BASE_URL}/api/createUser`,
};

export default API_BASE_URL;
