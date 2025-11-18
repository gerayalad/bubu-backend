-- ============================================
-- BUBU - Sistema de Finanzas Personales
-- Schema de Base de Datos PostgreSQL
-- ============================================

-- Tabla de usuarios
-- Identificador natural: número de teléfono (10 dígitos MX)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    phone VARCHAR(10) UNIQUE NOT NULL,
    name VARCHAR(100),
    alias VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índice para búsquedas por teléfono
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);

-- Tabla de categorías
-- Catálogo de categorías de ingresos/gastos
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    type VARCHAR(10) NOT NULL CHECK(type IN ('income', 'expense')),
    color VARCHAR(7) DEFAULT '#6B7280',
    icon VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índice para búsquedas por tipo
CREATE INDEX IF NOT EXISTS idx_categories_type ON categories(type);

-- Tabla de transacciones
-- Movimientos individuales (ingresos o gastos)
CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    user_phone VARCHAR(10) NOT NULL,
    category_id INTEGER NOT NULL,
    type VARCHAR(10) NOT NULL CHECK(type IN ('income', 'expense')),
    amount DECIMAL(10,2) NOT NULL,
    description TEXT,
    transaction_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_phone) REFERENCES users(phone) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id)
);

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_phone);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);

-- Tabla de mensajes del chat (auditoría)
-- Registra todos los mensajes procesados
CREATE TABLE IF NOT EXISTS chat_messages (
    id SERIAL PRIMARY KEY,
    user_phone VARCHAR(10) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'user',
    message TEXT NOT NULL,
    intent_json TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_phone) REFERENCES users(phone) ON DELETE CASCADE
);

-- Índice para historial de mensajes
CREATE INDEX IF NOT EXISTS idx_chat_user ON chat_messages(user_phone, created_at DESC);

-- ============================================
-- Datos iniciales: Categorías predefinidas
-- ============================================

-- Categorías de Gastos
INSERT INTO categories (name, type, color, icon) VALUES
    ('Comida', 'expense', '#EF4444', '🍔'),
    ('Transporte', 'expense', '#F59E0B', '🚗'),
    ('Entretenimiento', 'expense', '#8B5CF6', '🎮'),
    ('Servicios', 'expense', '#3B82F6', '💡'),
    ('Salud', 'expense', '#10B981', '⚕️'),
    ('Educación', 'expense', '#06B6D4', '📚'),
    ('Ropa', 'expense', '#EC4899', '👕'),
    ('Hogar', 'expense', '#6366F1', '🏠'),
    ('Otros Gastos', 'expense', '#6B7280', '📦')
ON CONFLICT (name) DO NOTHING;

-- Categorías de Ingresos
INSERT INTO categories (name, type, color, icon) VALUES
    ('Nómina', 'income', '#22C55E', '💰'),
    ('Ventas', 'income', '#14B8A6', '🤝'),
    ('Inversiones', 'income', '#F59E0B', '📈'),
    ('Otros Ingresos', 'income', '#6B7280', '💵')
ON CONFLICT (name) DO NOTHING;
