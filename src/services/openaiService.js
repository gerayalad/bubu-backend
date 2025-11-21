/**
 * BUBU - OpenAI Service
 * Servicio para interpretar mensajes de usuario usando OpenAI
 */

import openai from '../config/openai.js';
import { getAllCategories } from './categoryService.js';
import { getTodayMexico } from '../utils/dateUtils.js';
import { selectIcon, selectColor } from '../utils/iconMapper.js';

/**
 * Define las funciones que OpenAI puede invocar
 * Estas funciones representan las acciones que el usuario puede solicitar
 */
async function getOpenAIFunctions() {
    const categories = await getAllCategories();

    return [
        {
            name: 'registrar_transaccion',
            description: 'Registra un gasto o ingreso del usuario DIRECTAMENTE (sin confirmación). Usa esta función cuando el usuario mencione que gastó dinero, pagó algo, recibió dinero, le pagaron, etc. IMPORTANTE: Usa confirmar_transaccion para webchat con confirmación. GASTOS COMPARTIDOS: Detecta si dice "pagué yo", "pagó mi pareja", "pago yo", "paga mi pareja", "50/50", "partes iguales", "mitad", "40/60", etc.',
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
                    },
                    es_compartido: {
                        type: 'boolean',
                        description: 'true si menciona "pagué yo", "pagó mi pareja", "pago yo", "pago mi pareja", o especifica división (50/50, etc.). false si dice "solo yo" o no menciona nada de compartir'
                    },
                    quien_pago: {
                        type: 'string',
                        enum: ['yo', 'pareja', null],
                        description: 'Quién pagó el gasto. "yo" si dice "pagué yo" o "pago yo". "pareja" si dice "pagó mi pareja" o "paga mi pareja". null si no es compartido o no se especifica'
                    },
                    split_custom_user: {
                        type: 'number',
                        description: 'Porcentaje custom del usuario si especifica división. Ejemplos: "50/50" → 50, "40/60" → 40, "mitad" → 50, "partes iguales" → 50, "70/30" → 70. null si usa división default'
                    },
                    split_custom_partner: {
                        type: 'number',
                        description: 'Porcentaje custom de la pareja. Ejemplos: "50/50" → 50, "40/60" → 60, "mitad" → 50, "partes iguales" → 50, "70/30" → 30. null si usa división default. Debe sumar 100 con split_custom_user'
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
            name: 'consultar_categorias',
            description: 'Lista las categorías disponibles. Usa esta cuando el usuario pregunte "qué categorías hay", "qué categorías existen", "en qué puedo gastar", "cuáles son las categorías", "qué categorías personalizadas tengo", "muestra mis categorías", etc.',
            parameters: {
                type: 'object',
                properties: {
                    tipo_categoria: {
                        type: 'string',
                        enum: ['gasto', 'ingreso', 'todas', 'personalizadas'],
                        description: 'Tipo de categorías a mostrar. "todas" muestra todas las categorías (predefinidas y personalizadas), "personalizadas" solo las creadas por el usuario, "gasto" solo categorías de gastos, "ingreso" solo categorías de ingresos.'
                    }
                }
            }
        },
        {
            name: 'crear_categoria',
            description: 'Crea una nueva categoría personalizada. Usa esta cuando el usuario pida explícitamente crear una categoría nueva. Ejemplos: "crea una categoría de gastos llamada Mascotas", "crea categoría Freelance de ingresos", "nueva categoría Cafetería para gastos".',
            parameters: {
                type: 'object',
                properties: {
                    nombre: {
                        type: 'string',
                        description: 'Nombre de la nueva categoría según lo que dijo el usuario'
                    },
                    tipo: {
                        type: 'string',
                        enum: ['gasto', 'ingreso'],
                        description: 'Tipo de categoría: "gasto" para categorías de gastos, "ingreso" para categorías de ingresos'
                    }
                },
                required: ['nombre', 'tipo']
            }
        },
        {
            name: 'editar_categoria',
            description: 'Edita una categoría personalizada existente (nombre, color o icono). Usa esta cuando el usuario pida cambiar/editar/renombrar una categoría. Ejemplos: "cambia el nombre de la categoría AI Tools a HappyToHelp", "renombra la categoría Mascotas a Pets", "cambia el color de la categoría Freelance".',
            parameters: {
                type: 'object',
                properties: {
                    nombre_actual: {
                        type: 'string',
                        description: 'Nombre actual de la categoría a editar'
                    },
                    nombre_nuevo: {
                        type: 'string',
                        description: 'Nuevo nombre para la categoría (opcional si solo se cambia color/icono)'
                    },
                    color_nuevo: {
                        type: 'string',
                        description: 'Nuevo color en formato hexadecimal (opcional)'
                    },
                    icono_nuevo: {
                        type: 'string',
                        description: 'Nuevo icono/emoji (opcional)'
                    }
                },
                required: ['nombre_actual']
            }
        },
        {
            name: 'eliminar_categoria',
            description: 'Elimina una categoría personalizada. Las transacciones asociadas se moverán automáticamente a "Otros Gastos" u "Otros Ingresos". Usa esta cuando el usuario pida eliminar/borrar una categoría. Ejemplos: "elimina la categoría AI Tools", "borra la categoría Mascotas", "quita la categoría Freelance".',
            parameters: {
                type: 'object',
                properties: {
                    nombre: {
                        type: 'string',
                        description: 'Nombre de la categoría a eliminar'
                    }
                },
                required: ['nombre']
            }
        },
        {
            name: 'mover_transacciones_categoria',
            description: 'Mueve todas las transacciones de una categoría a otra. Si la categoría destino no existe, se creará automáticamente. Usa esta cuando el usuario pida mover/cambiar/pasar transacciones de una categoría a otra. Ejemplos: "mueve todos los gastos de Entretenimiento a Casino", "pasa las transacciones de Comida a Restaurantes", "cambia todos los gastos de AI Tools a HappyToHelp".',
            parameters: {
                type: 'object',
                properties: {
                    categoria_origen: {
                        type: 'string',
                        description: 'Nombre de la categoría de donde se moverán las transacciones'
                    },
                    categoria_destino: {
                        type: 'string',
                        description: 'Nombre de la categoría a donde se moverán las transacciones'
                    },
                    tipo: {
                        type: 'string',
                        enum: ['gasto', 'ingreso'],
                        description: 'Tipo de transacciones a mover (gasto o ingreso). Infiere del contexto.'
                    }
                },
                required: ['categoria_origen', 'categoria_destino', 'tipo']
            }
        },
        {
            name: 'ayuda_uso',
            description: 'Proporciona ayuda e instrucciones de uso. Usa esta cuando el usuario diga "quiero registrar un gasto", "cómo registro", "ayuda", "qué puedes hacer", "cómo funciona", "no sé cómo usarte", etc. - cuando pidan instrucciones sin datos específicos.',
            parameters: {
                type: 'object',
                properties: {
                    tipo_ayuda: {
                        type: 'string',
                        enum: ['registrar', 'consultar', 'general'],
                        description: 'Tipo de ayuda solicitada'
                    }
                }
            }
        },
        {
            name: 'confirmar_receipt',
            description: 'Confirma los datos de un ticket/recibo que está pendiente de confirmación. Usa esta función cuando el usuario responda afirmativamente a una solicitud de confirmación. Ejemplos: "sí", "correcto", "está bien", "ok", "confirmo", "confirma", "si", "exacto", "así es".',
            parameters: {
                type: 'object',
                properties: {
                    confirmacion: {
                        type: 'boolean',
                        description: 'true para confirmar los datos del receipt'
                    }
                },
                required: ['confirmacion']
            }
        },
        {
            name: 'corregir_receipt',
            description: 'Corrige los datos de un ticket/recibo pendiente de confirmación. Usa esta cuando el usuario indique que los datos NO son correctos y proporcione correcciones. Ejemplos: "no, fueron 200", "no es correcto, el monto es 150", "no, pagué 350", "fueron 500 pesos", "el total fue de $180".',
            parameters: {
                type: 'object',
                properties: {
                    monto_correcto: {
                        type: 'number',
                        description: 'El monto correcto proporcionado por el usuario'
                    },
                    descripcion_correcta: {
                        type: 'string',
                        description: 'Descripción correcta si el usuario la menciona'
                    },
                    categoria_correcta: {
                        type: 'string',
                        description: 'Categoría correcta si el usuario la menciona',
                        enum: categories.map(c => c.name)
                    }
                },
                required: ['monto_correcto']
            }
        },
        {
            name: 'proporcionar_monto',
            description: 'Proporciona el monto faltante de un recibo. Usa esta cuando se le pidió al usuario que proporcione el monto porque no se pudo leer del ticket, y el usuario responde solo con un número o cantidad. Ejemplos: "150", "200 pesos", "fueron 350", "$180", "500".',
            parameters: {
                type: 'object',
                properties: {
                    monto: {
                        type: 'number',
                        description: 'El monto proporcionado por el usuario'
                    }
                },
                required: ['monto']
            }
        },
        {
            name: 'confirmar_transaccion',
            description: 'Prepara una transacción para confirmación del usuario (NO la guarda todavía). Usa esta función cuando el usuario mencione un gasto o ingreso nuevo. Ejemplos: "gasté 319 en Disney Plus", "pagué 150 de comida", "recibí 1000 de mi salario".',
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
            name: 'corregir_ultima_transaccion',
            description: 'Corrige un campo de la última transacción que se creó. Usa esta cuando el usuario indique que algo está mal en la transacción que acaba de crear. Ejemplos: "no, debería estar en Entretenimiento", "no, el monto es 200", "no es correcto, la descripción es Netflix", "cambia la categoría a Comida".',
            parameters: {
                type: 'object',
                properties: {
                    campo: {
                        type: 'string',
                        enum: ['categoria', 'monto', 'descripcion', 'fecha'],
                        description: 'Campo a corregir: categoria, monto, descripcion, o fecha'
                    },
                    nuevo_valor_categoria: {
                        type: 'string',
                        description: 'Nuevo nombre de categoría (solo si campo es "categoria")',
                        enum: categories.map(c => c.name)
                    },
                    nuevo_valor_monto: {
                        type: 'number',
                        description: 'Nuevo monto (solo si campo es "monto")'
                    },
                    nuevo_valor_descripcion: {
                        type: 'string',
                        description: 'Nueva descripción (solo si campo es "descripcion")'
                    },
                    nuevo_valor_fecha: {
                        type: 'string',
                        description: 'Nueva fecha en formato YYYY-MM-DD (solo si campo es "fecha")'
                    }
                },
                required: ['campo']
            }
        },
        {
            name: 'registrar_pareja',
            description: 'Registra una relación con otra persona para compartir gastos. Detecta frases como: "registra a mi pareja con teléfono X", "quiero compartir gastos con X", "dividir gastos 65/35 con X", "mi roommate es X".',
            parameters: {
                type: 'object',
                properties: {
                    partner_phone: {
                        type: 'string',
                        description: 'Teléfono de 10 dígitos de la persona con quien compartir gastos (sin espacios ni guiones)'
                    },
                    partner_name: {
                        type: 'string',
                        description: 'Nombre opcional de la pareja/persona (si lo menciona)'
                    },
                    split_user: {
                        type: 'number',
                        description: 'Porcentaje del usuario actual (ej: 65 para 65%). Si no especifica, usa 50'
                    },
                    split_partner: {
                        type: 'number',
                        description: 'Porcentaje de la pareja (ej: 35 para 35%). Si no especifica, usa 50. Debe sumar 100 con split_user'
                    }
                },
                required: ['partner_phone']
            }
        },
        {
            name: 'consultar_balance',
            description: 'Consulta el balance de gastos compartidos con la pareja. Detecta: "quién debe a quién", "balance con mi pareja", "cómo vamos con los gastos compartidos", "cuánto me debe mi pareja", "cuánto le debo".',
            parameters: {
                type: 'object',
                properties: {
                    periodo: {
                        type: 'string',
                        enum: ['mes_actual', 'mes_pasado', 'todos'],
                        description: 'Periodo a consultar. Default: mes_actual'
                    }
                }
            }
        },
        {
            name: 'listar_gastos_compartidos',
            description: 'Lista los gastos compartidos con la pareja. Detecta: "muestra gastos compartidos", "qué hemos gastado juntos", "gastos con mi pareja", "lista de gastos compartidos".',
            parameters: {
                type: 'object',
                properties: {
                    periodo: {
                        type: 'string',
                        enum: ['mes_actual', 'mes_pasado', 'todos'],
                        description: 'Periodo de consulta'
                    },
                    categoria: {
                        type: 'string',
                        description: 'Filtrar por categoría específica',
                        enum: [...categories.map(c => c.name), null]
                    }
                }
            }
        },
        {
            name: 'actualizar_division_default',
            description: 'Actualiza la división por defecto de gastos compartidos. Detecta: "cambia la división a 70/30", "ahora dividir 60/40", "modificar split a partes iguales", "cambiar porcentaje a 65/35".',
            parameters: {
                type: 'object',
                properties: {
                    split_user: {
                        type: 'number',
                        description: 'Nuevo porcentaje del usuario (ej: 70 para 70%)'
                    },
                    split_partner: {
                        type: 'number',
                        description: 'Nuevo porcentaje de la pareja (ej: 30 para 30%). Debe sumar 100 con split_user'
                    }
                },
                required: ['split_user', 'split_partner']
            }
        },
        {
            name: 'aceptar_solicitud_pareja',
            description: 'Usuario ACEPTA una solicitud de compartir gastos con otra persona. Detecta: "acepto", "sí acepto", "acepto la solicitud", "ok acepto", "sí quiero", "aceptar".',
            parameters: {
                type: 'object',
                properties: {},
                required: []
            }
        },
        {
            name: 'rechazar_solicitud_pareja',
            description: 'Usuario RECHAZA una solicitud de compartir gastos. Detecta: "rechazar", "no acepto", "rechazar solicitud", "no quiero", "no gracias", "cancelar solicitud".',
            parameters: {
                type: 'object',
                properties: {},
                required: []
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
 * Calcula fechas relativas (ayer, hoy, etc.) en zona horaria de México
 * @param {string} referencia - Referencia temporal (hoy, ayer, etc.)
 * @returns {string} Fecha en formato YYYY-MM-DD
 */
function calcularFechaRelativa(referencia) {
    // Obtener fecha actual en zona horaria de México
    const now = new Date();
    const hoy = new Date(now.toLocaleString('en-US', { timeZone: 'America/Mexico_City' }));

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

    const year = hoy.getFullYear();
    const month = String(hoy.getMonth() + 1).padStart(2, '0');
    const day = String(hoy.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}

/**
 * Parsea un mensaje de usuario usando OpenAI
 * @param {string} mensaje - Mensaje del usuario
 * @param {string} userPhone - Teléfono del usuario (para contexto)
 * @returns {object} Intent parseado con la función y argumentos
 */
export async function parseIntent(mensaje, userPhone = null) {
    try {
        const functions = await getOpenAIFunctions();
        const today = getTodayMexico();

        const systemPrompt = `Eres un asistente de finanzas personales llamado BUBU.
Tu trabajo es interpretar los mensajes del usuario y determinar qué acción quiere realizar.

Fecha actual: ${today}

IMPORTANTE - Cuando el usuario pregunte sobre capacidades:
- "¿Puedes crear categorías?" → usa ayuda_uso (tipo_ayuda: general)
- "¿Qué puedes hacer?" → usa ayuda_uso (tipo_ayuda: general)
- "¿Cómo funciona?" → usa ayuda_uso (tipo_ayuda: general)
El sistema responderá afirmativamente y explicará cómo usar la funcionalidad.

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

CONSULTAR CATEGORÍAS:
- "¿qué categorías existen?" → consultar_categorias (tipo_categoria: todas)
- "¿en qué puedo gastar?" → consultar_categorias (tipo_categoria: gasto)
- "¿cuáles son las categorías de ingresos?" → consultar_categorias (tipo_categoria: ingreso)
- "muéstrame las categorías" → consultar_categorias (tipo_categoria: todas)
- "¿qué categorías personalizadas tengo?" → consultar_categorias (tipo_categoria: personalizadas)
- "muestra mis categorías" → consultar_categorias (tipo_categoria: personalizadas)

CREAR CATEGORÍAS PERSONALIZADAS:
- "crea una categoría de gastos llamada Mascotas" → crear_categoria (nombre: Mascotas, tipo: gasto)
- "crea categoría Freelance de ingresos" → crear_categoria (nombre: Freelance, tipo: ingreso)
- "nueva categoría Cafetería para gastos" → crear_categoria (nombre: Cafetería, tipo: gasto)
- "crea categoría gimnasio" → crear_categoria (nombre: Gimnasio, tipo: gasto)
- "quiero una categoría de ingresos que se llame Propinas" → crear_categoria (nombre: Propinas, tipo: ingreso)

EDITAR CATEGORÍAS PERSONALIZADAS:
- "cambia el nombre de la categoría AI Tools a HappyToHelp" → editar_categoria (nombre_actual: AI Tools, nombre_nuevo: HappyToHelp)
- "renombra la categoría Mascotas a Pets" → editar_categoria (nombre_actual: Mascotas, nombre_nuevo: Pets)
- "cambia el nombre de AI Tools por HappyToHelp" → editar_categoria (nombre_actual: AI Tools, nombre_nuevo: HappyToHelp)
- "edita la categoría Freelance y ponle el nombre Trabajo Remoto" → editar_categoria (nombre_actual: Freelance, nombre_nuevo: Trabajo Remoto)

ELIMINAR CATEGORÍAS PERSONALIZADAS:
- "elimina la categoría AI Tools" → eliminar_categoria (nombre: AI Tools)
- "borra la categoría Mascotas" → eliminar_categoria (nombre: Mascotas)
- "quita la categoría Freelance" → eliminar_categoria (nombre: Freelance)
- "eliminar categoría Gimnasio" → eliminar_categoria (nombre: Gimnasio)

MOVER TRANSACCIONES ENTRE CATEGORÍAS:
- "mueve todos los gastos de Entretenimiento a Casino" → mover_transacciones_categoria (categoria_origen: Entretenimiento, categoria_destino: Casino, tipo: gasto)
- "pasa las transacciones de Comida a Restaurantes" → mover_transacciones_categoria (categoria_origen: Comida, categoria_destino: Restaurantes, tipo: gasto)
- "cambia todos los gastos de AI Tools a HappyToHelp" → mover_transacciones_categoria (categoria_origen: AI Tools, categoria_destino: HappyToHelp, tipo: gasto)
- "mueve los ingresos de Ventas a Freelance" → mover_transacciones_categoria (categoria_origen: Ventas, categoria_destino: Freelance, tipo: ingreso)

AYUDA / INSTRUCCIONES:
- "quiero registrar un gasto" → ayuda_uso (tipo_ayuda: registrar)
- "¿cómo registro un gasto?" → ayuda_uso (tipo_ayuda: registrar)
- "ayuda" → ayuda_uso (tipo_ayuda: general)
- "¿qué puedes hacer?" → ayuda_uso (tipo_ayuda: general)
- "¿puedes crear categorías?" → ayuda_uso (tipo_ayuda: general)
- "¿se pueden crear categorías?" → ayuda_uso (tipo_ayuda: general)
- "¿qué funcionalidades tienes?" → ayuda_uso (tipo_ayuda: general)
- "¿cómo consulto mi estado?" → ayuda_uso (tipo_ayuda: consultar)
- "¿cómo funciona esto?" → ayuda_uso (tipo_ayuda: general)

CONFIRMACIONES DE RECEIPTS (cuando hay un receipt pendiente de confirmación):
- "sí", "correcto", "está bien", "ok", "confirmo" → confirmar_receipt (confirmacion: true)
- "no, fueron 200", "no es correcto, el monto es 150" → corregir_receipt (monto_correcto: 200 o 150)
- "150", "200 pesos", "$350" (cuando se pidió el monto) → proporcionar_monto (monto: 150, 200, o 350)

IMPORTANTE: Solo usa confirmar_receipt, corregir_receipt o proporcionar_monto cuando el contexto indica que hay un receipt pendiente de confirmación o que se solicitó información.

Sé inteligente al categorizar. Si el usuario dice "tacos", "pizza", "restaurante" → categoría Comida.
Si dice "uber", "gasolina", "taxi" → categoría Transporte.`;

        // 🔍 DEBUG: Log de funciones disponibles y mensaje del usuario
        console.log('🔍 [OPENAI DEBUG] ===== INICIO =====');
        console.log('📝 Mensaje del usuario:', mensaje);
        console.log('🎯 Funciones disponibles:', functions.map(f => f.name).join(', '));
        const hasRegistrarPareja = functions.find(f => f.name === 'registrar_pareja');
        console.log('💑 ¿Tiene registrar_pareja?', hasRegistrarPareja ? '✅ SÍ' : '❌ NO');
        if (hasRegistrarPareja) {
            console.log('📋 Descripción de registrar_pareja:', hasRegistrarPareja.description);
        }

        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
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

            console.log('✅ [OPENAI DEBUG] OpenAI llamó función:', functionName);
            console.log('📦 [OPENAI DEBUG] Argumentos:', JSON.stringify(args, null, 2));
            console.log('🔍 [OPENAI DEBUG] ===== FIN =====');

            return {
                action: functionName,
                parameters: args,
                confidence: 'high',
                rawResponse: message
            };
        }

        // Si no llamó a ninguna función, es conversación general
        console.log('⚠️ [OPENAI DEBUG] OpenAI NO llamó ninguna función');
        console.log('💬 [OPENAI DEBUG] Respuesta texto:', message.content);
        console.log('🔍 [OPENAI DEBUG] ===== FIN =====');

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
                // Detectar si es gasto compartido
                if (result.is_shared) {
                    // Gasto compartido
                    const whoPaid = result.payer_phone === data.userPhone ? 'tú' : 'tu pareja';
                    prompt = `El usuario registró un GASTO COMPARTIDO:
- Total: $${result.total_amount}
- Pagó: ${whoPaid}
- División: Usuario ${result.user_percentage}% ($${result.user_amount}) / Pareja ${result.partner_percentage}% ($${result.partner_amount})
- Categoría: ${result.category_name}
- Descripción: ${result.description}

Genera una confirmación breve y clara (2-3 líneas) que:
1. Confirme que se registró el gasto compartido
2. Mencione el total y quién pagó
3. Muestre la división (porcentajes y montos de cada uno)

Ejemplo: "✅ Registré el gasto compartido de $${result.total_amount} en ${result.category_name}. ${whoPaid === 'tú' ? 'Tú pagaste' : 'Tu pareja pagó'} todo, pero se divide: tú ${result.user_percentage}% ($${result.user_amount}) y tu pareja ${result.partner_percentage}% ($${result.partner_amount})."`;
                } else {
                    // Gasto individual
                    let basePrompt = `El usuario registró una transacción: ${JSON.stringify(result)}.
Genera una confirmación breve y amigable (1-2 líneas) confirmando que se registró el ${result.type === 'expense' ? 'gasto' : 'ingreso'} de $${result.amount} en ${result.category_name}.`;

                    // Si sugirió compartir pero no tiene pareja, agregar sugerencia
                    if (result.suggest_partner) {
                        basePrompt += `

IMPORTANTE: El usuario dijo "pagué yo" pero NO tiene pareja registrada, así que se creó como gasto individual.
Agrega al final (en una línea separada con emoji 💡) una sugerencia amigable y breve:
"💡 Si quieres compartir gastos con alguien, puedes registrar una pareja diciendo: 'Registra a mi pareja con el número [teléfono]'"`;
                    }

                    prompt = basePrompt;
                }
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
            model: 'gpt-4o-mini',
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
