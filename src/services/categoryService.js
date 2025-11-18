/**
 * BUBU - Category Service
 * Gestión de categorías de ingresos y gastos
 */

import getDatabase from '../db/connection.js';

/**
 * Obtiene todas las categorías
 * @param {string} type - Filtro opcional por tipo (income/expense)
 * @returns {Array} Lista de categorías
 */
export function getAllCategories(type = null) {
    const db = getDatabase();

    if (type) {
        return db.prepare('SELECT * FROM categories WHERE type = ? ORDER BY name').all(type);
    }

    return db.prepare('SELECT * FROM categories ORDER BY type, name').all();
}

/**
 * Obtiene una categoría por ID
 * @param {number} id - ID de la categoría
 * @returns {object|null} Categoría o null
 */
export function getCategoryById(id) {
    const db = getDatabase();
    return db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
}

/**
 * Obtiene una categoría por nombre (case-insensitive)
 * @param {string} name - Nombre de la categoría
 * @returns {object|null} Categoría o null
 */
export function getCategoryByName(name) {
    const db = getDatabase();
    return db.prepare('SELECT * FROM categories WHERE LOWER(name) = LOWER(?)').get(name);
}

/**
 * Crea una nueva categoría
 * @param {object} data - Datos de la categoría
 * @returns {object} Categoría creada
 */
export function createCategory(data) {
    const db = getDatabase();
    const { name, type, color, icon } = data;

    if (!name || !type) {
        throw new Error('El nombre y tipo son requeridos');
    }

    if (!['income', 'expense'].includes(type)) {
        throw new Error('Tipo inválido. Debe ser "income" o "expense"');
    }

    const stmt = db.prepare(`
        INSERT INTO categories (name, type, color, icon)
        VALUES (?, ?, ?, ?)
    `);

    const result = stmt.run(name, type, color || '#6B7280', icon || null);

    return getCategoryById(result.lastInsertRowid);
}

/**
 * Busca la categoría más apropiada usando palabras clave
 * @param {string} description - Descripción del gasto/ingreso
 * @param {string} type - Tipo (income/expense)
 * @returns {object|null} Categoría sugerida
 */
export function suggestCategory(description, type) {
    const db = getDatabase();
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
            const category = getCategoryByName(categoryName);
            if (category) return category;
        }
    }

    // Si no se encuentra, retornar categoría "Otros"
    const fallbackName = type === 'expense' ? 'Otros Gastos' : 'Otros Ingresos';
    return getCategoryByName(fallbackName);
}

export default {
    getAllCategories,
    getCategoryById,
    getCategoryByName,
    createCategory,
    suggestCategory
};
