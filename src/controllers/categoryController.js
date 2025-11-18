/**
 * BUBU - Category Controller
 */

import { getAllCategories, getCategoryById, createCategory } from '../services/categoryService.js';

export async function list(req, res) {
    try {
        const { type } = req.query;
        const categories = getAllCategories(type);

        return res.json({
            success: true,
            data: categories
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

export async function getById(req, res) {
    try {
        const { id } = req.params;
        const category = getCategoryById(id);

        if (!category) {
            return res.status(404).json({
                success: false,
                error: 'Categoría no encontrada'
            });
        }

        return res.json({
            success: true,
            data: category
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

export async function create(req, res) {
    try {
        const category = createCategory(req.body);

        return res.status(201).json({
            success: true,
            data: category
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

export default {
    list,
    getById,
    create
};
