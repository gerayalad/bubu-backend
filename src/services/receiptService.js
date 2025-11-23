/**
 * BUBU - Receipt Service
 * Servicio para gestionar metadata de imágenes de tickets procesados por OCR
 */

import { execute, queryOne, query } from '../db/connection.js';

/**
 * Guarda la metadata de una imagen de ticket procesada
 * @param {Object} data - Datos del receipt
 * @returns {Promise<Object>} - Receipt guardado
 */
export async function saveReceiptImage(data) {
    const {
        user_phone,
        whatsapp_media_id,
        media_url,
        ocr_result,
        transaction_id,
        status
    } = data;

    try {
        const result = await execute(
            `INSERT INTO receipt_images (
                user_phone,
                whatsapp_media_id,
                media_url,
                ocr_result,
                transaction_id,
                status
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *`,
            [
                user_phone,
                whatsapp_media_id || null,
                media_url || null,
                ocr_result || null,  // PostgreSQL JSONB maneja el JSON automáticamente
                transaction_id || null,
                status || 'pending'
            ]
        );

        const saved = result.rows[0];
        // PostgreSQL JSONB ya devuelve el objeto parseado, no necesitamos JSON.parse

        console.log(`✅ Receipt guardado con ID: ${saved.id}`);
        return saved;

    } catch (error) {
        console.error('❌ Error guardando receipt:', error);
        throw error;
    }
}

/**
 * Obtiene un receipt por su Media ID de WhatsApp
 * @param {string} mediaId - ID del media en WhatsApp
 * @returns {Promise<Object|null>} - Receipt encontrado o null
 */
export async function getReceiptByMediaId(mediaId) {
    try {
        const receipt = await queryOne(
            'SELECT * FROM receipt_images WHERE whatsapp_media_id = $1',
            [mediaId]
        );

        // PostgreSQL JSONB ya devuelve el objeto parseado
        return receipt;

    } catch (error) {
        console.error('❌ Error obteniendo receipt por media ID:', error);
        throw error;
    }
}

/**
 * Obtiene los receipts de un usuario
 * @param {string} userPhone - Teléfono del usuario
 * @param {number} limit - Límite de resultados
 * @returns {Promise<Array>} - Lista de receipts
 */
export async function getUserReceipts(userPhone, limit = 10) {
    try {
        const receipts = await query(
            `SELECT * FROM receipt_images
             WHERE user_phone = $1
             ORDER BY created_at DESC
             LIMIT $2`,
            [userPhone, limit]
        );

        // PostgreSQL JSONB ya devuelve los objetos parseados
        return receipts;

    } catch (error) {
        console.error('❌ Error obteniendo receipts del usuario:', error);
        throw error;
    }
}

/**
 * Actualiza el estado de un receipt
 * @param {number} receiptId - ID del receipt
 * @param {string} status - Nuevo estado
 * @param {number} transactionId - ID de transacción (opcional)
 * @returns {Promise<Object>} - Receipt actualizado
 */
export async function updateReceiptStatus(receiptId, status, transactionId = null) {
    try {
        const result = await execute(
            `UPDATE receipt_images
             SET status = $1, transaction_id = $2
             WHERE id = $3
             RETURNING *`,
            [status, transactionId, receiptId]
        );

        const updated = result.rows[0];
        // PostgreSQL JSONB ya devuelve el objeto parseado

        console.log(`✅ Receipt ${receiptId} actualizado a estado: ${status}`);
        return updated;

    } catch (error) {
        console.error('❌ Error actualizando receipt:', error);
        throw error;
    }
}

/**
 * Obtiene estadísticas de receipts procesados
 * @param {string} userPhone - Teléfono del usuario
 * @returns {Promise<Object>} - Estadísticas
 */
export async function getReceiptStats(userPhone) {
    try {
        const stats = await queryOne(
            `SELECT
                COUNT(*) as total,
                COUNT(CASE WHEN status = 'processed' THEN 1 END) as processed,
                COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
                COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed
             FROM receipt_images
             WHERE user_phone = $1`,
            [userPhone]
        );

        return {
            total: parseInt(stats.total) || 0,
            processed: parseInt(stats.processed) || 0,
            pending: parseInt(stats.pending) || 0,
            failed: parseInt(stats.failed) || 0
        };

    } catch (error) {
        console.error('❌ Error obteniendo estadísticas de receipts:', error);
        throw error;
    }
}

export default {
    saveReceiptImage,
    getReceiptByMediaId,
    getUserReceipts,
    updateReceiptStatus,
    getReceiptStats
};
