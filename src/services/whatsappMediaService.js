/**
 * BUBU - WhatsApp Media Service
 * Servicio para descargar y procesar medios de WhatsApp
 */

import axios from 'axios';

/**
 * Descarga una imagen de WhatsApp usando el Media ID
 * @param {string} mediaId - ID del media en WhatsApp
 * @returns {Promise<Object>} - Objeto con buffer, mimeType y base64
 */
export async function downloadWhatsAppMedia(mediaId) {
    try {
        const accessToken = process.env.WHATSAPP_TOKEN;

        if (!accessToken) {
            throw new Error('WHATSAPP_TOKEN no configurado');
        }

        // Paso 1: Obtener URL de la imagen
        const mediaInfoUrl = `https://graph.facebook.com/v18.0/${mediaId}`;
        console.log(`📥 Obteniendo info de media: ${mediaId}`);

        const mediaInfo = await axios.get(mediaInfoUrl, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        const mediaUrl = mediaInfo.data.url;
        console.log(`📥 URL de media obtenida: ${mediaUrl.substring(0, 50)}...`);

        // Paso 2: Descargar la imagen
        const response = await axios.get(mediaUrl, {
            headers: { 'Authorization': `Bearer ${accessToken}` },
            responseType: 'arraybuffer',
            timeout: 30000 // 30 segundos de timeout
        });

        const buffer = Buffer.from(response.data);
        const base64 = buffer.toString('base64');

        console.log(`✅ Media descargado: ${(buffer.length / 1024).toFixed(2)} KB`);

        return {
            buffer,
            mimeType: response.headers['content-type'] || 'image/jpeg',
            base64,
            size: buffer.length,
            url: mediaUrl
        };

    } catch (error) {
        console.error('❌ Error descargando media de WhatsApp:', error.message);

        if (error.response) {
            console.error('Response error:', error.response.data);
            throw new Error(`Error de WhatsApp API: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
        }

        throw error;
    }
}

export default {
    downloadWhatsAppMedia
};
