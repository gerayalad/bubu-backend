/**
 * BUBU - Category Service
 * Gestión de categorías de gastos
 */

import { query, queryOne, execute } from '../db/connection.js';

/**
 * Obtiene todas las categorías de gastos
 * @param {string} type - Tipo (siempre 'expense')
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

    if (type !== 'expense') {
        throw new Error('Tipo inválido. Solo se permiten categorías de gastos (type debe ser "expense")');
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
 * @param {string} description - Descripción del gasto
 * @param {string} type - Tipo (siempre 'expense')
 * @returns {object|null} Categoría sugerida
 */
export async function suggestCategory(description, type = 'expense') {
    const lowerDesc = description.toLowerCase();

    // Mapeo de palabras clave a categorías (solo gastos)
    const keywords = {
        'Comida': ['comida', 'taco', 'restaurante', 'cena', 'desayuno', 'almuerzo', 'comí', 'pizza', 'hamburguesa', 'café'],
        'Transporte': ['uber', 'taxi', 'gasolina', 'transporte', 'metro', 'autobús', 'parking'],
        'Entretenimiento': ['cine', 'netflix', 'spotify', 'juego', 'concierto', 'fiesta', 'bar'],
        'Servicios': ['luz', 'agua', 'internet', 'teléfono', 'netflix', 'spotify', 'servicio'],
        'Salud': ['doctor', 'medicamento', 'farmacia', 'hospital', 'dentista', 'consulta'],
        'Educación': ['curso', 'libro', 'escuela', 'universidad', 'clase'],
        'Ropa': ['ropa', 'zapatos', 'camisa', 'pantalón', 'vestido'],
        'Hogar': ['renta', 'mueble', 'decoración', 'limpieza', 'hogar']
    };

    // Buscar coincidencias en palabras clave
    for (const [categoryName, words] of Object.entries(keywords)) {
        if (words.some(word => lowerDesc.includes(word))) {
            const category = await getCategoryByName(categoryName);
            if (category) return category;
        }
    }

    // Si no se encuentra, retornar categoría "Otros Gastos"
    return await getCategoryByName('Otros Gastos');
}

/**
 * Actualiza una categoría personalizada
 * @param {number} id - ID de la categoría
 * @param {object} data - Datos a actualizar (name, color, icon)
 * @returns {object} Categoría actualizada
 */
export async function updateCategory(id, data) {
    const { name, color, icon } = data;

    // Verificar que la categoría existe
    const category = await getCategoryById(id);
    if (!category) {
        throw new Error('Categoría no encontrada');
    }

    // Validar que no sea una categoría predefinida por nombre
    const predefinedCategories = [
        'Comida', 'Transporte', 'Entretenimiento', 'Servicios', 'Salud',
        'Educación', 'Ropa', 'Hogar', 'Otros Gastos'
    ];

    if (predefinedCategories.includes(category.name)) {
        throw new Error('No se pueden editar las categorías predefinidas');
    }

    // Si se está cambiando el nombre, verificar que no exista otra con ese nombre
    if (name && name !== category.name) {
        const existing = await getCategoryByName(name);
        if (existing) {
            throw new Error(`Ya existe una categoría con el nombre "${name}"`);
        }
    }

    // Construir query de actualización
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (name) {
        updates.push(`name = $${paramCount++}`);
        values.push(name);
    }
    if (color) {
        updates.push(`color = $${paramCount++}`);
        values.push(color);
    }
    if (icon !== undefined) {
        updates.push(`icon = $${paramCount++}`);
        values.push(icon);
    }

    if (updates.length === 0) {
        throw new Error('No hay cambios para actualizar');
    }

    values.push(id);
    const result = await execute(
        `UPDATE categories SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
        values
    );

    return result.rows[0];
}

/**
 * Elimina una categoría personalizada
 * Las transacciones asociadas se mueven a "Otros Gastos"
 * @param {number} id - ID de la categoría a eliminar
 * @returns {object} Resultado de la eliminación
 */
export async function deleteCategory(id) {
    // Verificar que la categoría existe
    const category = await getCategoryById(id);
    if (!category) {
        throw new Error('Categoría no encontrada');
    }

    // Validar que no sea una categoría predefinida
    const predefinedCategories = [
        'Comida', 'Transporte', 'Entretenimiento', 'Servicios', 'Salud',
        'Educación', 'Ropa', 'Hogar', 'Otros Gastos'
    ];

    if (predefinedCategories.includes(category.name)) {
        throw new Error('No se pueden eliminar las categorías predefinidas');
    }

    // Determinar categoría de reemplazo según el tipo
    const fallbackName = 'Otros Gastos';
    const fallbackCategory = await getCategoryByName(fallbackName);

    if (!fallbackCategory) {
        throw new Error('No se encontró la categoría de reemplazo');
    }

    // Mover todas las transacciones a la categoría de "Otros"
    const updateResult = await execute(
        'UPDATE transactions SET category_id = $1 WHERE category_id = $2',
        [fallbackCategory.id, id]
    );

    const movedTransactions = updateResult.rowCount || 0;

    // Eliminar la categoría
    await execute('DELETE FROM categories WHERE id = $1', [id]);

    return {
        deleted: category,
        movedTransactions,
        movedTo: fallbackCategory.name
    };
}

export default {
    getAllCategories,
    getCategoryById,
    getCategoryByName,
    createCategory,
    updateCategory,
    deleteCategory,
    suggestCategory
};
