/**
 * BUBU - Tutorial Service
 * Mensajes de bienvenida y ayuda para usuarios nuevos
 */

import { getAllCategories } from './categoryService.js';

/**
 * Genera el mensaje de tutorial para usuarios nuevos
 * @returns {string} Mensaje de bienvenida completo
 */
export async function getTutorialMessage() {
    const categories = await getAllCategories();

    // Solo categorías de gastos
    const expenseCategories = categories
        .filter(c => c.type === 'expense')
        .map(c => c.name)
        .join(', ');

    return `¡Bienvenido a BUBU! 🤖💰

Soy tu asistente para rastrear gastos. Puedo ayudarte a:

📊 *REGISTRAR GASTOS:*
• "Gasté 350 en tacos"
• "Pagué 1200 de luz"
• "Ayer compré ropa por 800"

📈 *CONSULTAR ESTADO:*
• "¿Cómo voy este mes?"
• "¿Cuánto he gastado?"
• "Gastos del mes pasado"

📋 *VER GASTOS:*
• "¿Qué gastos tengo en comida?"
• "Muestra mis servicios"

✏️ *GESTIONAR:*
Después de ver una lista, puedes:
• "Elimina el 1"
• "Cambia el 2 a $600"

👫 *GASTOS COMPARTIDOS:*
Comparte gastos con tu pareja o roommate:
• "Registra a mi pareja con el número 5512345678"
• "Gasté 200 en comida, pagué yo" (gasto compartido)
• "Mi pareja pagó 150 en uber"
• "Gasté 300 en super, pagué yo 50/50" (división custom)
• "¿Cómo va el balance?"
• "Lista gastos compartidos"
• "Cambia la división a 65/35"

🏷️ *CATEGORÍAS DISPONIBLES:*
${expenseCategories}

✨ *GESTIONAR CATEGORÍAS PERSONALIZADAS:*
• "Crea una categoría llamada Mascotas"
• "Crea categoría Gimnasio"
• "Cambia el nombre de la categoría AI Tools a HappyToHelp"
• "Elimina la categoría Mascotas"
• "Mueve todos los gastos de Entretenimiento a Casino"
• "¿Qué categorías personalizadas tengo?"

El asistente elegirá automáticamente el icono. Si la categoría destino no existe, se creará automáticamente.

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
• "Crea categoría Mascotas de gastos"
• "Cambia el nombre de AI Tools a HappyToHelp"
• "Mueve todos los gastos de Entretenimiento a Casino"

👫 *Gastos compartidos:*
• "Registra a mi pareja con el número 5512345678"
• "Gasté 200 en comida, pagué yo"
• "¿Cómo va el balance?"

¿Necesitas más ayuda? Escribe "tutorial" para ver la guía completa.`;
}

export default {
    getTutorialMessage,
    getHelpMessage
};
