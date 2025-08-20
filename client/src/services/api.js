import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for logging
api.interceptors.request.use(
  (config) => {
    console.log(`Making ${config.method?.toUpperCase()} request to ${config.url}`);
    return config;
  },
  (error) => {
    console.error('Request error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    console.error('Response error:', error);
    
    if (error.response) {
      // Server responded with error status
      const message = error.response.data?.message || error.response.data?.error || 'Server error';
      throw new Error(message);
    } else if (error.request) {
      // Request was made but no response received
      throw new Error('No response from server. Please check your connection.');
    } else {
      // Something else happened
      throw new Error(error.message || 'An unexpected error occurred');
    }
  }
);

// Chat API functions
export const chatAPI = {
  // Send a chat message
  sendMessage: async (message, options = {}) => {
    const response = await api.post('/chat', {
      message,
      ...options
    });
    return response.data;
  },

  // Get context for a question without generating response
  getContext: async (question, maxDocs = 5) => {
    const response = await api.get('/chat/context', {
      params: { question, maxDocs }
    });
    return response.data;
  },

  // Get available LLM providers
  getProviders: async () => {
    const response = await api.get('/chat/providers');
    return response.data;
  },

  // Test a specific provider
  testProvider: async (provider) => {
    const response = await api.post('/chat/test-provider', { provider });
    return response.data;
  }
};

// Admin API functions
export const adminAPI = {
  // Ingest a document
  ingestDocument: async (documentData) => {
    const response = await api.post('/admin/ingest', documentData);
    return response.data;
  },

  // Get vector store information
  getVectorStoreInfo: async () => {
    const response = await api.get('/admin/vector-store/info');
    return response.data;
  },

  // Search documents in vector store
  searchDocuments: async (query, maxResults = 5) => {
    const response = await api.post('/admin/search', { query, maxResults });
    return response.data;
  },

  // Delete vector store collection
  deleteVectorStore: async () => {
    const response = await api.delete('/admin/vector-store');
    return response.data;
  }
};

// Health check
export const healthAPI = {
  check: async () => {
    const response = await api.get('/health');
    return response.data;
  }
};

export default api;
