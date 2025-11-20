/**
 * BUBU - Audio Transcription Service
 * Servicio para transcribir audios usando OpenAI Whisper API
 */

import { openai } from '../config/openai.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Transcribe un audio usando OpenAI Whisper API
 * @param {Buffer} audioBuffer - Buffer del archivo de audio
 * @param {string} mimeType - Tipo MIME del audio (audio/ogg, audio/mpeg, etc.)
 * @returns {object} Resultado de la transcripción
 */
export async function transcribeAudio(audioBuffer, mimeType) {
    try {
        console.log(`🎙️ Iniciando transcripción de audio (${mimeType})...`);

        // Whisper requiere un archivo, crear temporal en /tmp
        const tempDir = '/tmp';

        // Determinar extensión según MIME type
        let extension = '.mp3';
        if (mimeType.includes('ogg')) extension = '.ogg';
        else if (mimeType.includes('mp4')) extension = '.mp4';
        else if (mimeType.includes('mpeg')) extension = '.mp3';
        else if (mimeType.includes('wav')) extension = '.wav';
        else if (mimeType.includes('webm')) extension = '.webm';

        const tempFilePath = path.join(tempDir, `audio_${Date.now()}${extension}`);

        // Guardar buffer a archivo temporal
        fs.writeFileSync(tempFilePath, audioBuffer);
        console.log(`📁 Audio guardado temporalmente en: ${tempFilePath}`);

        // Transcribir con Whisper
        console.log('🔊 Enviando a Whisper API...');
        const transcription = await openai.audio.transcriptions.create({
            file: fs.createReadStream(tempFilePath),
            model: 'whisper-1',
            language: 'es', // Español
            response_format: 'text',
            temperature: 0.2 // Menor temperatura = más preciso
        });

        // Eliminar archivo temporal
        fs.unlinkSync(tempFilePath);
        console.log(`✅ Audio transcrito: "${transcription}"`);

        return {
            success: true,
            text: transcription.trim(),
            confidence: 'high',
            language: 'es'
        };

    } catch (error) {
        console.error('❌ Error transcribiendo audio:', error);

        // Limpiar archivo temporal si existe
        try {
            if (fs.existsSync(tempFilePath)) {
                fs.unlinkSync(tempFilePath);
            }
        } catch (cleanupError) {
            // Ignorar error de limpieza
        }

        return {
            success: false,
            error: error.message,
            text: null
        };
    }
}

/**
 * Valida si el formato de audio es soportado por Whisper
 * @param {string} mimeType - Tipo MIME del audio
 * @returns {boolean} true si es soportado
 */
export function isSupportedAudioFormat(mimeType) {
    const supportedFormats = [
        'audio/mpeg',
        'audio/mp3',
        'audio/mp4',
        'audio/m4a',
        'audio/wav',
        'audio/webm',
        'audio/ogg',
        'audio/opus'
    ];

    return supportedFormats.some(format => mimeType.includes(format));
}

export default {
    transcribeAudio,
    isSupportedAudioFormat
};
