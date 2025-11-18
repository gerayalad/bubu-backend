/**
 * BUBU - Category Service
 * Gestión de categorías de ingresos y gastos
 */

import { query, queryOne, execute } from '../db/connection.js';

/**
 * Obtiene todas las categorías
 * @param {string} type - Filtro opcional por tipo (income/expense)
 * @returns {Array} Lista de categorías
 */
export async function getAllCategories(type = null) {
    if (type) {
        return await query('SELECT * FROM categories WHERE type = $1 ORDER BY name', [type]);
    }

    return await query('SELECT * FROM categories ORDER BY type, name');
}

/**
 * Obtiene una categoría por ID
 * @param {number} id - ID de la categoría
 * @returns {object|null} Categoría o null
 */
export async function getCategoryById(id) {
    return await queryOne('SELECT * FROM categories WHERE id = $1', [id]);
}

/**
 * Obtiene una categoría por nombre (case-insensitive)
 * @param {string} name - Nombre de la categoría
 * @returns {object|null} Categoría o null
 */
export async function getCategoryByName(name) {
    return await queryOne('SELECT * FROM categories WHERE LOWER(name) = LOWER($1)', [name]);
}

/**
 * Crea una nueva categoría
 * @param {object} data - Datos de la categoría
 * @returns {object} Categoría creada
 */
export async function createCategory(data) {
    const { name, type, color, icon } = data;

    if (!name || !type) {
        throw new Error('El nombre y tipo son requeridos');
    }

    if (!['income', 'expense'].includes(type)) {
        throw new Error('Tipo inválido. Debe ser "income" o "expense"');
    }

    const result = await execute(
        `INSERT INTO categories (name, type, color, icon)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [name, type, color || '#6B7280', icon || null]
    );

    return result.rows[0];
}

/**
 * Busca la categoría más apropiada usando palabras clave
 * @param {string} description - Descripción del gasto/ingreso
 * @param {string} type - Tipo (income/expense)
 * @returns {object|null} Categoría sugerida
 */
export async function suggestCategory(description, type) {
    const lowerDesc = description.toLowerCase();

    // Mapeo de palabras clave a categorías
    const keywords = {
        expense: {
            'Comida': ['comida', 'taco', 'restaurante', 'cena', 'desayuno', 'almuerzo', 'comí', 'pizza', 'hamburguesa', 'café'],
            'Transporte': ['uber', 'taxi', 'gasolina', 'transporte', 'metro', 'autobús', 'parking'],
            'Entretenimiento': ['cine', 'netflix', 'spotify', 'juego', 'concierto', 'fiesta', 'bar'],
            'Servicios': ['luz', 'agua', 'internet', 'teléfono', 'netflix', 'spotify', 'servicio'],
            'Salud': ['doctor', 'medicamento', 'farmacia', 'hospital', 'dentista', 'consulta'],
            'Educación': ['curso', 'libro', 'escuela', 'universidad', 'clase'],
            'Ropa': ['ropa', 'zapatos', 'camisa', 'pantalón', 'vestido'],
            'Hogar': ['renta', 'mueble', 'decoración', 'limpieza', 'hogar']
        },
        income: {
            'Nómina': ['nómina', 'sueldo', 'salario', 'pago', 'quincena'],
            'Ventas': ['venta', 'vendí', 'cliente', 'cobro'],
            'Inversiones': ['inversión', 'dividendo', 'interés', 'ganancia']
        }
    };

    // Buscar coincidencias en palabras clave
    const typeKeywords = keywords[type] || {};

    for (const [categoryName, words] of Object.entries(typeKeywords)) {
        if (words.some(word => lowerDesc.includes(word))) {
            const category = await getCategoryByName(categoryName);
            if (category) return category;
        }
    }

    // Si no se encuentra, retornar categoría "Otros"
    const fallbackName = type === 'expense' ? 'Otros Gastos' : 'Otros Ingresos';
    return await getCategoryByName(fallbackName);
}

export default {
    getAllCategories,
    getCategoryById,
    getCategoryByName,
    createCategory,
    suggestCategory
};
