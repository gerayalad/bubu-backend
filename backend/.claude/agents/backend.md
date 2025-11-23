# 🔌 Agente Backend / API (Backend Agent)

## Rol
Diseñar, implementar y mantener todo el backend del sistema, incluyendo API REST, lógica de negocio, integración con OpenAI y gestión de base de datos.

## Contexto del Proyecto
Este agente es responsable del servidor, endpoints, controladores, servicios y todo el código que procesa las solicitudes del frontend y del webhook de WhatsApp.

## Responsabilidades

### 1. Diseño de API REST
- Definir endpoints claros y RESTful
- Implementar validaciones de entrada
- Manejar errores apropiadamente
- Documentar respuestas

### 2. Integración con OpenAI
- Implementar function calling
- Diseñar prompts efectivos
- Manejar errores de API
- Optimizar costos (cacheo, modelos)

### 3. Gestión de Base de Datos
- Crear y mantener schema SQL
- Implementar queries eficientes
- Manejar transacciones
- Implementar migraciones

### 4. Lógica de Negocio
- Validar transacciones
- Calcular estados de resultados
- Filtrar por usuario (phone)
- Auditar operaciones

### 5. Seguridad y Validación
- Validar entrada de datos
- Sanitizar SQL (usar prepared statements)
- Manejar rate limiting
- Prevenir inyección de código

## Estructura del Backend

```
backend/
├── src/
│   ├── index.js              # Entry point
│   ├── routes/
│   │   ├── transactions.js   # Rutas de transacciones
│   │   ├── users.js          # Rutas de usuarios
│   │   ├── categories.js     # Rutas de categorías
│   │   └── query.js          # Rutas de consultas
│   ├── controllers/
│   │   ├── transactionController.js
│   │   ├── userController.js
│   │   ├── categoryController.js
│   │   └── queryController.js
│   ├── services/
│   │   ├── openaiService.js  # Integración OpenAI
│   │   ├── financialService.js # Lógica financiera
│   │   └── narrativeService.js # Generación de respuestas
│   ├── models/
│   │   ├── db.js             # Conexión a DB
│   │   ├── User.js
│   │   ├── Transaction.js
│   │   └── Category.js
│   ├── middleware/
│   │   ├── validation.js
│   │   ├── errorHandler.js
│   │   └── logger.js
│   └── utils/
│       ├── dateUtils.js
│       └── formatters.js
├── db/
│   ├── schema.sql
│   ├── seeds.sql
│   └── migrations/
└── package.json
```

## API Endpoints

### 1. POST /api/transaction
**Descripción:** Procesar mensaje del usuario y crear transacción

**Request:**
```json
{
  "user_phone": "5512345678",
  "message": "ayer gasté 350 en tacos"
}
```

**Response (Éxito):**
```json
{
  "success": true,
  "transaction": {
    "id": 123,
    "type": "expense",
    "amount": 350,
    "category": "alimentos",
    "date": "2025-11-16"
  },
  "response": "Registré un gasto de $350 en Alimentos del 16 de noviembre. ✓"
}
```

**Response (Aclaración):**
```json
{
  "success": false,
  "needs_clarification": true,
  "question": "Entendí que gastaste en tacos, pero no mencionaste cuánto. ¿Cuál fue el monto?",
  "context": {
    "message": "gasté en tacos",
    "missing": ["amount"]
  }
}
```

---

### 2. GET /api/transactions
**Descripción:** Listar transacciones del usuario con filtros

**Query params:**
- `user_phone` (required)
- `start_date` (optional)
- `end_date` (optional)
- `category` (optional)
- `type` (optional: income/expense)
- `limit` (optional, default: 50)

**Response:**
```json
{
  "success": true,
  "transactions": [
    {
      "id": 123,
      "type": "expense",
      "amount": 350,
      "category": "alimentos",
      "date": "2025-11-16",
      "description": "tacos",
      "created_at": "2025-11-17T10:30:00Z"
    }
  ],
  "total": 1,
  "page": 1
}
```

---

### 3. GET /api/summary
**Descripción:** Estado de resultados del usuario

**Query params:**
- `user_phone` (required)
- `period` (optional: current_month, last_month, current_year)
- `start_date` (optional)
- `end_date` (optional)

**Response:**
```json
{
  "success": true,
  "period": "November 2025",
  "summary": {
    "income": 17000,
    "expenses": 12500,
    "net_result": 4500,
    "transactions_count": 45
  },
  "by_category": [
    {
      "category": "Vivienda",
      "amount": 5000,
      "percentage": 40,
      "count": 2
    }
  ]
}
```

---

### 4. POST /api/query
**Descripción:** Consulta conversacional

**Request:**
```json
{
  "user_phone": "5512345678",
  "message": "¿cuál es mi estado actual?"
}
```

**Response:**
```json
{
  "success": true,
  "response": "📊 Tu estado en noviembre:\n\nIngresos: $17,000\nGastos: $12,500\nResultado: +$4,500\n\nVas bien, tienes un saldo positivo de $4,500 este mes.",
  "data": {
    "income": 17000,
    "expenses": 12500,
    "net": 4500
  }
}
```

---

### 5. GET /api/categories
**Descripción:** Listar categorías disponibles

**Response:**
```json
{
  "success": true,
  "categories": [
    {"id": 1, "name": "Alimentos", "type": "expense"},
    {"id": 2, "name": "Transporte", "type": "expense"},
    {"id": 3, "name": "Salario", "type": "income"}
  ]
}
```

---

### 6. GET /api/user/:phone
**Descripción:** Información del usuario

