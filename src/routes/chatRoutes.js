/**
 * BUBU - Rutas del Chat
 */

import express from 'express';
import { processMessage, getHistory, processImageMessage } from '../controllers/chatController.js';

const router = express.Router();

// POST /api/chat/message - Procesar mensaje del usuario
router.post('/message', processMessage);

// POST /api/chat/message-with-image - Procesar imagen con OCR
router.post('/message-with-image', processImageMessage);

// GET /api/chat/history/:user_phone - Obtener historial de chat
router.get('/history/:user_phone', getHistory);

export default router;
