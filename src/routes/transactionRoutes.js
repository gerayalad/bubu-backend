/**
 * BUBU - Rutas de Transacciones
 */

import express from 'express';
import { create, list, getSummary, remove, update } from '../controllers/transactionController.js';

const router = express.Router();

// POST /api/transactions - Crear transacción
router.post('/', create);

// GET /api/transactions/:user_phone - Listar transacciones de un usuario
router.get('/:user_phone', list);

// GET /api/transactions/:user_phone/summary - Obtener resumen financiero
router.get('/:user_phone/summary', getSummary);

// PUT /api/transactions/:id - Actualizar transacción
router.put('/:id', update);

// DELETE /api/transactions/:id - Eliminar transacción
router.delete('/:id', remove);

export default router;
