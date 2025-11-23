📘 Finanzas Personales — Documento Base (v0.1)

Este documento .md define la arquitectura, reglas de negocio, epics y user stories para un sistema de estados de resultados personales, capturados a través de un webchat e interpretados mediante OpenAI.

El enfoque ahora es 100% individual. 

1. 🧠 Visión del Producto

Crear una app donde un usuario, únicamente conversando por un webchat, pueda:

Registrar gastos e ingresos.

Consultar su estado financiero actual ("estado de resultados").

Hacer preguntas sobre sus gastos e ingresos (por periodo, categoría, etc.).

Analizar sus finanzas siempre en modo conversacional, sin otras pantallas ni dashboards clásicos.

El sistema debe ser tan simple que funcione solo con:

Webchat como interfaz.

OpenAI para interpretar los mensajes.

Un motor de transacciones individuales.

Un modelo SQL mínimo.

2. 🏗️ Arquitectura Conceptual

2.1 Entidades principales

Users

Representan personas individuales.

Identificador natural: número de teléfono.

Alta automática: si llega un número nuevo al chat, se crea el usuario.

En la app web, el usuario solo debe capturar su número a 10 dígitos (formato MX, sin +52) para identificarse o configurar su perfil.

Categories

Catálogo de categorías de ingresos/gastos.

Pueden ser predefinidas o configurables.

Transactions

Movimientos individuales (ingresos o gastos).

Alimentan el estado de resultados del usuario.

3. 🧩 Reglas de Negocio

3.1 Registro de gasto individual

Usuario escribe en el webchat:Ej. "ayer gasté 350 en tacos".

OpenAI interpreta el mensaje y devuelve un JSON.

Backend valida el JSON.

Se crea una transacción individual.

3.2 Registro de ingreso

Mismo flujo que los gastos, pero con tipo income.

3.3 Cada usuario ve solo sus movimientos

Filtrados por su número de teléfono.

No hay autenticación tradicional.

4. 🛠️ Epics (Nivel Alto)

🧩 Epic 1 — Gestión de Usuarios

Objetivo: Crear usuarios automáticamente por su número de teléfono y permitirles configurarlo de forma sencilla desde la app web.

User Stories:

US-1.1: Como sistema, quiero crear un usuario la primera vez que llegue un mensaje nuevo desde un número de teléfono (WhatsApp).

US-1.2: Como usuario web, quiero ingresar mi número de teléfono a 10 dígitos para vincular mi perfil con mis movimientos.

US-1.3: Como usuario, quiero editar información básica del usuario (nombre o alias) una vez que he registrado mi número.

🏷️ Epic 2 — Gestión de Categorías

Objetivo: Administrar categorías de ingresos y gastos.

User Stories:

US-2.1: Crear categorías (admin o sistema).

US-2.2: Editar categorías.

US-2.3: Validar que las categorías pertenezcan a income/expense.

💸 Epic 3 — Registro de Transacciones

Objetivo: Registrar transacciones a partir de mensajes naturales.

User Stories:

US-3.1: Registrar gasto individual desde el chat.

US-3.2: Registrar ingreso desde el chat.

US-3.3: Consultar mis transacciones (por fecha o categoría) a través de preguntas en el chat, y recibir la respuesta como texto estructurado/resumen.

💬 Epic 4 — Webchat de Captura

Objetivo: Permitir registrar todos los movimientos desde un chat.

User Stories:

US-4.1: Registrar gastos e ingresos escribiendo mensajes naturales.

US-4.2: Ver confirmación clara de lo que el sistema entendió.

US-4.3: Ver histórico de mensajes.

🧠 Epic 5 — Motor con OpenAI

Objetivo: Interpretar mensajes y convertirlos en estructuras válidas.

User Stories:

US-5.1: OpenAI debe devolver un JSON estructurado (tipo, monto, fecha, categoría).

US-5.2: Pedir aclaraciones si falta información.

US-5.3: Registrar auditoría (mensaje original + JSON + resultado).

📊 Epic 6 — Estado de Resultados Personal

Objetivo: Responder de forma conversacional sobre el estado financiero personal.

