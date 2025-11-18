# 🤖 BUBU Backend - API de Finanzas Personales

Backend de BUBU, un asistente conversacional de finanzas personales con integración a WhatsApp Business.

## 🚀 Tech Stack

- **Runtime:** Node.js 20+
- **Framework:** Express.js
- **Database:** SQLite (better-sqlite3)
- **AI:** OpenAI GPT-4 Function Calling
- **Messaging:** WhatsApp Business API

## 📦 Instalación Local

```bash
# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales

# Inicializar base de datos
npm run init-db

# (Opcional) Agregar datos de prueba
npm run seed

# Levantar servidor
npm run dev
```

## 🌍 Variables de Entorno

Crea un archivo `.env` con las siguientes variables:

```env
PORT=3001
OPENAI_API_KEY=tu_openai_api_key
NODE_ENV=development
WHATSAPP_TOKEN=tu_whatsapp_token
WHATSAPP_PHONE_NUMBER_ID=tu_phone_number_id
WHATSAPP_BUSINESS_ACCOUNT_ID=tu_business_account_id
WEBHOOK_VERIFY_TOKEN=tu_webhook_verify_token
```

## 🚂 Deploy en Railway

1. Conecta tu repositorio de GitHub con Railway
2. Configura las variables de entorno en Railway Dashboard
3. Railway detectará automáticamente el `package.json`
4. El comando de inicio es: `npm start`
5. La base de datos SQLite se creará automáticamente

## 📡 Endpoints

### Chat (Webchat)
- `POST /api/chat/message` - Procesar mensaje
- `GET /api/chat/history/:user_phone` - Historial

### WhatsApp
- `GET /api/whatsapp/webhook` - Verificación de webhook
- `POST /api/whatsapp/webhook` - Recibir mensajes

### Otros
- `GET /api/health` - Health check
- `GET /api/categories` - Categorías disponibles
- `GET /api/transactions/:user_phone` - Transacciones de usuario

## 🔧 Configuración de WhatsApp

Ver [WHATSAPP_SETUP.md](./WHATSAPP_SETUP.md) para instrucciones detalladas.

## 📊 Scripts

```bash
npm start       # Iniciar servidor
npm run dev     # Desarrollo con nodemon
npm run init-db # Inicializar base de datos
npm run seed    # Agregar datos de prueba
```

## 🏗️ Estructura del Proyecto

```
backend/
├── src/
│   ├── app.js              # Punto de entrada
│   ├── config/             # Configuraciones
│   ├── controllers/        # Controladores
│   ├── db/                 # Base de datos
│   ├── routes/             # Rutas de API
│   └── services/           # Lógica de negocio
├── .env.example            # Template de variables
├── package.json
└── README.md
```

## 📝 Licencia

MIT
