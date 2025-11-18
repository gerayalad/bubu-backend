/**
 * BUBU - OpenAI Service
 * Servicio para interpretar mensajes de usuario usando OpenAI
 */

import openai from '../config/openai.js';
import { getAllCategories } from './categoryService.js';

/**
 * Define las funciones que OpenAI puede invocar
 * Estas funciones representan las acciones que el usuario puede solicitar
 */
function getOpenAIFunctions() {
    const categories = getAllCategories();

    return [
        {
            name: 'registrar_transaccion',
            description: 'Registra un gasto o ingreso del usuario. Usa esta función cuando el usuario mencione que gastó dinero, pagó algo, recibió dinero, le pagaron, etc.',
            parameters: {
                type: 'object',
                properties: {
                    tipo: {
                        type: 'string',
                        enum: ['gasto', 'ingreso'],
                        description: 'Tipo de transacción: "gasto" si es un egreso, "ingreso" si es dinero recibido'
                    },
                    monto: {
                        type: 'number',
                        description: 'Monto de la transacción en pesos mexicanos (solo número, sin símbolo de moneda)'
                    },
                    descripcion: {
                        type: 'string',
                        description: 'Descripción breve de la transacción según lo que dijo el usuario'
                    },
                    categoria: {
                        type: 'string',
                        description: 'Nombre de la categoría más apropiada para esta transacción',
                        enum: categories.map(c => c.name)
                    },
                    fecha: {
                        type: 'string',
                        description: 'Fecha de la transacción en formato YYYY-MM-DD. Si el usuario dice "ayer", "hoy", "antier", etc., calcula la fecha correcta. Si no se especifica, usa la fecha actual.'
                    }
                },
                required: ['tipo', 'monto', 'descripcion', 'categoria']
            }
        },
        {
            name: 'consultar_estado',
            description: 'Consulta el estado financiero del usuario. Usa esta función cuando el usuario pregunte cómo va, cuál es su estado, cuánto ha gastado, cuánto ha ganado, etc.',
            parameters: {
                type: 'object',
                properties: {
                    periodo: {
                        type: 'string',
                        enum: ['mes_actual', 'mes_pasado', 'semana_actual', 'hoy', 'personalizado'],
                        description: 'Periodo de consulta. "mes_actual" para el mes en curso, "mes_pasado" para el mes anterior, etc.'
                    },
                    fecha_inicio: {
                        type: 'string',
                        description: 'Fecha de inicio en formato YYYY-MM-DD (solo si periodo es "personalizado")'
                    },
                    fecha_fin: {
                        type: 'string',
                        description: 'Fecha de fin en formato YYYY-MM-DD (solo si periodo es "personalizado")'
                    },
                    filtro_categoria: {
                        type: 'string',
                        description: 'Nombre de categoría específica si el usuario pregunta por una categoría en particular',
                        enum: [...categories.map(c => c.name), null]
                    },
                    filtro_tipo: {
                        type: 'string',
                        enum: ['gasto', 'ingreso', null],
                        description: 'Filtrar solo gastos o solo ingresos. null para ambos'
                    }
                },
                required: ['periodo']
            }
        },
        {
            name: 'listar_transacciones',
            description: 'Lista transacciones específicas del usuario. Usa esta cuando pregunte "qué gastos tengo", "muestra mis gastos en comida", "ver transacciones de transporte del mes pasado", "qué servicios tengo registrados", etc. IMPORTANTE: usa esta función cuando el usuario quiera VER LA LISTA DETALLADA de transacciones, no solo un resumen.',
            parameters: {
                type: 'object',
                properties: {
                    categoria: {
                        type: 'string',
                        description: 'Categoría específica a listar',
                        enum: [...categories.map(c => c.name), null]
                    },
                    tipo: {
                        type: 'string',
                        enum: ['gasto', 'ingreso', 'todos'],
                        description: 'Filtrar por tipo de transacción'
                    },
                    periodo: {
                        type: 'string',
                        enum: ['mes_actual', 'mes_pasado', 'semana_actual', 'hoy', 'personalizado', 'todos'],
                        description: 'Periodo temporal para filtrar. "todos" muestra todas las transacciones sin filtro de fecha.'
                    },
                    fecha_inicio: {
                        type: 'string',
                        description: 'Fecha de inicio en formato YYYY-MM-DD (solo si periodo es "personalizado")'
                    },
                    fecha_fin: {
                        type: 'string',
                        description: 'Fecha de fin en formato YYYY-MM-DD (solo si periodo es "personalizado")'
                    },
                    limite: {
                        type: 'number',
                        description: 'Número de transacciones a mostrar (por defecto 20)',
                        default: 20
                    }
                }
            }
        },
        {
            name: 'eliminar_transaccion',
            description: 'Elimina una transacción específica. Usa esta cuando el usuario pida eliminar una transacción. Ejemplos: "elimina el 1", "borra el 2", "elimina el gasto de comida", "borra el último", "elimina ese gasto". Si no mencionan un número específico pero hay contexto de una lista reciente, infiere el número basado en lo que piden eliminar.',
            parameters: {
                type: 'object',
                properties: {
                    numero: {
                        type: 'number',
                        description: 'Número de la transacción a eliminar (según la lista mostrada previamente). Si el usuario no menciona un número pero acaba de ver una lista, infiere cuál quiere eliminar. Si solo hay 1 transacción en la lista reciente y pide eliminar, usa numero: 1.'
                    }
                },
                required: ['numero']
            }
        },
        {
            name: 'editar_transaccion',
            description: 'Edita el monto de una transacción. Usa esta cuando diga "cambia el 1 a 500", "edita el 2 a $600", "modifica la transacción 3 a 1000", etc.',
            parameters: {
                type: 'object',
                properties: {
                    numero: {
                        type: 'number',
                        description: 'Número de la transacción a editar'
                    },
                    nuevo_monto: {
                        type: 'number',
                        description: 'Nuevo monto para la transacción'
                    }
                },
                required: ['numero', 'nuevo_monto']
            }
        },
        {
            name: 'conversacion_general',
            description: 'Para saludos, agradecimientos, despedidas o conversación casual que no requiere acción específica',
            parameters: {
                type: 'object',
                properties: {
                    tipo_mensaje: {
                        type: 'string',
                        enum: ['saludo', 'despedida', 'agradecimiento', 'otro'],
                        description: 'Tipo de mensaje casual'
                    }
                },
                required: ['tipo_mensaje']
            }
        }
    ];
}

