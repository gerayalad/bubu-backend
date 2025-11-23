# 💰 BUBU - Sistema de Finanzas Personales Conversacional

Sistema de gestión de finanzas personales 100% conversacional, donde los usuarios pueden registrar sus gastos e ingresos y consultar su estado financiero simplemente conversando por un webchat, interpretado mediante OpenAI.

## 🎯 Características

- **Interfaz Conversacional**: Registra gastos e ingresos hablando naturalmente
- **Interpretación con IA**: OpenAI GPT-4 interpreta y categoriza automáticamente
- **Diseño Neumórfico**: UI moderna y elegante con estilo neumorphism
- **Análisis Financiero**: Consulta tu estado, totales por categoría y tendencias
- **Base de Datos SQLite**: Simple, sin servidor, todo local
- **React + Vite**: Frontend rápido y moderno
- **Express.js**: Backend robusto y escalable

## 🏗️ Arquitectura

```
bubu2/
├── backend/              # API REST con Express.js
│   ├── src/
│   │   ├── config/      # Configuración (OpenAI)
│   │   ├── db/          # Base de datos SQLite
│   │   ├── routes/      # Rutas de la API
│   │   ├── controllers/ # Controladores
│   │   ├── services/    # Lógica de negocio
│   │   └── app.js       # Aplicación principal
│   └── database.sqlite  # Base de datos
│
├── frontend/            # App React con Vite
│   ├── src/
│   │   ├── components/  # Componentes React
│   │   ├── services/    # Cliente API
│   │   ├── styles/      # Estilos neumórficos
│   │   └── App.jsx      # App principal
│   └── index.html
│
└── docs/               # Documentación
    ├── bubu_app.md
    └── openai_roles/
```

## 🚀 Instalación y Configuración

### Prerrequisitos

- Node.js v18+
- npm o yarn
- API Key de OpenAI

### 1. Clonar el proyecto

```bash
cd bubu2
```

### 2. Configurar el Backend

```bash
# Navegar a la carpeta del backend
cd backend

# Instalar dependencias
npm install

# Crear archivo .env
cp .env.example .env
```

Editar `backend/.env` y agregar tu API Key de OpenAI:

```env
PORT=3001
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxx
NODE_ENV=development
```

### 3. Inicializar la Base de Datos

```bash
# Desde la carpeta backend/
npm run init-db
```

Esto creará:
- ✅ Tabla `users`
- ✅ Tabla `categories` (con categorías predefinidas)
- ✅ Tabla `transactions`
- ✅ Tabla `chat_messages`

### 4. Configurar el Frontend

```bash
# Navegar a la carpeta del frontend
cd ../frontend

# Instalar dependencias
npm install

# Crear archivo .env (opcional)
cp .env.example .env
```

El frontend por defecto se conecta a `http://localhost:3001/api`. Si necesitas cambiarlo, edita `frontend/.env`:

```env
VITE_API_URL=http://localhost:3001/api
```

## ▶️ Ejecutar la Aplicación

### Opción 1: Ejecutar en terminales separadas

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

El backend estará corriendo en `http://localhost:3001`

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

El frontend estará corriendo en `http://localhost:5173`

### Opción 2: Script de inicio rápido

Puedes crear un script para iniciar ambos servicios:

```bash
# En la raíz del proyecto (bubu2/)
# Backend en una terminal
cd backend && npm run dev

# Frontend en otra terminal
cd frontend && npm run dev
```

## 📱 Uso de la Aplicación

### 1. Primera vez - Login

1. Abre `http://localhost:5173` en tu navegador
2. Ingresa tu número de teléfono (10 dígitos, ej: 5512345678)
3. Click en "Comenzar"

### 2. Registrar Gastos

Simplemente escribe mensajes naturales como:

- "gasté 350 en tacos"
- "ayer pagué 200 de uber"
- "me compré unos zapatos de 1500"
- "pagué 1000 de luz"

El sistema automáticamente:
- ✅ Identifica que es un gasto
- ✅ Extrae el monto (350, 200, 1500, 1000)
- ✅ Detecta la categoría (Comida, Transporte, Ropa, Servicios)
- ✅ Procesa la fecha (ayer, hoy, etc.)

### 3. Registrar Ingresos

- "me cayó la nómina de 15000"
- "vendí un artículo en 500"
- "me pagaron 3000"

### 4. Consultar Estado Financiero

Pregunta naturalmente:

- "¿cómo voy este mes?"
- "¿cuánto he gastado en comida?"
- "¿cuál es mi estado actual?"
- "¿en qué gasté más?"
- "¿cómo cerré el mes pasado?"

### 5. Ver Historial

El chat mantiene tu historial de conversaciones y transacciones.

## 🎨 Diseño Neumórfico

La interfaz utiliza **neumorfismo**, un estilo de diseño que crea elementos con apariencia de estar ligeramente elevados o hundidos en la superficie, con sombras suaves:

