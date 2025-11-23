/**
 * BUBU - Shared Transaction Service
 * Maneja transacciones compartidas entre usuarios
 */

import { query, queryOne, execute } from '../db/connection.js';
import { createTransaction } from './transactionService.js';
import { getRelationship, getDefaultSplit } from './relationshipService.js';
import { getTodayMexico } from '../utils/dateUtils.js';

/**
 * Crea un gasto compartido (dos transacciones vinculadas)
 * @param {object} data - Datos del gasto compartido
 * @param {string} data.payer_phone - Quién pagó el gasto completo
 * @param {string} data.partner_phone - Teléfono de la pareja
 * @param {number} data.total_amount - Monto total del gasto
 * @param {number} data.category_id - ID de la categoría
 * @param {string} data.type - Tipo (expense o income)
 * @param {string} data.description - Descripción del gasto
 * @param {number} data.split_user1 - Porcentaje del usuario 1 (quien paga)
 * @param {number} data.split_user2 - Porcentaje del usuario 2 (pareja)
 * @param {string} data.transaction_date - Fecha de la transacción
 * @param {number} data.relationship_id - ID de la relación
 * @returns {Promise<object>} Gasto compartido creado
 */
export async function createSharedTransaction(data) {
    const {
        payer_phone,
        partner_phone,
        total_amount,
        category_id,
        type = 'expense',
        description,
        split_user1,
        split_user2,
        transaction_date,
        relationship_id
    } = data;

    // Validaciones
    if (!payer_phone || !partner_phone || !total_amount || !category_id) {
        throw new Error('Faltan datos obligatorios: payer_phone, partner_phone, total_amount, category_id');
    }

    // Validar que la suma sea 100% (con tolerancia de 0.01 para errores de punto flotante)
    const sumaSplit = Math.round((split_user1 + split_user2) * 100) / 100;
    if (Math.abs(sumaSplit - 100) > 0.01) {
        throw new Error(`La división debe sumar 100% (actual: ${sumaSplit}%)`);
    }

    if (total_amount <= 0) {
        throw new Error('El monto total debe ser mayor a 0');
    }

    const finalDate = transaction_date || getTodayMexico();

    // Calcular montos individuales
    const amount_user1 = (total_amount * split_user1) / 100;
    const amount_user2 = (total_amount * split_user2) / 100;

    console.log(`💳 Creando gasto compartido: $${total_amount} → $${amount_user1} (${split_user1}%) + $${amount_user2} (${split_user2}%)`);

    try {
        // 1. Crear transacción para usuario 1 (payer)
        const transaction1 = await createTransaction({
            user_phone: payer_phone,
            category_id,
            type,
            amount: amount_user1,
            description,
            transaction_date: finalDate
        });

        // 2. Crear transacción para usuario 2 (partner)
        const transaction2 = await createTransaction({
            user_phone: partner_phone,
            category_id,
            type,
            amount: amount_user2,
            description,
            transaction_date: finalDate
        });

        // 3. Crear registro en shared_transactions vinculando ambas
        const sharedTxResult = await execute(`
            INSERT INTO shared_transactions (
                transaction_id_user1,
                transaction_id_user2,
                payer_phone,
                total_amount,
                split_percentage_user1,
                split_percentage_user2,
                relationship_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        `, [
            transaction1.id,
            transaction2.id,
            payer_phone,
            total_amount,
            split_user1,
            split_user2,
            relationship_id
        ]);

        const sharedTransaction = sharedTxResult.rows[0];

        // 4. Actualizar ambas transacciones marcándolas como compartidas
        await execute(`
            UPDATE transactions
            SET is_shared = true,
                shared_transaction_id = $1
            WHERE id IN ($2, $3)
        `, [sharedTransaction.id, transaction1.id, transaction2.id]);

        console.log(`✅ Gasto compartido creado: ID ${sharedTransaction.id}`);

        // Retornar objeto completo con toda la información
        return {
            shared_transaction_id: sharedTransaction.id,
            total_amount: parseFloat(total_amount),
            split: `${split_user1}/${split_user2}`,
            payer_phone,
            partner_phone,
            user1: {
                phone: payer_phone,
                transaction_id: transaction1.id,
                amount: parseFloat(amount_user1),
                percentage: parseFloat(split_user1)
            },
            user2: {
                phone: partner_phone,
                transaction_id: transaction2.id,
                amount: parseFloat(amount_user2),
                percentage: parseFloat(split_user2)
            },
            category_id,
            type,
            description,
            transaction_date: finalDate,
            created_at: sharedTransaction.created_at
        };

    } catch (error) {
        console.error('❌ Error creando gasto compartido:', error);
        throw error;
    }
}

/**
 * Obtiene todas las transacciones compartidas de un usuario en un periodo
 * @param {string} user_phone - Teléfono del usuario
 * @param {string} period - Periodo: 'mes_actual', 'mes_pasado', 'todos'
 * @returns {Promise<Array>} Lista de gastos compartidos
 */
