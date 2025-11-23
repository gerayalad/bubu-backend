/**
 * BUBU - API Service
 * Cliente para comunicarse con el backend
 */

import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Interceptor para logging (desarrollo)
api.interceptors.request.use(
    (config) => {
        console.log(`API Request: ${config.method.toUpperCase()} ${config.url}`);
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

api.interceptors.response.use(
    (response) => {
        console.log(`API Response: ${response.config.url}`, response.data);
        return response;
    },
    (error) => {
        console.error('API Error:', error.response?.data || error.message);
        return Promise.reject(error);
    }
);

/**
 * API de Chat
 */
export const chatAPI = {
    /**
     * Enviar un mensaje al chatbot
     */
    sendMessage: async (userPhone, message, buttonId = null) => {
        const payload = {
            user_phone: userPhone
        };

        if (buttonId) {
            payload.button_id = buttonId;
        } else {
            payload.message = message;
        }

        const response = await api.post('/chat/message', payload);
        return response.data;
    },

    /**
     * Enviar una imagen con OCR (ticket/recibo)
     */
    sendMessageWithImage: async (userPhone, imageBase64, mimeType = 'image/jpeg') => {
        const response = await api.post('/chat/message-with-image', {
            user_phone: userPhone,
            image_base64: imageBase64,
            mime_type: mimeType
        });
        return response.data;
    },

    /**
     * Obtener historial de chat
     */
    getHistory: async (userPhone, limit = 50) => {
        const response = await api.get(`/chat/history/${userPhone}`, {
            params: { limit }
        });
        return response.data;
    }
};

/**
 * API de Usuarios
 */
export const userAPI = {
    /**
     * Obtener o crear un usuario
     */
    getOrCreate: async (phone) => {
        const response = await api.post('/users/get-or-create', { phone });
        return response.data;
    },

    /**
     * Obtener información de un usuario
     */
    getUser: async (phone) => {
        const response = await api.get(`/users/${phone}`);
        return response.data;
    },

    /**
     * Actualizar información de usuario
     */
    updateUser: async (phone, data) => {
        const response = await api.put(`/users/${phone}`, data);
        return response.data;
    }
};

/**
 * API de Transacciones
 */
export const transactionAPI = {
    /**
     * Obtener transacciones de un usuario
     */
    getTransactions: async (userPhone, filters = {}) => {
        const response = await api.get(`/transactions/${userPhone}`, {
            params: filters
        });
        return response.data;
    },

    /**
     * Obtener resumen financiero
     */
    getSummary: async (userPhone, period = {}) => {
        const response = await api.get(`/transactions/${userPhone}/summary`, {
            params: period
        });
        return response.data;
    },

    /**
     * Crear una transacción manualmente
     */
    createTransaction: async (data) => {
        const response = await api.post('/transactions', data);
        return response.data;
    },

    /**
     * Eliminar una transacción
     */
    deleteTransaction: async (id, userPhone) => {
        const response = await api.delete(`/transactions/${id}`, {
            data: { user_phone: userPhone }
        });
        return response.data;
    }
};

/**
 * API de Categorías
 */
export const categoryAPI = {
    /**
     * Obtener todas las categorías
     */
    getCategories: async (type = null) => {
        const response = await api.get('/categories', {
            params: type ? { type } : {}
        });
        return response.data;
    }
};

/**
 * Health check
 */
export const healthCheck = async () => {
    const response = await api.get('/health');
    return response.data;
};

export default api;
