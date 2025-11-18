/**
 * BUBU - Transaction Service
 * Gestión de transacciones (ingresos y gastos)
 */

import { query, queryOne, execute } from '../db/connection.js';
import { getTodayMexico, getStartOfMonthMexico, getEndOfMonthMexico } from '../utils/dateUtils.js';

/**
 * Crea una nueva transacción
 * @param {object} data - Datos de la transacción
 * @returns {object} Transacción creada
 */
export async function createTransaction(data) {
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

    // Usar fecha actual de México si no se proporciona
    const finalDate = transaction_date || getTodayMexico();

    const result = await execute(
        `INSERT INTO transactions (user_phone, category_id, type, amount, description, transaction_date)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [user_phone, category_id, type, amount, description || null, finalDate]
    );

    return await getTransactionById(result.rows[0].id);
}

/**
 * Obtiene una transacción por ID
 * @param {number} id - ID de la transacción
 * @returns {object|null} Transacción o null
 */
export async function getTransactionById(id) {
    return await queryOne(`
        SELECT
            t.*,
            c.name as category_name,
            c.icon as category_icon,
            c.color as category_color
        FROM transactions t
        JOIN categories c ON t.category_id = c.id
        WHERE t.id = $1
    `, [id]);
}

/**
 * Obtiene todas las transacciones de un usuario
 * @param {string} user_phone - Teléfono del usuario
 * @param {object} filters - Filtros opcionales (startDate, endDate, type, category_id)
 * @returns {Array} Lista de transacciones
 */
export async function getUserTransactions(user_phone, filters = {}) {
    const { startDate, endDate, type, category_id, limit = 100 } = filters;

    let sql = `
        SELECT
            t.*,
            c.name as category_name,
            c.icon as category_icon,
            c.color as category_color
        FROM transactions t
        JOIN categories c ON t.category_id = c.id
        WHERE t.user_phone = $1
    `;

    const params = [user_phone];
    let paramCount = 2;

    if (startDate) {
        sql += ` AND t.transaction_date >= $${paramCount++}`;
        params.push(startDate);
    }

    if (endDate) {
        sql += ` AND t.transaction_date <= $${paramCount++}`;
        params.push(endDate);
    }

    if (type) {
        sql += ` AND t.type = $${paramCount++}`;
        params.push(type);
    }

    if (category_id) {
        sql += ` AND t.category_id = $${paramCount++}`;
        params.push(category_id);
    }

    sql += ` ORDER BY t.transaction_date DESC, t.created_at DESC LIMIT $${paramCount}`;
    params.push(limit);

    return await query(sql, params);
}

/**
 * Obtiene el resumen financiero de un usuario
 * @param {string} user_phone - Teléfono del usuario
 * @param {object} period - Periodo (startDate, endDate)
 * @returns {object} Resumen con totales de ingresos, gastos y balance
 */
export async function getFinancialSummary(user_phone, period = {}) {
    // Si no se especifica periodo, usar el mes actual en zona horaria de México
    if (!period.startDate || !period.endDate) {
        period.startDate = getStartOfMonthMexico();
        period.endDate = getEndOfMonthMexico();
    }

    // Calcular totales
    const summary = await queryOne(`
        SELECT
            SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as total_income,
            SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as total_expense,
            COUNT(CASE WHEN type = 'income' THEN 1 END) as income_count,
            COUNT(CASE WHEN type = 'expense' THEN 1 END) as expense_count
        FROM transactions
        WHERE user_phone = $1
        AND transaction_date BETWEEN $2 AND $3
    `, [user_phone, period.startDate, period.endDate]);

    // Calcular por categoría
    const byCategory = await query(`
        SELECT
            c.name as category,
            c.icon,
            c.color,
            t.type,
            SUM(t.amount) as total,
            COUNT(*) as count
        FROM transactions t
        JOIN categories c ON t.category_id = c.id
        WHERE t.user_phone = $1
        AND t.transaction_date BETWEEN $2 AND $3
        GROUP BY c.id, c.name, c.icon, c.color, t.type
        ORDER BY total DESC
    `, [user_phone, period.startDate, period.endDate]);

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
export async function deleteTransaction(id, user_phone) {
    // Verificar que la transacción pertenece al usuario
    const transaction = await queryOne(
        'SELECT * FROM transactions WHERE id = $1 AND user_phone = $2',
        [id, user_phone]
    );

    if (!transaction) {
        throw new Error('Transacción no encontrada o no pertenece al usuario');
    }

    await execute('DELETE FROM transactions WHERE id = $1', [id]);
    return true;
}

/**
 * Actualiza una transacción
 * @param {number} id - ID de la transacción
 * @param {string} user_phone - Teléfono del usuario
 * @param {object} data - Datos a actualizar
 * @returns {object} Transacción actualizada
 */
export async function updateTransaction(id, user_phone, data) {
    // Verificar que la transacción pertenece al usuario
    const transaction = await queryOne(
        'SELECT * FROM transactions WHERE id = $1 AND user_phone = $2',
        [id, user_phone]
    );

    if (!transaction) {
        throw new Error('Transacción no encontrada o no pertenece al usuario');
    }

    const { category_id, amount, description, transaction_date } = data;
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (category_id !== undefined) {
        updates.push(`category_id = $${paramCount++}`);
        values.push(category_id);
    }
    if (amount !== undefined) {
        if (amount <= 0) throw new Error('El monto debe ser mayor a 0');
        updates.push(`amount = $${paramCount++}`);
        values.push(amount);
    }
    if (description !== undefined) {
        updates.push(`description = $${paramCount++}`);
        values.push(description);
    }
    if (transaction_date !== undefined) {
        updates.push(`transaction_date = $${paramCount++}`);
        values.push(transaction_date);
    }

    if (updates.length === 0) {
        throw new Error('No hay datos para actualizar');
    }

    values.push(id);

    const sql = `UPDATE transactions SET ${updates.join(', ')} WHERE id = $${paramCount}`;
    await execute(sql, values);

    return await getTransactionById(id);
}

export default {
    createTransaction,
    getTransactionById,
    getUserTransactions,
    getFinancialSummary,
    deleteTransaction,
    updateTransaction
};
