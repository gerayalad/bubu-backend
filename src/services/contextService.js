/**
 * BUBU - Context Service
 * Mantiene contexto de la conversación (última lista de transacciones, etc.)
 */

// Cache en memoria para guardar contexto por usuario
// En producción esto debería estar en Redis o similar
const userContext = new Map();

/**
 * Guarda la última lista de transacciones mostrada al usuario
 * @param {string} userPhone - Teléfono del usuario
 * @param {Array} transactions - Lista de transacciones
 */
export function saveTransactionList(userPhone, transactions) {
    userContext.set(userPhone, {
        transactions,
        timestamp: new Date()
    });
}

/**
 * Obtiene una transacción específica de la última lista por su número
 * @param {string} userPhone - Teléfono del usuario
 * @param {number} numero - Número de la transacción (1-based)
 * @returns {object|null} Transacción o null si no existe
 */
export function getTransactionByNumber(userPhone, numero) {
    const context = userContext.get(userPhone);

    if (!context || !context.transactions) {
        return null;
    }

    // Verificar que el contexto no sea muy viejo (más de 30 minutos)
    const now = new Date();
    const diff = now - context.timestamp;
    const minutes = diff / 1000 / 60;

    if (minutes > 30) {
        // Contexto expirado
        userContext.delete(userPhone);
        return null;
    }

    // Los números son 1-based, pero el array es 0-based
    const index = numero - 1;

    if (index < 0 || index >= context.transactions.length) {
        return null;
    }

    return context.transactions[index];
}

/**
 * Limpia el contexto de un usuario
 * @param {string} userPhone - Teléfono del usuario
 */
export function clearContext(userPhone) {
    userContext.delete(userPhone);
}

/**
 * Obtiene toda la lista de transacciones del contexto
 * @param {string} userPhone - Teléfono del usuario
 * @returns {Array|null} Lista de transacciones o null
 */
export function getTransactionList(userPhone) {
    const context = userContext.get(userPhone);
    return context ? context.transactions : null;
}

/**
 * Guarda un receipt pendiente de confirmación
 * @param {string} userPhone - Teléfono del usuario
 * @param {object} receiptData - Datos del receipt pendiente
 */
export function savePendingReceipt(userPhone, receiptData) {
    const context = userContext.get(userPhone) || {};
    context.pendingReceipt = {
        ...receiptData,
        timestamp: new Date()
    };
    userContext.set(userPhone, context);
}

/**
 * Obtiene el receipt pendiente de confirmación
 * @param {string} userPhone - Teléfono del usuario
 * @returns {object|null} Receipt pendiente o null
 */
export function getPendingReceipt(userPhone) {
    const context = userContext.get(userPhone);

    if (!context || !context.pendingReceipt) {
        return null;
    }

    // Verificar que el contexto no sea muy viejo (más de 10 minutos)
    const now = new Date();
    const diff = now - context.pendingReceipt.timestamp;
    const minutes = diff / 1000 / 60;

    if (minutes > 10) {
        // Contexto expirado
        delete context.pendingReceipt;
        return null;
    }

    return context.pendingReceipt;
}

/**
 * Limpia el receipt pendiente de confirmación
 * @param {string} userPhone - Teléfono del usuario
 */
export function clearPendingReceipt(userPhone) {
    const context = userContext.get(userPhone);
    if (context) {
        delete context.pendingReceipt;
    }
}

export default {
    saveTransactionList,
    getTransactionByNumber,
    clearContext,
    getTransactionList,
    savePendingReceipt,
    getPendingReceipt,
    clearPendingReceipt
};
