/**
 * BUBU - Date Utilities
 * Utilidades para manejo de fechas en zona horaria de México
 */

/**
 * Obtiene la fecha actual en zona horaria de Ciudad de México (America/Mexico_City)
 * @returns {string} Fecha en formato YYYY-MM-DD
 */
export function getTodayMexico() {
    const now = new Date();
    // Convertir a zona horaria de México (America/Mexico_City)
    const mexicoTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Mexico_City' }));

    const year = mexicoTime.getFullYear();
    const month = String(mexicoTime.getMonth() + 1).padStart(2, '0');
    const day = String(mexicoTime.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}

/**
 * Convierte una fecha a formato YYYY-MM-DD en zona horaria de México
 * @param {Date} date - Objeto Date
 * @returns {string} Fecha en formato YYYY-MM-DD
 */
export function toMexicoDateString(date) {
    const mexicoTime = new Date(date.toLocaleString('en-US', { timeZone: 'America/Mexico_City' }));

    const year = mexicoTime.getFullYear();
    const month = String(mexicoTime.getMonth() + 1).padStart(2, '0');
    const day = String(mexicoTime.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}

/**
 * Obtiene la fecha y hora actual en zona horaria de México
 * @returns {Date} Objeto Date ajustado a zona horaria de México
 */
export function getNowMexico() {
    const now = new Date();
    return new Date(now.toLocaleString('en-US', { timeZone: 'America/Mexico_City' }));
}

/**
 * Obtiene el primer día del mes actual en México
 * @returns {string} Fecha en formato YYYY-MM-DD
 */
export function getStartOfMonthMexico() {
    const now = getNowMexico();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');

    return `${year}-${month}-01`;
}

/**
 * Obtiene el último día del mes actual en México
 * @returns {string} Fecha en formato YYYY-MM-DD
 */
export function getEndOfMonthMexico() {
    const now = getNowMexico();
    const year = now.getFullYear();
    const month = now.getMonth();

    // Último día del mes = día 0 del mes siguiente
    const lastDay = new Date(year, month + 1, 0);
    const mexicoLastDay = new Date(lastDay.toLocaleString('en-US', { timeZone: 'America/Mexico_City' }));

    const endYear = mexicoLastDay.getFullYear();
    const endMonth = String(mexicoLastDay.getMonth() + 1).padStart(2, '0');
    const endDay = String(mexicoLastDay.getDate()).padStart(2, '0');

    return `${endYear}-${endMonth}-${endDay}`;
}

/**
 * Obtiene timestamp ISO con zona horaria de México
 * CORREGIDO: Calcula el offset real de México, no del servidor
 * @returns {string} Timestamp ISO con offset de México (YYYY-MM-DDTHH:MM:SS-06:00 o -05:00)
 */
export function getISOTimestampMexico() {
    const now = new Date();

    // Obtener la fecha/hora en México
    const mexicoTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Mexico_City' }));

    // Calcular el offset REAL de México comparando con UTC
    // México está en CST (UTC-6) o CDT (UTC-5) según horario de verano
    const utcTime = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
    const offsetMinutes = (utcTime.getTime() - mexicoTime.getTime()) / (1000 * 60);
    const offsetHours = Math.floor(Math.abs(offsetMinutes) / 60);
    const offsetMins = Math.abs(offsetMinutes) % 60;

    // Formato del offset: -06:00 o -05:00
    const offsetStr = offsetMinutes >= 0
        ? `+${String(offsetHours).padStart(2, '0')}:${String(offsetMins).padStart(2, '0')}`
        : `-${String(offsetHours).padStart(2, '0')}:${String(offsetMins).padStart(2, '0')}`;

    const year = mexicoTime.getFullYear();
    const month = String(mexicoTime.getMonth() + 1).padStart(2, '0');
    const day = String(mexicoTime.getDate()).padStart(2, '0');
    const hours = String(mexicoTime.getHours()).padStart(2, '0');
    const minutes = String(mexicoTime.getMinutes()).padStart(2, '0');
    const seconds = String(mexicoTime.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${offsetStr}`;
}

/**
 * Obtiene timestamp actual en formato PostgreSQL compatible
 * Retorna fecha/hora de México en formato que PostgreSQL puede interpretar correctamente
 * @returns {string} Timestamp en formato 'YYYY-MM-DD HH:MM:SS'
 */
export function getTimestampMexicoForDB() {
    const mexicoTime = getNowMexico();

    const year = mexicoTime.getFullYear();
    const month = String(mexicoTime.getMonth() + 1).padStart(2, '0');
    const day = String(mexicoTime.getDate()).padStart(2, '0');
    const hours = String(mexicoTime.getHours()).padStart(2, '0');
    const minutes = String(mexicoTime.getMinutes()).padStart(2, '0');
    const seconds = String(mexicoTime.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * Formatea un Date object a timestamp para insertar en BD (zona México)
 * @param {Date} date - Objeto Date a formatear
 * @returns {string} Timestamp en formato 'YYYY-MM-DD HH:MM:SS'
 */
export function formatTimestampForDB(date) {
    const mexicoTime = new Date(date.toLocaleString('en-US', { timeZone: 'America/Mexico_City' }));

    const year = mexicoTime.getFullYear();
    const month = String(mexicoTime.getMonth() + 1).padStart(2, '0');
    const day = String(mexicoTime.getDate()).padStart(2, '0');
    const hours = String(mexicoTime.getHours()).padStart(2, '0');
    const minutes = String(mexicoTime.getMinutes()).padStart(2, '0');
    const seconds = String(mexicoTime.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

export default {
    getTodayMexico,
    toMexicoDateString,
    getNowMexico,
    getStartOfMonthMexico,
    getEndOfMonthMexico,
    getISOTimestampMexico,
    getTimestampMexicoForDB,
    formatTimestampForDB
};
