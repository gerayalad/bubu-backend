/**
 * BUBU - Rutas de Categorías
 */

import express from 'express';
import { list, getById, create } from '../controllers/categoryController.js';

const router = express.Router();

// GET /api/categories - Listar categorías (con filtro opcional ?type=income|expense)
router.get('/', list);

// GET /api/categories/:id - Obtener categoría por ID
router.get('/:id', getById);

// POST /api/categories - Crear categoría
router.post('/', create);

export default router;