/**
 * Calcula fechas relativas (ayer, hoy, etc.)
 * @param {string} referencia - Referencia temporal (hoy, ayer, etc.)
 * @returns {string} Fecha en formato YYYY-MM-DD
 */
function calcularFechaRelativa(referencia) {
    const hoy = new Date();

    switch (referencia?.toLowerCase()) {
        case 'ayer':
            hoy.setDate(hoy.getDate() - 1);
            break;
        case 'antier':
        case 'anteayer':
            hoy.setDate(hoy.getDate() - 2);
            break;
        case 'mañana':
            hoy.setDate(hoy.getDate() + 1);
            break;
        default:
            // hoy
            break;
    }

    return hoy.toISOString().split('T')[0];
}

/**
 * Parsea un mensaje de usuario usando OpenAI
 * @param {string} mensaje - Mensaje del usuario
 * @param {string} userPhone - Teléfono del usuario (para contexto)
 * @returns {object} Intent parseado con la función y argumentos
 */
export async function parseIntent(mensaje, userPhone = null) {
    try {
        const functions = getOpenAIFunctions();
        const today = new Date().toISOString().split('T')[0];

        const systemPrompt = `Eres un asistente de finanzas personales llamado BUBU.
Tu trabajo es interpretar los mensajes del usuario y determinar qué acción quiere realizar.

Fecha actual: ${today}

IMPORTANTE - Interpretación de periodos temporales:
- "este mes", "mes actual", "en lo que va del mes", "cuánto llevo gastado" → periodo: mes_actual
- "mes pasado", "el mes pasado", "mes anterior", "mes que pasó" → periodo: mes_pasado
- "esta semana", "en la semana", "semana actual" → periodo: semana_actual
- "hoy", "el día de hoy", "día actual" → periodo: hoy
- Fechas específicas o rangos → periodo: personalizado (con fecha_inicio y fecha_fin)

Cuando el usuario mencione fechas relativas (ayer, hoy, antier, etc.), calcula la fecha exacta en formato YYYY-MM-DD.

Ejemplos de interpretación:

REGISTRAR TRANSACCIONES:
- "gasté 350 en tacos" → registrar_transaccion (tipo: gasto, monto: 350, categoria: Comida)
- "ayer pagué 200 de uber" → registrar_transaccion (tipo: gasto, monto: 200, categoria: Transporte, fecha: ayer)
- "me cayó la nómina de 15000" → registrar_transaccion (tipo: ingreso, monto: 15000, categoria: Nómina)

CONSULTAR ESTADO - MES ACTUAL:
- "¿cómo voy este mes?" → consultar_estado (periodo: mes_actual)
- "¿cuánto llevo gastado?" → consultar_estado (periodo: mes_actual, filtro_tipo: gasto)
- "¿cuánto he gastado en comida?" → consultar_estado (periodo: mes_actual, filtro_categoria: Comida, filtro_tipo: gasto)
- "¿cuál es mi estado actual?" → consultar_estado (periodo: mes_actual)

CONSULTAR ESTADO - MES PASADO:
- "¿cómo me fue el mes pasado?" → consultar_estado (periodo: mes_pasado)
- "¿cuánto gasté el mes anterior?" → consultar_estado (periodo: mes_pasado, filtro_tipo: gasto)
- "gastos del mes pasado" → consultar_estado (periodo: mes_pasado, filtro_tipo: gasto)
- "quiero saber mis gastos del mes pasado" → consultar_estado (periodo: mes_pasado, filtro_tipo: gasto)
- "gastos en comida del mes que pasó" → consultar_estado (periodo: mes_pasado, filtro_categoria: Comida, filtro_tipo: gasto)

CONSULTAR ESTADO - OTROS PERIODOS:
- "¿cómo voy esta semana?" → consultar_estado (periodo: semana_actual)
- "gastos de hoy" → consultar_estado (periodo: hoy, filtro_tipo: gasto)
- "¿cuánto gané esta semana?" → consultar_estado (periodo: semana_actual, filtro_tipo: ingreso)

LISTAR TRANSACCIONES DETALLE (cuando quieren VER la lista específica):
- "¿qué servicios tengo registrados?" → listar_transacciones (categoria: Servicios, tipo: gasto, periodo: todos)
- "muestra mis gastos en comida" → listar_transacciones (categoria: Comida, tipo: gasto, periodo: todos)
- "ver mis gastos de transporte" → listar_transacciones (categoria: Transporte, tipo: gasto, periodo: todos)
- "lista mis ingresos" → listar_transacciones (tipo: ingreso, periodo: todos)
- "qué gastos tengo en comida del mes pasado" → listar_transacciones (categoria: Comida, tipo: gasto, periodo: mes_pasado)
- "muestra los servicios de este mes" → listar_transacciones (categoria: Servicios, tipo: gasto, periodo: mes_actual)
- "ver transacciones de transporte de la semana" → listar_transacciones (categoria: Transporte, tipo: gasto, periodo: semana_actual)

ELIMINAR TRANSACCIONES:
- "elimina el 1" → eliminar_transaccion (numero: 1)
- "borra el 2" → eliminar_transaccion (numero: 2)
- "quita la transacción 3" → eliminar_transaccion (numero: 3)
- Si acaba de ver una lista y dice "elimina el gasto de comida" o "elimina ese gasto", infiere el número de la lista
- Si solo hay 1 transacción en la lista y dice "elimínalo", "bórralo", "elimina ese", usa numero: 1

EDITAR TRANSACCIONES:
- "cambia el 1 a 500" → editar_transaccion (numero: 1, nuevo_monto: 500)
- "edita el 2 a $600" → editar_transaccion (numero: 2, nuevo_monto: 600)
- "modifica la transacción 3 a 1000" → editar_transaccion (numero: 3, nuevo_monto: 1000)

Sé inteligente al categorizar. Si el usuario dice "tacos", "pizza", "restaurante" → categoría Comida.
Si dice "uber", "gasolina", "taxi" → categoría Transporte.`;

        const response = await openai.chat.completions.create({
            model: 'gpt-4',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: mensaje }
            ],
            functions: functions,
            function_call: 'auto',
            temperature: 0.3
        });

        const message = response.choices[0].message;

        // Si OpenAI decidió llamar a una función
        if (message.function_call) {
            const functionName = message.function_call.name;
            const args = JSON.parse(message.function_call.arguments);

            return {
                action: functionName,
                parameters: args,
                confidence: 'high',
                rawResponse: message
            };
        }

        // Si no llamó a ninguna función, es conversación general
        return {
            action: 'conversacion_general',
            parameters: { tipo_mensaje: 'otro' },
            confidence: 'medium',
            rawResponse: message
        };

    } catch (error) {
        console.error('Error al parsear intent con OpenAI:', error);
        throw new Error('No pude interpretar tu mensaje. ¿Podrías reformularlo?');
    }
}

