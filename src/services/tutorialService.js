/**
 * BUBU - Tutorial Service
 * Mensajes de bienvenida y ayuda para usuarios nuevos
 */

import { getAllCategories } from './categoryService.js';

/**
 * Genera el mensaje de tutorial para usuarios nuevos
 * @returns {string} Mensaje de bienvenida completo
 */
export function getTutorialMessage() {
    const categories = getAllCategories();

    // Separar categorías por tipo
    const expenseCategories = categories
        .filter(c => c.type === 'expense')
        .map(c => c.name)
        .join(', ');

    const incomeCategories = categories
        .filter(c => c.type === 'income')
        .map(c => c.name)
        .join(', ');

    return `¡Bienvenido a BUBU! 🤖💰

Soy tu asistente de finanzas personales. Puedo ayudarte a:

📊 *REGISTRAR GASTOS:*
• "Gasté 350 en tacos"
• "Pagué 1200 de luz"
• "Ayer compré ropa por 800"

💰 *REGISTRAR INGRESOS:*
• "Me pagaron 15000 de nómina"
• "Vendí algo por 3500"

📈 *CONSULTAR ESTADO:*
• "¿Cómo voy este mes?"
• "¿Cuánto he gastado?"
• "Gastos del mes pasado"

📋 *VER TRANSACCIONES:*
• "¿Qué gastos tengo en comida?"
• "Muestra mis servicios"

✏️ *GESTIONAR:*
Después de ver una lista, puedes:
• "Elimina el 1"
• "Cambia el 2 a $600"

🏷️ *CATEGORÍAS DE GASTOS:*
${expenseCategories}

💵 *CATEGORÍAS DE INGRESOS:*
${incomeCategories}

✨ ¡Prueba ahora! Dime algo como: "Gasté 100 en café" 😊`;
}

/**
 * Genera un mensaje de ayuda rápido
 * @returns {string} Mensaje de ayuda
 */
export function getHelpMessage() {
    return `💡 *AYUDA RÁPIDA*

Puedes decirme cosas como:
• "Gasté 350 en tacos"
• "¿Cómo voy este mes?"
• "Muestra mis gastos en comida"
• "Elimina el 1"

¿Necesitas más ayuda? Escribe "tutorial" para ver la guía completa.`;
}

export default {
    getTutorialMessage,
    getHelpMessage
};
