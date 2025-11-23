/**
 * BUBU - Rutas de Usuarios
 */

import express from 'express';
import { getOrCreate, getUser, update, listUsers } from '../controllers/userController.js';

const router = express.Router();

// POST /api/users/get-or-create - Obtener o crear usuario
router.post('/get-or-create', getOrCreate);

// GET /api/users - Listar todos los usuarios
router.get('/', listUsers);

// GET /api/users/:phone - Obtener un usuario específico
router.get('/:phone', getUser);

// PUT /api/users/:phone - Actualizar usuario
router.put('/:phone', update);

export default router;