/**
 * Genera una respuesta en lenguaje natural para el usuario
 * @param {object} data - Datos para generar la respuesta
 * @returns {string} Respuesta en texto natural
 */
export async function generateNaturalResponse(data) {
    try {
        const { action, result, userMessage } = data;

        let prompt = '';

        switch (action) {
            case 'registrar_transaccion':
                prompt = `El usuario registró una transacción: ${JSON.stringify(result)}.
Genera una confirmación breve y amigable (1-2 líneas) confirmando que se registró el ${result.type === 'expense' ? 'gasto' : 'ingreso'} de $${result.amount} en ${result.category_name}.`;
                break;

            case 'consultar_estado':
                const summary = result;

                // Mapear periodo a texto legible en español
                const periodoTexto = {
                    'mes_actual': 'este mes',
                    'mes_pasado': 'el mes pasado',
                    'semana_actual': 'esta semana',
                    'hoy': 'hoy',
                    'personalizado': `del ${summary.period.startDate} al ${summary.period.endDate}`
                };

                const periodoDescripcion = periodoTexto[summary.periodo] || 'en el periodo consultado';
                const hasData = summary.totals.income > 0 || summary.totals.expense > 0;

                if (!hasData) {
                    // Caso especial: No hay datos
                    prompt = `El usuario consultó su estado financiero de ${periodoDescripcion}, pero NO HAY DATOS registrados aún.

Genera una respuesta amigable y útil (2-3 líneas) que:
1. Mencione que aún no ha registrado movimientos en ${periodoDescripcion}
2. Lo invite a empezar a registrar
3. Le dé un ejemplo de cómo hacerlo

Ejemplo: "Aún no has registrado movimientos ${periodoDescripcion}. ¡Empecemos! Puedes decirme algo como: 'gasté 500 en comida' o 'me llegó la nómina de 15000' 💰"`;
                } else {
                    // Caso normal: Hay datos
                    prompt = `El usuario consultó su estado financiero de ${periodoDescripcion}.

Periodo: ${periodoDescripcion}
Fechas: ${summary.period.startDate} al ${summary.period.endDate}
Ingresos: $${summary.totals.income}
Gastos: $${summary.totals.expense}
Balance: $${summary.totals.balance}

Genera un resumen conversacional (3-4 líneas) que:
1. IMPORTANTE: Mencione claramente el periodo temporal (${periodoDescripcion}) en la primera frase
2. Mencione los totales de ingresos y gastos
3. Indique el balance (positivo o negativo)
4. Si hay categorías, menciona las 2 principales donde más gastó
5. Sea amigable y motivador

Categorías principales: ${JSON.stringify(summary.byCategory.slice(0, 3))}

Ejemplo: "${periodoDescripcion === 'el mes pasado' ? 'El mes pasado' : periodoDescripcion === 'este mes' ? 'En lo que va de este mes' : periodoDescripcion === 'hoy' ? 'El día de hoy' : 'En el periodo consultado'} tuviste ingresos de $${summary.totals.income} y gastos de $${summary.totals.expense}. Tu balance es de $${summary.totals.balance}."`;
                }
                break;

            case 'listar_transacciones':
                if (result.length === 0) {
                    prompt = `El usuario pidió ver transacciones pero NO HAY NINGUNA que coincida con los filtros.
Genera una respuesta amigable (2-3 líneas) diciendo que no encontraste transacciones y sugiriendo que registre algunas.`;
                } else {
                    // Formatear lista numerada
                    const listaFormateada = result.map((t, index) =>
                        `${index + 1}. $${t.amount} - ${t.description} (${t.category_name}) - ${t.transaction_date}`
                    ).join('\n');

                    prompt = `El usuario pidió ver sus transacciones. Encontraste ${result.length} transacciones.

IMPORTANTE: Debes mostrar la lista EXACTAMENTE como está formateada abajo, con números y todo. NO la reformules.

Lista de transacciones:
${listaFormateada}

Genera una respuesta que:
1. Diga cuántas transacciones encontraste
2. Muestre la lista EXACTAMENTE como está arriba (copia y pega)
3. Mencione que puede decir "elimina el 1" o "cambia el 2 a $600" para gestionar las transacciones`;
                }
                break;

            case 'eliminar_transaccion':
                prompt = `El usuario eliminó la transacción #${result.numero}: $${result.deleted.amount} - ${result.deleted.description}.

Genera una confirmación breve (1-2 líneas) diciendo que se eliminó correctamente.`;
                break;

            case 'editar_transaccion':
                prompt = `El usuario editó la transacción #${result.numero}.
Cambió el monto de $${result.oldAmount} a $${result.newAmount}.
Descripción: ${result.transaction.description}

Genera una confirmación breve (1-2 líneas) diciendo que se actualizó el monto correctamente.`;
                break;

            default:
                return 'Mensaje recibido. ¿En qué más puedo ayudarte?';
        }

        const response = await openai.chat.completions.create({
            model: 'gpt-4',
            messages: [
                {
                    role: 'system',
                    content: `Eres BUBU, un asistente de finanzas personales amigable, positivo y profesional.

REGLAS IMPORTANTES:
- NUNCA digas que estás "confundido" o que "no entiendes"
- NUNCA menciones problemas técnicos o errores
- SIEMPRE sé útil y proactivo
- Si no hay datos, sugiere qué hacer (ej: "Aún no has registrado gastos. Prueba escribir: 'gasté 500 en comida'")
- Usa un tono casual pero profesional
- Usa emojis ocasionalmente pero sin exagerar (máximo 2 por mensaje)
- Máximo 3-4 líneas
- Sé específico con números y fechas
- Usa lenguaje positivo y motivador`
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            temperature: 0.7,
            max_tokens: 200
        });

        return response.choices[0].message.content.trim();

    } catch (error) {
        console.error('Error al generar respuesta natural:', error);
        return 'Operación completada correctamente.';
    }
}

export default {
    parseIntent,
    generateNaturalResponse
};