- **Burbujas de mensajes**: Efecto 3D suave
- **Input de chat**: Hundido en la superficie
- **Botones**: Elevados con efecto de presión
- **Colores suaves**: Paleta de grises claros con acentos morados/azules

## 🔧 Endpoints de la API

### Chat
- `POST /api/chat/message` - Enviar mensaje
- `GET /api/chat/history/:user_phone` - Obtener historial

### Usuarios
- `POST /api/users/get-or-create` - Crear/obtener usuario
- `GET /api/users/:phone` - Obtener usuario
- `PUT /api/users/:phone` - Actualizar usuario

### Transacciones
- `POST /api/transactions` - Crear transacción
- `GET /api/transactions/:user_phone` - Listar transacciones
- `GET /api/transactions/:user_phone/summary` - Resumen financiero
- `PUT /api/transactions/:id` - Actualizar
- `DELETE /api/transactions/:id` - Eliminar

### Categorías
- `GET /api/categories` - Listar categorías
- `GET /api/categories/:id` - Obtener categoría
- `POST /api/categories` - Crear categoría

### Health Check
- `GET /api/health` - Verificar estado del servidor

## 📊 Base de Datos

### Categorías Predefinidas

**Gastos:**
- 🍔 Comida
- 🚗 Transporte
- 🎮 Entretenimiento
- 💡 Servicios
- ⚕️ Salud
- 📚 Educación
- 👕 Ropa
- 🏠 Hogar
- 📦 Otros Gastos

**Ingresos:**
- 💰 Nómina
- 🤝 Ventas
- 📈 Inversiones
- 💵 Otros Ingresos

## 🤖 Integración con OpenAI

El sistema usa **OpenAI Function Calling** para interpretar mensajes. Funciones disponibles:

1. **registrar_transaccion**: Registra gastos/ingresos
2. **consultar_estado**: Consulta estado financiero
3. **listar_transacciones**: Lista movimientos recientes
4. **conversacion_general**: Saludos y conversación casual

El modelo utilizado es `gpt-4` con temperatura 0.3 para precisión.

## 🐛 Troubleshooting

### El backend no inicia

- ✅ Verifica que tienes Node.js v18+
- ✅ Verifica que instalaste las dependencias: `npm install`
- ✅ Verifica que el archivo `.env` existe y tiene tu API Key
- ✅ Revisa el puerto 3001 esté disponible

### El frontend no se conecta al backend

- ✅ Verifica que el backend esté corriendo en `http://localhost:3001`
- ✅ Revisa la consola del navegador para errores de CORS
- ✅ Verifica la variable `VITE_API_URL` en `frontend/.env`

### OpenAI no responde

- ✅ Verifica que tu API Key sea válida
- ✅ Verifica que tengas créditos en tu cuenta de OpenAI
- ✅ Revisa los logs del backend para ver el error específico

### La base de datos no se crea

- ✅ Ejecuta manualmente: `cd backend && npm run init-db`
- ✅ Verifica permisos de escritura en la carpeta `backend/`
- ✅ Elimina `database.sqlite` e intenta de nuevo

## 📝 Scripts Disponibles

### Backend

```bash
npm start         # Iniciar servidor (producción)
npm run dev       # Iniciar con nodemon (desarrollo)
npm run init-db   # Inicializar base de datos
```

### Frontend

```bash
npm run dev      # Servidor de desarrollo
npm run build    # Build para producción
npm run preview  # Preview del build
```

## 🔐 Seguridad

- **No hay autenticación tradicional**: El sistema identifica usuarios solo por número de teléfono
- **Sin passwords**: Diseñado para uso personal/demo
- **API Key segura**: Nunca expongas tu API Key de OpenAI en el frontend
- **CORS configurado**: Solo permite requests desde el frontend configurado

## 🚧 Roadmap / Próximas Features

- [ ] Presupuestos por categoría
- [ ] Recordatorios de gastos recurrentes
- [ ] Exportar a PDF/Excel
- [ ] Gráficas y visualizaciones
- [ ] Integración con WhatsApp
- [ ] Modo multi-usuario con autenticación
- [ ] Predicciones de gastos con IA
- [ ] Metas de ahorro

## 🤝 Contribuir

Este es un proyecto personal/demo. Si quieres contribuir:

1. Fork el proyecto
2. Crea una branch para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la branch (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

MIT License - Ver archivo LICENSE para más detalles

## 👤 Autor

Sistema desarrollado como proyecto de finanzas personales conversacionales.

## 🙏 Agradecimientos

- **OpenAI** por la API de GPT-4
- **React** y **Vite** por el stack frontend
- **Express.js** por el framework backend
- **better-sqlite3** por la base de datos simple

---

**¡Disfruta manejando tus finanzas conversando! 💰💬**
