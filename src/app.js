/**
 * BUBU - Aplicación Principal del Backend
 * Sistema de Finanzas Personales Conversacional
 */

import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import routes from './routes/index.js';
import { initDatabase } from './db/init.js';

// Cargar variables de entorno
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// ============================================
// Middlewares
// ============================================

// CORS - permitir peticiones desde el frontend
app.use(cors({
    origin: (origin, callback) => {
        // Permitir localhost en cualquier puerto en desarrollo
        const allowedOrigins = [
            'http://localhost:5173',
            'http://localhost:5174',
            process.env.FRONTEND_URL
        ].filter(Boolean);

        // Si no hay origen (como en Postman) o está en la lista, permitir
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));

// Body parser - aumentar límite para permitir imágenes en base64
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Logger simple
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// ============================================
// Rutas
// ============================================

// Ruta raíz
app.get('/', (req, res) => {
    res.json({
        name: 'BUBU API',
        version: '1.0.0',
        description: 'Sistema de Finanzas Personales Conversacional',
        endpoints: {
            health: '/api/health',
            chat: '/api/chat',
            users: '/api/users',
            transactions: '/api/transactions',
            categories: '/api/categories'
        }
    });
});

// API Routes
app.use('/api', routes);

// Ruta 404
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint no encontrado'
    });
});

// ============================================
// Manejo de errores global
// ============================================

app.use((error, req, res, next) => {
    console.error('Error no manejado:', error);

    res.status(error.status || 500).json({
        success: false,
        error: error.message || 'Error interno del servidor',
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
});

// ============================================
// Inicialización
// ============================================

async function startServer() {
    try {
        // Inicializar base de datos
        console.log('🚀 Iniciando BUBU Backend...\n');
        await initDatabase();

        // Iniciar servidor
        app.listen(PORT, () => {
            console.log('\n✅ Servidor iniciado correctamente');
            console.log(`📍 URL: http://localhost:${PORT}`);
            console.log(`🌍 Entorno: ${process.env.NODE_ENV || 'development'}`);
            console.log(`🤖 OpenAI: ${process.env.OPENAI_API_KEY ? 'Configurada' : '⚠️  NO configurada'}`);
            console.log('\n📚 Endpoints disponibles:');
            console.log(`   - GET  http://localhost:${PORT}/api/health`);
            console.log(`   - POST http://localhost:${PORT}/api/chat/message`);
            console.log(`   - GET  http://localhost:${PORT}/api/categories`);
            console.log('\n💬 Listo para recibir mensajes!\n');
        });

    } catch (error) {
        console.error('❌ Error al iniciar el servidor:', error);
        process.exit(1);
    }
}

// Iniciar servidor
startServer();

export default app;
