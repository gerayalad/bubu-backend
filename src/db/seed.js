/**
 * BUBU - Script de Seed para Datos de Prueba
 * Agrega datos de ejemplo para probar el sistema
 */

import getDatabase from './connection.js';

export function seedTestData() {
    console.log('🌱 Agregando datos de prueba...\n');

    const db = getDatabase();
    const userPhone = '5525384985'; // El número del usuario de la captura

    try {
        // 1. Crear usuario de prueba
        console.log('👤 Creando usuario de prueba...');
        db.prepare(`
            INSERT OR IGNORE INTO users (phone, name)
            VALUES (?, ?)
        `).run(userPhone, 'Usuario');

        // 2. Obtener IDs de categorías de gastos
        const comidaId = db.prepare('SELECT id FROM categories WHERE name = ?').get('Comida').id;
        const transporteId = db.prepare('SELECT id FROM categories WHERE name = ?').get('Transporte').id;
        const entretenimientoId = db.prepare('SELECT id FROM categories WHERE name = ?').get('Entretenimiento').id;
        const serviciosId = db.prepare('SELECT id FROM categories WHERE name = ?').get('Servicios').id;

        // 3. Agregar gastos de prueba
        console.log('💰 Agregando gastos de prueba...');

        const transactions = [
            // Mes actual - Gastos
            { date: getDateOffset(0), type: 'expense', category_id: comidaId, amount: 450, description: 'Tacos en la esquina' },
            { date: getDateOffset(-1), type: 'expense', category_id: comidaId, amount: 320, description: 'Desayuno' },
            { date: getDateOffset(-2), type: 'expense', category_id: transporteId, amount: 200, description: 'Uber a la oficina' },
            { date: getDateOffset(-3), type: 'expense', category_id: comidaId, amount: 580, description: 'Cena con amigos' },
            { date: getDateOffset(-4), type: 'expense', category_id: entretenimientoId, amount: 350, description: 'Cine' },
            { date: getDateOffset(-5), type: 'expense', category_id: serviciosId, amount: 1200, description: 'Luz' },
            { date: getDateOffset(-6), type: 'expense', category_id: transporteId, amount: 150, description: 'Gasolina' },
            { date: getDateOffset(-7), type: 'expense', category_id: comidaId, amount: 420, description: 'Supermercado' },

            // Mes pasado - Gastos
            { date: getDateOffset(-35), type: 'expense', category_id: comidaId, amount: 1200, description: 'Comida del mes' },
            { date: getDateOffset(-38), type: 'expense', category_id: transporteId, amount: 800, description: 'Transporte' },
            { date: getDateOffset(-40), type: 'expense', category_id: serviciosId, amount: 1500, description: 'Servicios' },
        ];

        const stmt = db.prepare(`
            INSERT INTO transactions (user_phone, category_id, type, amount, description, transaction_date)
            VALUES (?, ?, ?, ?, ?, ?)
        `);

        transactions.forEach(t => {
            stmt.run(userPhone, t.category_id, t.type, t.amount, t.description, t.date);
        });

        console.log(`✅ ${transactions.length} gastos agregados\n`);

        // 4. Mostrar resumen
        const summary = db.prepare(`
            SELECT
                SUM(amount) as total_expense,
                COUNT(*) as total_transactions
            FROM transactions
            WHERE user_phone = ? AND type = 'expense'
        `).get(userPhone);

        console.log('📊 Resumen de datos de prueba:');
        console.log(`   💸 Total gastado: $${summary.total_expense}`);
        console.log(`   📝 Transacciones: ${summary.total_transactions}\n`);

        console.log('✅ Datos de prueba agregados correctamente\n');

    } catch (error) {
        console.error('❌ Error agregando datos de prueba:', error);
        throw error;
    }
}

/**
 * Obtiene una fecha con offset de días desde hoy
 * @param {number} daysOffset - Días desde hoy (negativo para pasado)
 * @returns {string} Fecha en formato YYYY-MM-DD
 */
function getDateOffset(daysOffset) {
    const date = new Date();
    date.setDate(date.getDate() + daysOffset);
    return date.toISOString().split('T')[0];
}

// Si se ejecuta directamente
if (import.meta.url === `file://${process.argv[1]}`) {
    seedTestData();
    process.exit(0);
}

export default seedTestData;
