/**
 * BUBU - User Controller
 */

import { getOrCreateUser, getUserByPhone, updateUser, getAllUsers } from '../services/userService.js';

export async function getOrCreate(req, res) {
    try {
        const { phone } = req.body;

        if (!phone) {
            return res.status(400).json({
                success: false,
                error: 'phone es requerido'
            });
        }

        const user = await getOrCreateUser(phone);

        return res.json({
            success: true,
            data: user
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

export async function getUser(req, res) {
    try {
        const { phone } = req.params;

        const user = await getUserByPhone(phone);

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'Usuario no encontrado'
            });
        }

        return res.json({
            success: true,
            data: user
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

export async function update(req, res) {
    try {
        const { phone } = req.params;
        const updates = req.body;

        const user = await updateUser(phone, updates);

        return res.json({
            success: true,
            data: user
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

export async function listUsers(req, res) {
    try {
        const users = await getAllUsers();

        return res.json({
            success: true,
            data: users
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

export default {
    getOrCreate,
    getUser,
    update,
    listUsers
};
