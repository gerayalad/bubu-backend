/**
 * BUBU - Transaction Service
 * Gestión de transacciones (ingresos y gastos)
 */

import getDatabase from '../db/connection.js';

/**
 * Crea una nueva transacción
 * @param {object} data - Datos de la transacción
 * @returns {object} Transacción creada
 */
export function createTransaction(data) {
    const db = getDatabase();
    const { user_phone, category_id, type, amount, description, transaction_date } = data;

    // Validaciones
    if (!user_phone || !category_id || !type || !amount) {
        throw new Error('Faltan datos obligatorios: user_phone, category_id, type, amount');
    }

    if (!['income', 'expense'].includes(type)) {
        throw new Error('Tipo inválido. Debe ser "income" o "expense"');
    }

    if (amount <= 0) {
        throw new Error('El monto debe ser mayor a 0');
    }

    // Usar fecha actual si no se proporciona
    const finalDate = transaction_date || new Date().toISOString().split('T')[0];

    const stmt = db.prepare(`
        INSERT INTO transactions (user_phone, category_id, type, amount, description, transaction_date)
        VALUES (?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(user_phone, category_id, type, amount, description || null, finalDate);

    return getTransactionById(result.lastInsertRowid);
}

/**
 * Obtiene una transacción por ID
 * @param {number} id - ID de la transacción
 * @returns {object|null} Transacción o null
 */
export function getTransactionById(id) {
    const db = getDatabase();
    return db.prepare(`
        SELECT
            t.*,
            c.name as category_name,
            c.icon as category_icon,
            c.color as category_color
        FROM transactions t
        JOIN categories c ON t.category_id = c.id
        WHERE t.id = ?
    `).get(id);
}

/**
 * Obtiene todas las transacciones de un usuario
 * @param {string} user_phone - Teléfono del usuario
 * @param {object} filters - Filtros opcionales (startDate, endDate, type, category_id)
 * @returns {Array} Lista de transacciones
 */
export function getUserTransactions(user_phone, filters = {}) {
    const db = getDatabase();
    const { startDate, endDate, type, category_id, limit = 100 } = filters;

    let sql = `
        SELECT
            t.*,
            c.name as category_name,
            c.icon as category_icon,
            c.color as category_color
        FROM transactions t
        JOIN categories c ON t.category_id = c.id
        WHERE t.user_phone = ?
    `;

    const params = [user_phone];

    if (startDate) {
        sql += ' AND t.transaction_date >= ?';
        params.push(startDate);
    }

    if (endDate) {
        sql += ' AND t.transaction_date <= ?';
        params.push(endDate);
    }

    if (type) {
        sql += ' AND t.type = ?';
        params.push(type);
    }

    if (category_id) {
        sql += ' AND t.category_id = ?';
        params.push(category_id);
    }

    sql += ' ORDER BY t.transaction_date DESC, t.created_at DESC LIMIT ?';
    params.push(limit);

    return db.prepare(sql).all(...params);
}

/**
 * Obtiene el resumen financiero de un usuario
 * @param {string} user_phone - Teléfono del usuario
 * @param {object} period - Periodo (startDate, endDate)
 * @returns {object} Resumen con totales de ingresos, gastos y balance
 */
export function getFinancialSummary(user_phone, period = {}) {
    const db = getDatabase();

    // Si no se especifica periodo, usar el mes actual
    if (!period.startDate || !period.endDate) {
        const now = new Date();
        period.startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        period.endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    }

    // Calcular totales
    const summary = db.prepare(`
        SELECT
            SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as total_income,
            SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as total_expense,
            COUNT(CASE WHEN type = 'income' THEN 1 END) as income_count,
            COUNT(CASE WHEN type = 'expense' THEN 1 END) as expense_count
        FROM transactions
        WHERE user_phone = ?
        AND transaction_date BETWEEN ? AND ?
    `).get(user_phone, period.startDate, period.endDate);

    // Calcular por categoría
    const byCategory = db.prepare(`
        SELECT
            c.name as category,
            c.icon,
            c.color,
            t.type,
            SUM(t.amount) as total,
            COUNT(*) as count
        FROM transactions t
        JOIN categories c ON t.category_id = c.id
        WHERE t.user_phone = ?
        AND t.transaction_date BETWEEN ? AND ?
        GROUP BY c.id, c.name, c.icon, c.color, t.type
        ORDER BY total DESC
    `).all(user_phone, period.startDate, period.endDate);

    const totalIncome = summary.total_income || 0;
    const totalExpense = summary.total_expense || 0;
    const balance = totalIncome - totalExpense;

    return {
        period: {
            startDate: period.startDate,
            endDate: period.endDate
        },
        totals: {
            income: totalIncome,
            expense: totalExpense,
            balance: balance
        },
        counts: {
            income: summary.income_count || 0,
            expense: summary.expense_count || 0
        },
        byCategory: byCategory
    };
}

/**
 * Elimina una transacción
 * @param {number} id - ID de la transacción
 * @param {string} user_phone - Teléfono del usuario (para validar propiedad)
 * @returns {boolean} true si se eliminó
 */
export function deleteTransaction(id, user_phone) {
    const db = getDatabase();

    // Verificar que la transacción pertenece al usuario
    const transaction = db.prepare('SELECT * FROM transactions WHERE id = ? AND user_phone = ?').get(id, user_phone);

    if (!transaction) {
        throw new Error('Transacción no encontrada o no pertenece al usuario');
    }

    db.prepare('DELETE FROM transactions WHERE id = ?').run(id);
    return true;
}

/**
 * Actualiza una transacción
 * @param {number} id - ID de la transacción
 * @param {string} user_phone - Teléfono del usuario
 * @param {object} data - Datos a actualizar
 * @returns {object} Transacción actualizada
 */
export function updateTransaction(id, user_phone, data) {
    const db = getDatabase();

    // Verificar que la transacción pertenece al usuario
    const transaction = db.prepare('SELECT * FROM transactions WHERE id = ? AND user_phone = ?').get(id, user_phone);

    if (!transaction) {
        throw new Error('Transacción no encontrada o no pertenece al usuario');
    }

    const { category_id, amount, description, transaction_date } = data;
    const updates = [];
    const values = [];

    if (category_id !== undefined) {
        updates.push('category_id = ?');
        values.push(category_id);
    }
    if (amount !== undefined) {
        if (amount <= 0) throw new Error('El monto debe ser mayor a 0');
        updates.push('amount = ?');
        values.push(amount);
    }
    if (description !== undefined) {
        updates.push('description = ?');
        values.push(description);
    }
    if (transaction_date !== undefined) {
        updates.push('transaction_date = ?');
        values.push(transaction_date);
    }

    if (updates.length === 0) {
        throw new Error('No hay datos para actualizar');
    }

    values.push(id);

    const sql = `UPDATE transactions SET ${updates.join(', ')} WHERE id = ?`;
    db.prepare(sql).run(...values);

    return getTransactionById(id);
}

export default {
    createTransaction,
    getTransactionById,
    getUserTransactions,
    getFinancialSummary,
    deleteTransaction,
    updateTransaction
};
