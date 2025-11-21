/**
 * BUBU - Balance Service
 * Calcula balances de gastos compartidos entre usuarios
 */

import { query } from '../db/connection.js';
import { getRelationship, getPartnerPhone } from './relationshipService.js';

/**
 * Calcula el balance de gastos compartidos entre un usuario y su pareja
 * @param {string} user_phone - Teléfono del usuario
 * @param {string} partner_phone - Teléfono de la pareja
 * @param {string} period - Periodo: 'mes_actual', 'mes_pasado', 'todos'
 * @returns {Promise<object>} Balance calculado
 */
export async function calculateBalance(user_phone, partner_phone, period = 'mes_actual') {
    // Validar que exista la relación
    const relationship = await getRelationship(user_phone);

    if (!relationship) {
        throw new Error('No tienes una relación activa');
    }

    // Construir filtro de fecha
    let dateFilter = '';

    if (period === 'mes_actual') {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        dateFilter = `AND DATE_TRUNC('month', t.transaction_date) = DATE_TRUNC('month', DATE '${year}-${month}-01')`;
    } else if (period === 'mes_pasado') {
        const today = new Date();
        const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const year = lastMonth.getFullYear();
        const month = String(lastMonth.getMonth() + 1).padStart(2, '0');
        dateFilter = `AND DATE_TRUNC('month', t.transaction_date) = DATE_TRUNC('month', DATE '${year}-${month}-01')`;
    }

    // Obtener todos los gastos compartidos del periodo
    const sharedExpenses = await query(`
        SELECT
            st.*,
            t.transaction_date,
            t.type,
            t.amount as individual_amount,
            t.user_phone
        FROM shared_transactions st
        JOIN transactions t ON (t.id = st.transaction_id_user1 OR t.id = st.transaction_id_user2)
        WHERE t.is_shared = true
          AND (t.user_phone = $1 OR t.user_phone = $2)
          ${dateFilter}
        ORDER BY t.transaction_date DESC
    `, [user_phone, partner_phone]);

    // Agrupar por shared_transaction_id para evitar duplicados
    const uniqueExpenses = new Map();

    for (const expense of sharedExpenses) {
        if (!uniqueExpenses.has(expense.id)) {
            uniqueExpenses.set(expense.id, {
                shared_id: expense.id,
                total_amount: parseFloat(expense.total_amount),
                payer_phone: expense.payer_phone,
                split_user1: parseFloat(expense.split_percentage_user1),
                split_user2: parseFloat(expense.split_percentage_user2),
                date: expense.transaction_date,
                type: expense.type
            });
        }
    }

    // Calcular totales
    let user_paid_total = 0;      // Cuánto pagó el usuario
    let partner_paid_total = 0;   // Cuánto pagó la pareja
    let user_owes_total = 0;      // Cuánto debe pagar el usuario (su parte)
    let partner_owes_total = 0;   // Cuánto debe pagar la pareja (su parte)

    let expense_count = 0;
    let user_paid_count = 0;
    let partner_paid_count = 0;

    // Determinar si el usuario es user1 o user2 en la relación
    const isUser1 = relationship.user_phone_1 === user_phone;

    for (const [_, expense] of uniqueExpenses) {
        expense_count++;

        // Sumar lo que pagó cada uno
        if (expense.payer_phone === user_phone) {
            user_paid_total += expense.total_amount;
            user_paid_count++;
        } else {
            partner_paid_total += expense.total_amount;
            partner_paid_count++;
        }

        // Calcular lo que debe cada uno (su parte del gasto)
        const user_percentage = isUser1 ? expense.split_user1 : expense.split_user2;
        const partner_percentage = isUser1 ? expense.split_user2 : expense.split_user1;

        user_owes_total += (expense.total_amount * user_percentage) / 100;
        partner_owes_total += (expense.total_amount * partner_percentage) / 100;
    }

    // Calcular balance neto
    // Balance = Lo que pagaste - Lo que debes
    const user_balance = user_paid_total - user_owes_total;
    const partner_balance = partner_paid_total - partner_owes_total;

    // Determinar quién debe a quién
    let who_owes_whom = null;
    let amount_owed = 0;

    if (user_balance > 0) {
        who_owes_whom = 'partner_owes_user';
        amount_owed = Math.abs(user_balance);
    } else if (user_balance < 0) {
        who_owes_whom = 'user_owes_partner';
        amount_owed = Math.abs(user_balance);
    } else {
        who_owes_whom = 'balanced';
        amount_owed = 0;
    }

    console.log(`⚖️ Balance calculado: ${user_phone} <-> ${partner_phone} | ${who_owes_whom} | $${amount_owed.toFixed(2)}`);

    return {
        user_phone,
        partner_phone,
        period,
        total_shared_expenses: parseFloat(user_owes_total + partner_owes_total).toFixed(2),
        expense_count,
        user: {
            paid_total: parseFloat(user_paid_total).toFixed(2),
            paid_count: user_paid_count,
            owes_total: parseFloat(user_owes_total).toFixed(2),
            balance: parseFloat(user_balance).toFixed(2)
        },
        partner: {
            paid_total: parseFloat(partner_paid_total).toFixed(2),
            paid_count: partner_paid_count,
            owes_total: parseFloat(partner_owes_total).toFixed(2),
            balance: parseFloat(partner_balance).toFixed(2)
        },
        who_owes_whom,
        amount_owed: parseFloat(amount_owed).toFixed(2)
    };
}

/**
 * Obtiene el historial de balances mensuales
 * @param {string} user_phone - Teléfono del usuario
 * @param {number} months - Cantidad de meses hacia atrás (default: 6)
 * @returns {Promise<Array>} Lista de balances mensuales
 */
