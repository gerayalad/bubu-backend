-- ============================================
-- BUBU - Migration 004: Shared Expenses
-- Adds support for shared expenses between users
-- ============================================

-- Tabla de relaciones entre usuarios (parejas, roommates, etc.)
-- Permite configurar división por defecto de gastos compartidos
CREATE TABLE relationships (
    id SERIAL PRIMARY KEY,
    user_phone_1 VARCHAR(10) NOT NULL,
    user_phone_2 VARCHAR(10) NOT NULL,
    default_split_user1 DECIMAL(5,2) DEFAULT 50.00,
    default_split_user2 DECIMAL(5,2) DEFAULT 50.00,
    status VARCHAR(20) DEFAULT 'pending', -- pending, active, inactive, rejected
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_phone_1) REFERENCES users(phone) ON DELETE CASCADE,
    FOREIGN KEY (user_phone_2) REFERENCES users(phone) ON DELETE CASCADE,
    CONSTRAINT unique_relationship UNIQUE(user_phone_1, user_phone_2),
    CONSTRAINT valid_split CHECK(default_split_user1 + default_split_user2 = 100)
);

-- Índices para optimizar búsquedas de relaciones
CREATE INDEX idx_relationships_user1 ON relationships(user_phone_1);
CREATE INDEX idx_relationships_user2 ON relationships(user_phone_2);
CREATE INDEX idx_relationships_status ON relationships(status);

-- Tabla de transacciones compartidas
-- Vincula dos transacciones individuales como un gasto compartido
CREATE TABLE shared_transactions (
    id SERIAL PRIMARY KEY,
    transaction_id_user1 INTEGER NOT NULL,
    transaction_id_user2 INTEGER NOT NULL,
    payer_phone VARCHAR(10) NOT NULL, -- Quién pagó originalmente
    total_amount DECIMAL(10,2) NOT NULL, -- Monto total del gasto
    split_percentage_user1 DECIMAL(5,2) NOT NULL, -- Porcentaje de user1
    split_percentage_user2 DECIMAL(5,2) NOT NULL, -- Porcentaje de user2
    relationship_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (transaction_id_user1) REFERENCES transactions(id) ON DELETE CASCADE,
    FOREIGN KEY (transaction_id_user2) REFERENCES transactions(id) ON DELETE CASCADE,
    FOREIGN KEY (payer_phone) REFERENCES users(phone),
    FOREIGN KEY (relationship_id) REFERENCES relationships(id),
    CONSTRAINT valid_transaction_split CHECK(split_percentage_user1 + split_percentage_user2 = 100)
);

-- Índices para optimizar consultas de gastos compartidos
CREATE INDEX idx_shared_transactions_user1 ON shared_transactions(transaction_id_user1);
CREATE INDEX idx_shared_transactions_user2 ON shared_transactions(transaction_id_user2);
CREATE INDEX idx_shared_transactions_payer ON shared_transactions(payer_phone);
CREATE INDEX idx_shared_transactions_relationship ON shared_transactions(relationship_id);

-- Modificar tabla transactions para soportar gastos compartidos
ALTER TABLE transactions
ADD COLUMN is_shared BOOLEAN DEFAULT false,
ADD COLUMN shared_transaction_id INTEGER,
ADD CONSTRAINT fk_shared_transaction
    FOREIGN KEY (shared_transaction_id)
    REFERENCES shared_transactions(id)
    ON DELETE SET NULL;

-- Índice para filtrar transacciones compartidas
CREATE INDEX idx_transactions_shared ON transactions(is_shared);
CREATE INDEX idx_transactions_shared_id ON transactions(shared_transaction_id);

-- Comentarios de documentación
COMMENT ON TABLE relationships IS 'Relaciones entre usuarios para compartir gastos (parejas, roommates, etc.)';
COMMENT ON TABLE shared_transactions IS 'Vincula dos transacciones individuales como un gasto compartido';
COMMENT ON COLUMN relationships.default_split_user1 IS 'Porcentaje por defecto del usuario 1 (ej: 65.00)';
COMMENT ON COLUMN relationships.default_split_user2 IS 'Porcentaje por defecto del usuario 2 (ej: 35.00)';
COMMENT ON COLUMN relationships.status IS 'Estado de la relación: pending (esperando aceptación), active (activa), inactive (desactivada), rejected (rechazada)';
COMMENT ON COLUMN shared_transactions.payer_phone IS 'Teléfono del usuario que pagó el gasto completo';
COMMENT ON COLUMN shared_transactions.total_amount IS 'Monto total del gasto antes de dividir';
COMMENT ON COLUMN transactions.is_shared IS 'Indica si esta transacción es parte de un gasto compartido';
COMMENT ON COLUMN transactions.shared_transaction_id IS 'Referencia al gasto compartido si aplica';