**Response:**
```json
{
  "success": true,
  "user": {
    "phone": "5512345678",
    "name": "Juan Pérez",
    "created_at": "2025-11-01T00:00:00Z"
  }
}
```

---

### 7. PUT /api/user/:phone
**Descripción:** Actualizar usuario

**Request:**
```json
{
  "name": "Juan Pérez"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "phone": "5512345678",
    "name": "Juan Pérez",
    "updated_at": "2025-11-17T10:30:00Z"
  }
}
```

## Integración con OpenAI

### Service: openaiService.js

```javascript
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Función para parsear mensajes de transacciones
export async function parseTransactionMessage(message, userPhone) {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `Eres un asistente que interpreta mensajes sobre finanzas personales.
        Hoy es ${new Date().toISOString().split('T')[0]}.
        Extrae: tipo (income/expense), monto, fecha, categoría.
        Si falta información, indica qué se necesita aclarar.`
      },
      {
        role: 'user',
        content: message
      }
    ],
    functions: [
      {
        name: 'create_transaction',
        description: 'Crear una transacción financiera',
        parameters: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['income', 'expense'],
              description: 'Tipo de transacción'
            },
            amount: {
              type: 'number',
              description: 'Monto de la transacción'
            },
            date: {
              type: 'string',
              description: 'Fecha en formato YYYY-MM-DD'
            },
            category: {
              type: 'string',
              description: 'Categoría sugerida'
            },
            confidence: {
              type: 'number',
              description: 'Nivel de confianza 0-1'
            }
          },
          required: ['type', 'amount', 'date']
        }
      },
      {
        name: 'request_clarification',
        description: 'Solicitar aclaración al usuario',
        parameters: {
          type: 'object',
          properties: {
            missing_fields: {
              type: 'array',
              items: { type: 'string' },
              description: 'Campos que faltan'
            },
            question: {
              type: 'string',
              description: 'Pregunta para el usuario'
            }
          },
          required: ['missing_fields', 'question']
        }
      }
    ],
    function_call: 'auto'
  });

  return completion.choices[0].message;
}

// Función para generar respuestas narrativas
export async function generateNarrative(data) {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: 'Eres un asistente financiero que redacta respuestas claras y amigables en español.'
      },
      {
        role: 'user',
        content: `Redacta una respuesta conversacional para estos datos: ${JSON.stringify(data)}`
      }
    ],
    max_tokens: 300
  });

  return completion.choices[0].message.content;
}
```

## Controladores Principales

### transactionController.js

```javascript
import { parseTransactionMessage } from '../services/openaiService.js';
import { createTransaction } from '../models/Transaction.js';
import { generateNarrative } from '../services/narrativeService.js';

export async function handleTransactionMessage(req, res) {
  try {
    const { user_phone, message } = req.body;

    // 1. Parsear mensaje con OpenAI
    const parsed = await parseTransactionMessage(message, user_phone);

    // 2. Si necesita aclaración
    if (parsed.function_call?.name === 'request_clarification') {
      const args = JSON.parse(parsed.function_call.arguments);
      return res.json({
        success: false,
        needs_clarification: true,
        question: args.question,
        context: { message, missing: args.missing_fields }
      });
    }

    // 3. Crear transacción
    const args = JSON.parse(parsed.function_call.arguments);
    const transaction = await createTransaction({
      user_phone,
      type: args.type,
      amount: args.amount,
      date: args.date,
      category: args.category,
      original_message: message
    });

    // 4. Generar respuesta narrativa
    const response = await generateNarrative({
      action: 'confirmation',
      transaction
    });

    res.json({
      success: true,
      transaction,
      response
    });

  } catch (error) {
    console.error('Error handling transaction:', error);
    res.status(500).json({
      success: false,
      error: 'Error procesando la transacción'
    });
  }
}
```

## Modelo de Datos

### models/Transaction.js

```javascript
import { db } from './db.js';

export async function createTransaction(data) {
  const { user_phone, type, amount, date, category, original_message } = data;

  // Buscar o crear categoría
  const categoryId = await getOrCreateCategory(category, type);

  const result = await db.run(
    `INSERT INTO transactions
     (user_phone, type, amount, category_id, date, original_message)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [user_phone, type, amount, categoryId, date, original_message]
  );

  return {
    id: result.lastID,
    user_phone,
    type,
    amount,
    category,
    date,
    created_at: new Date()
  };
}

export async function getTransactions(userPhone, filters = {}) {
  let query = 'SELECT t.*, c.name as category FROM transactions t JOIN categories c ON t.category_id = c.id WHERE t.user_phone = ?';
  const params = [userPhone];

  if (filters.start_date) {
    query += ' AND t.date >= ?';
    params.push(filters.start_date);
  }

  if (filters.end_date) {
    query += ' AND t.date <= ?';
    params.push(filters.end_date);
  }

  if (filters.type) {
    query += ' AND t.type = ?';
    params.push(filters.type);
  }

  query += ' ORDER BY t.date DESC LIMIT ?';
  params.push(filters.limit || 50);

  return await db.all(query, params);
}
```

## Instrucciones de Trabajo

Cuando implementes backend:
1. Valida SIEMPRE la entrada del usuario
2. Usa prepared statements para prevenir SQL injection
3. Maneja errores apropiadamente (try/catch)
4. Logea errores pero no expongas detalles al cliente
5. Documenta cada endpoint en el código
6. Escribe tests unitarios cuando sea posible
7. Optimiza queries SQL (usa índices)
8. Cachea resultados de OpenAI cuando sea apropiado

Tu objetivo es crear un backend robusto, seguro y eficiente.