export async function getBalanceHistory(user_phone, months = 6) {
    const partner_phone = await getPartnerPhone(user_phone);

    if (!partner_phone) {
        return [];
    }

    const balances = [];
    const today = new Date();

    for (let i = 0; i < months; i++) {
        const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');

        // Calcular balance para ese mes específico
        const monthBalance = await calculateBalanceForMonth(user_phone, partner_phone, year, month);

        balances.push({
            month: `${year}-${month}`,
            ...monthBalance
        });
    }

    return balances;
}

/**
 * Calcula balance para un mes específico
 * @param {string} user_phone - Teléfono del usuario
 * @param {string} partner_phone - Teléfono de la pareja
 * @param {number} year - Año
 * @param {string} month - Mes (formato: '01', '02', etc.)
 * @returns {Promise<object>} Balance del mes
 */
async function calculateBalanceForMonth(user_phone, partner_phone, year, month) {
    const relationship = await getRelationship(user_phone);

    if (!relationship) {
        return { total_expenses: 0, user_balance: 0, partner_balance: 0 };
    }

    const dateFilter = `DATE_TRUNC('month', t.transaction_date) = DATE_TRUNC('month', DATE '${year}-${month}-01')`;

    const sharedExpenses = await query(`
        SELECT
            st.*,
            t.user_phone
        FROM shared_transactions st
        JOIN transactions t ON (t.id = st.transaction_id_user1 OR t.id = st.transaction_id_user2)
        WHERE t.is_shared = true
          AND (t.user_phone = $1 OR t.user_phone = $2)
          AND ${dateFilter}
    `, [user_phone, partner_phone]);

    const uniqueExpenses = new Map();

    for (const expense of sharedExpenses) {
        if (!uniqueExpenses.has(expense.id)) {
            uniqueExpenses.set(expense.id, {
                total_amount: parseFloat(expense.total_amount),
                payer_phone: expense.payer_phone,
                split_user1: parseFloat(expense.split_percentage_user1),
                split_user2: parseFloat(expense.split_percentage_user2)
            });
        }
    }

    let user_paid = 0;
    let partner_paid = 0;
    let user_owes = 0;
    let partner_owes = 0;

    const isUser1 = relationship.user_phone_1 === user_phone;

    for (const [_, expense] of uniqueExpenses) {
        if (expense.payer_phone === user_phone) {
            user_paid += expense.total_amount;
        } else {
            partner_paid += expense.total_amount;
        }

        const user_percentage = isUser1 ? expense.split_user1 : expense.split_user2;
        const partner_percentage = isUser1 ? expense.split_user2 : expense.split_user1;

        user_owes += (expense.total_amount * user_percentage) / 100;
        partner_owes += (expense.total_amount * partner_percentage) / 100;
    }

    return {
        total_expenses: parseFloat(user_owes + partner_owes).toFixed(2),
        user_balance: parseFloat(user_paid - user_owes).toFixed(2),
        partner_balance: parseFloat(partner_paid - partner_owes).toFixed(2)
    };
}

/**
 * Obtiene lista detallada de gastos compartidos para el balance
 * @param {string} user_phone - Teléfono del usuario
 * @param {string} period - Periodo: 'mes_actual', 'mes_pasado', 'todos'
 * @returns {Promise<Array>} Lista de gastos con información de balance
 */
export async function getSharedTransactionsForBalance(user_phone, period = 'mes_actual') {
    const partner_phone = await getPartnerPhone(user_phone);

    if (!partner_phone) {
        return [];
    }

    const relationship = await getRelationship(user_phone);
    const isUser1 = relationship.user_phone_1 === user_phone;

    let dateFilter = '';

    if (period === 'mes_actual') {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        dateFilter = `AND DATE_TRUNC('month', t.transaction_date) = DATE_TRUNC('month', DATE '${year}-${month}-01')`;
    } else if (period === 'mes_pasado') {
        const today = new Date();
        const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const year = lastMonth.getFullYear();
        const month = String(lastMonth.getMonth() + 1).padStart(2, '0');
        dateFilter = `AND DATE_TRUNC('month', t.transaction_date) = DATE_TRUNC('month', DATE '${year}-${month}-01')`;
    }

    const expenses = await query(`
        SELECT DISTINCT ON (st.id)
            st.id as shared_id,
            st.total_amount,
            st.payer_phone,
            st.split_percentage_user1,
            st.split_percentage_user2,
            t.transaction_date,
            t.description,
            c.name as category_name,
            c.icon as category_icon
        FROM shared_transactions st
        JOIN transactions t ON (t.id = st.transaction_id_user1 OR t.id = st.transaction_id_user2)
        JOIN categories c ON t.category_id = c.id
        WHERE t.is_shared = true
          AND (t.user_phone = $1 OR t.user_phone = $2)
          ${dateFilter}
        ORDER BY st.id, t.transaction_date DESC
    `, [user_phone, partner_phone]);

    return expenses.map(expense => {
        const user_percentage = isUser1 ? expense.split_percentage_user1 : expense.split_percentage_user2;
        const user_amount = (parseFloat(expense.total_amount) * parseFloat(user_percentage)) / 100;
        const paid_by_user = expense.payer_phone === user_phone;

        return {
            shared_id: expense.shared_id,
            total_amount: parseFloat(expense.total_amount),
            user_amount: parseFloat(user_amount).toFixed(2),
            user_percentage: parseFloat(user_percentage),
            paid_by_user,
            payer_phone: expense.payer_phone,
            description: expense.description,
            category: {
                name: expense.category_name,
                icon: expense.category_icon
            },
            transaction_date: expense.transaction_date
        };
    });
}

export default {
    calculateBalance,
    getBalanceHistory,
    getSharedTransactionsForBalance
};
