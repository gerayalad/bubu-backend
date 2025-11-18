/**
 * BUBU - Context Manager
 * Gestiona el contexto temporal de conversaciones para mensajes interactivos
 */

// Almacenamiento en memoria para contextos de usuario
// En producción, considerar usar Redis para persistencia
const userContexts = new Map();

// TTL para contextos (5 minutos)
const CONTEXT_TTL = 5 * 60 * 1000;

/**
 * Guarda las transacciones mostradas a un usuario
 */
export function saveTransactionContext(userPhone, transactions) {
    userContexts.set(userPhone, {
        transactions,
        timestamp: Date.now(),
        type: 'transaction_list'
    });

    console.log(`📝 Contexto guardado para ${userPhone}: ${transactions.length} transacciones`);
}

/**
 * Recupera el contexto de transacciones de un usuario
 */
export function getTransactionContext(userPhone) {
    const context = userContexts.get(userPhone);

    if (!context) {
        console.log(`⚠️ No hay contexto para ${userPhone}`);
        return null;
    }

    // Verificar si el contexto expiró
    const age = Date.now() - context.timestamp;
    if (age > CONTEXT_TTL) {
        console.log(`⏰ Contexto expirado para ${userPhone} (${Math.round(age/1000)}s)`);
        userContexts.delete(userPhone);
        return null;
    }

    return context.transactions;
}

/**
 * Guarda el estado de un flujo de edición
 */
export function saveEditingContext(userPhone, transaction) {
    userContexts.set(userPhone, {
        type: 'editing',
        transaction,
        timestamp: Date.now()
    });

    console.log(`✏️ Modo edición activado para ${userPhone} - transacción #${transaction.id}`);
}

/**
 * Recupera el contexto de edición
 */
export function getEditingContext(userPhone) {
    const context = userContexts.get(userPhone);

    if (!context || context.type !== 'editing') {
        return null;
    }

    // Verificar si el contexto expiró
    const age = Date.now() - context.timestamp;
    if (age > CONTEXT_TTL) {
        console.log(`⏰ Contexto de edición expirado para ${userPhone}`);
        userContexts.delete(userPhone);
        return null;
    }

    return context.transaction;
}

/**
 * Guarda el estado de un flujo de eliminación pendiente
 */
export function saveDeletionContext(userPhone, transaction) {
    userContexts.set(userPhone, {
        type: 'deleting',
        transaction,
        timestamp: Date.now()
    });

    console.log(`🗑️ Confirmación de eliminación pendiente para ${userPhone} - transacción #${transaction.id}`);
}

/**
 * Recupera el contexto de eliminación
 */
export function getDeletionContext(userPhone) {
    const context = userContexts.get(userPhone);

    if (!context || context.type !== 'deleting') {
        return null;
    }

    // Verificar si el contexto expiró
    const age = Date.now() - context.timestamp;
    if (age > CONTEXT_TTL) {
        console.log(`⏰ Contexto de eliminación expirado para ${userPhone}`);
        userContexts.delete(userPhone);
        return null;
    }

    return context.transaction;
}

/**
 * Limpia el contexto de un usuario
 */
export function clearContext(userPhone) {
    const hadContext = userContexts.has(userPhone);
    userContexts.delete(userPhone);

    if (hadContext) {
        console.log(`🧹 Contexto limpiado para ${userPhone}`);
    }

    return hadContext;
}

/**
 * Obtiene el tipo de contexto actual
 */
export function getContextType(userPhone) {
    const context = userContexts.get(userPhone);
    return context ? context.type : null;
}

/**
 * Limpieza automática de contextos expirados (ejecutar periódicamente)
 */
export function cleanExpiredContexts() {
    const now = Date.now();
    let cleaned = 0;

    for (const [phone, context] of userContexts.entries()) {
        const age = now - context.timestamp;
        if (age > CONTEXT_TTL) {
            userContexts.delete(phone);
            cleaned++;
        }
    }

    if (cleaned > 0) {
        console.log(`🧹 Limpiados ${cleaned} contextos expirados`);
    }

    return cleaned;
}

// Ejecutar limpieza cada 10 minutos
setInterval(cleanExpiredContexts, 10 * 60 * 1000);

/**
 * Busca una transacción por su número en el contexto del usuario
 */
export function getTransactionByNumber(userPhone, number) {
    const transactions = getTransactionContext(userPhone);

    if (!transactions) {
        return null;
    }

    // Los números mostrados al usuario empiezan en 1
    const index = number - 1;

    if (index < 0 || index >= transactions.length) {
        console.log(`⚠️ Número de transacción inválido: ${number} (rango: 1-${transactions.length})`);
        return null;
    }

    return transactions[index];
}

/**
 * Busca una transacción por su ID en el contexto del usuario
 */
export function getTransactionById(userPhone, transactionId) {
    const transactions = getTransactionContext(userPhone);

    if (!transactions) {
        return null;
    }

    const transaction = transactions.find(t => t.id === transactionId);

    if (!transaction) {
        console.log(`⚠️ Transacción #${transactionId} no encontrada en contexto de ${userPhone}`);
    }

    return transaction || null;
}
