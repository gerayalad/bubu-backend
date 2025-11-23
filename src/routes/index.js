/**
 * BUBU - Rutas principales de la API
 */

import express from 'express';
import chatRoutes from './chatRoutes.js';
import userRoutes from './userRoutes.js';
import transactionRoutes from './transactionRoutes.js';
import categoryRoutes from './categoryRoutes.js';
import whatsappRoutes from './whatsappRoutes.js';

const router = express.Router();

// Health check
router.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'BUBU API está funcionando',
        timestamp: new Date().toISOString()
    });
});

// Rutas de la API
router.use('/chat', chatRoutes);
router.use('/users', userRoutes);
router.use('/transactions', transactionRoutes);
router.use('/categories', categoryRoutes);
router.use('/whatsapp', whatsappRoutes);

export default router;
