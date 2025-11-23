/**
 * BUBU - Rutas de WhatsApp
 * Endpoints para webhooks de WhatsApp Business API
 */

import express from 'express';
import { verifyWebhookEndpoint, receiveWebhook } from '../controllers/whatsappController.js';

const router = express.Router();

/**
 * GET /webhook - Verificación del webhook por WhatsApp
 * WhatsApp llama a este endpoint para verificar que el webhook es válido
 */
router.get('/webhook', verifyWebhookEndpoint);

/**
 * POST /webhook - Recibir mensajes de WhatsApp
 * WhatsApp envía mensajes a este endpoint
 */
router.post('/webhook', receiveWebhook);

export default router;
