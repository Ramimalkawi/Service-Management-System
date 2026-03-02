// src/config/api.js
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5001";

export const API_ENDPOINTS = {
  SEND_EMAIL: `${API_BASE_URL}/api/sendEmail`,
  CREATE_USER: `${API_BASE_URL}/api/createUser`,
  ARCHIVE_TICKETS: `${API_BASE_URL}/api/archive`,
  ARCHIVE_YEARS: `${API_BASE_URL}/api/archive/years`,
  ARCHIVE_FILES: `${API_BASE_URL}/api/archive/files`,
  ARCHIVE_FILE_BASE: `${API_BASE_URL}/archived-tickets`,
};

export default API_BASE_URL;