export async function getSharedTransactions(user_phone, period = 'mes_actual') {
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

    const transactions = await query(`
        SELECT
            st.*,
            t.transaction_date,
            t.description,
            t.type,
            t.amount as user_amount,
            c.name as category_name,
            c.icon as category_icon,
            CASE
                WHEN st.transaction_id_user1 IN (SELECT id FROM transactions WHERE user_phone = $1)
                THEN st.split_percentage_user1
                ELSE st.split_percentage_user2
            END as user_percentage
        FROM shared_transactions st
        JOIN transactions t ON (t.id = st.transaction_id_user1 OR t.id = st.transaction_id_user2)
        JOIN categories c ON t.category_id = c.id
        WHERE t.user_phone = $1
          AND t.is_shared = true
          ${dateFilter}
        ORDER BY t.transaction_date DESC, st.created_at DESC
    `, [user_phone]);

    return transactions;
}

/**
 * Obtiene detalles de un gasto compartido específico
 * @param {number} shared_transaction_id - ID del gasto compartido
 * @returns {Promise<object|null>} Detalles del gasto compartido
 */
export async function getSharedTransactionDetails(shared_transaction_id) {
    const result = await queryOne(`
        SELECT
            st.*,
            t1.amount as amount_user1,
            t1.user_phone as phone_user1,
            t1.transaction_date,
            t1.description,
            t1.type,
            t2.amount as amount_user2,
            t2.user_phone as phone_user2,
            c.name as category_name,
            c.icon as category_icon
        FROM shared_transactions st
        JOIN transactions t1 ON st.transaction_id_user1 = t1.id
        JOIN transactions t2 ON st.transaction_id_user2 = t2.id
        JOIN categories c ON t1.category_id = c.id
        WHERE st.id = $1
    `, [shared_transaction_id]);

    if (!result) {
        return null;
    }

    return {
        shared_transaction_id: result.id,
        total_amount: parseFloat(result.total_amount),
        payer_phone: result.payer_phone,
        split: `${result.split_percentage_user1}/${result.split_percentage_user2}`,
        user1: {
            phone: result.phone_user1,
            amount: parseFloat(result.amount_user1),
            percentage: parseFloat(result.split_percentage_user1)
        },
        user2: {
            phone: result.phone_user2,
            amount: parseFloat(result.amount_user2),
            percentage: parseFloat(result.split_percentage_user2)
        },
        category: {
            name: result.category_name,
            icon: result.category_icon
        },
        description: result.description,
        type: result.type,
        transaction_date: result.transaction_date,
        created_at: result.created_at
    };
}

/**
 * Verifica si un usuario tiene una relación activa
 * @param {string} user_phone - Teléfono del usuario
 * @returns {Promise<boolean>} true si tiene pareja activa
 */
export async function hasActiveRelationship(user_phone) {
    const relationship = await getRelationship(user_phone);
    return relationship !== null;
}

/**
 * Obtiene información de división para un usuario (default o custom)
 * @param {string} user_phone - Teléfono del usuario
 * @param {number|null} custom_split_user - Porcentaje custom del usuario (opcional)
 * @param {number|null} custom_split_partner - Porcentaje custom de la pareja (opcional)
 * @returns {Promise<object>} {user_split, partner_split, partner_phone, relationship_id, is_custom}
 */
export async function getSplitInfo(user_phone, custom_split_user = null, custom_split_partner = null) {
    // Si se proporcionan splits custom, validar y usarlos
    if (custom_split_user !== null && custom_split_partner !== null) {
        if (custom_split_user + custom_split_partner !== 100) {
            throw new Error('La división custom debe sumar 100%');
        }

        const defaultSplit = await getDefaultSplit(user_phone);

        if (!defaultSplit) {
            throw new Error('No tienes una pareja registrada para gastos compartidos');
        }

        return {
            user_split: custom_split_user,
            partner_split: custom_split_partner,
            partner_phone: defaultSplit.partner_phone,
            relationship_id: defaultSplit.relationship_id,
            is_custom: true
        };
    }

    // Usar división por defecto
    const defaultSplit = await getDefaultSplit(user_phone);

    if (!defaultSplit) {
        throw new Error('No tienes una pareja registrada para gastos compartidos');
    }

    return {
        user_split: defaultSplit.user_split,
        partner_split: defaultSplit.partner_split,
        partner_phone: defaultSplit.partner_phone,
        relationship_id: defaultSplit.relationship_id,
        is_custom: false
    };
}

/**
 * Elimina un gasto compartido (elimina ambas transacciones)
 * @param {number} shared_transaction_id - ID del gasto compartido
 * @returns {Promise<object>} Resultado de la eliminación
 */
export async function deleteSharedTransaction(shared_transaction_id) {
    // Obtener IDs de las transacciones antes de eliminar
    const sharedTx = await queryOne(`
        SELECT transaction_id_user1, transaction_id_user2
        FROM shared_transactions
        WHERE id = $1
    `, [shared_transaction_id]);

    if (!sharedTx) {
        throw new Error('Gasto compartido no encontrado');
    }

    // Eliminar shared_transaction (esto también eliminará las transactions por CASCADE)
    await execute(`
        DELETE FROM shared_transactions
        WHERE id = $1
    `, [shared_transaction_id]);

    console.log(`🗑️ Gasto compartido eliminado: ID ${shared_transaction_id}`);

    return {
        deleted: true,
        shared_transaction_id,
        deleted_transactions: [sharedTx.transaction_id_user1, sharedTx.transaction_id_user2]
    };
}

export default {
    createSharedTransaction,
    getSharedTransactions,
    getSharedTransactionDetails,
    hasActiveRelationship,
    getSplitInfo,
    deleteSharedTransaction
};