User Stories:

US-6.1: Como usuario, quiero preguntar "¿Cuál es mi estado actual?" y recibir un resumen de ingresos, gastos y resultado neto del periodo relevante (por defecto, mes actual).

US-6.2: Como usuario, quiero preguntar por periodos específicos ("¿cómo voy este mes?", "¿cómo cerré el mes pasado?").

US-6.3: Como usuario, quiero preguntar por categorías ("¿cuánto he gastado en comida este mes?", "¿en qué gasté más?") y recibir una respuesta en el chat.

US-6.4: Como usuario, quiero poder pedir comparativos simples ("compárame este mes contra el anterior") y recibir un resumen textual.

5. 💬 Interfaz de Webchat + OpenAI

5.1 Flujo alto nivel — Registro

Usuario manda un mensaje desde su número.

Backend lo envía a OpenAI con un prompt de "intención de registro".

OpenAI devuelve un JSON estructurado (ej. action = create_transaction).

Backend valida y crea la transacción.

Sistema responde al usuario con una confirmación clara de lo registrado.

5.2 Flujo alto nivel — Consultas / Reportes

Usuario manda una pregunta, ej.: "¿Cuál es mi estado actual?", "¿cuánto gasté en comida este mes?".

Backend envía el mensaje a OpenAI con un prompt de "intención de consulta".

OpenAI devuelve un JSON estructurado, por ejemplo:

action = query_summary

period = current_month

filters = { category: 'comida' }

Backend ejecuta la consulta en la base de datos (transactions).

Backend arma un resumen numérico (totales, variaciones) y puede opcionalmente reenviarlo a OpenAI para que lo redacte en lenguaje natural.

Sistema responde en el chat con un mensaje tipo: "En lo que va de noviembre has gastado 4,200 en comida y tu gasto total es 12,500; tu resultado neto es -3,000".

5.3 Casos de interpretación

Gastos con fecha relativa ("ayer", "el viernes").

Gastos sin categoría → OpenAI debe proponer una.

Ingresos varios: "me cayó la nómina", "vendí algo".

Consultas de estado actual, por periodo, por categoría.

Comparativos simples entre periodos.

Correcciones: "no, eran 200 no 300" (pendiente definir estrategia de corrección).

5.2 Casos de interpretación

Gastos con fecha relativa ("ayer", "el viernes").

Gastos sin categoría → OpenAI debe proponerte una.

Ingresos varios: "me cayó la nómina", "vendí algo".

Correcciones: "no, eran 200 no 300".

6. 🧱 Modelo SQL Propuesto (Versión Inicial)

-- users
-- categories
-- transactions

(El SQL detallado vendrá en la siguiente iteración.)

7. 🎨 Look & Feel del Webchat (Neumorfismo)

El webchat debe utilizar un estilo neumórfico (Neumorphism), con sensación de elementos suaves, ligeramente elevados o hundidos sobre un fondo uniforme.

7.1 Principios de diseño

Fondo principal en un color claro suave (ej. gris muy claro o marfil) con mínima textura.

Tarjetas de mensajes (burbujas) con:

Bordes muy redondeados.

Sombras suaves dobles (una más oscura, una más clara) para dar volumen.

Efecto de "salir" del fondo para mensajes propios y efecto más sutil para los del sistema.

Input del mensaje con estilo de píldora neumórfica, con icono de enviar también elevado.

Uso de una paleta reducida (2–3 colores principales) para mantener claridad y no saturar.

7.2 Comportamiento visual

Mensajes del usuario alineados a la derecha con un tono ligeramente más intenso.

Mensajes del sistema alineados a la izquierda con un tono más neutro.

Estados de carga o procesamiento representados con pequeños "pulsos" suaves o animaciones discretas, manteniendo el estilo neumórfico.

Scroll del historial de chat continuo dentro de una tarjeta neumórfica contenedora.

7.3 Accesibilidad mínima

Asegurar contraste suficiente entre texto y fondo dentro de cada burbuja.

Tamaño de fuente legible (mínimo 14–16 px equivalente).

Evitar depender únicamente de color para transmitir información (usar también iconos o etiquetas).