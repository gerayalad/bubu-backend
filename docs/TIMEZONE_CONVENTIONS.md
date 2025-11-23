# 🌍 Convenciones de Zona Horaria - BUBU

## Resumen Ejecutivo

Todo el sistema BUBU opera en la zona horaria **America/Mexico_City (CST/CDT)**.

- **Base de datos**: Almacena timestamps con zona horaria (TIMESTAMP WITH TIME ZONE)
- **Conexión PostgreSQL**: Configurada para usar timezone México
- **Helpers de fecha**: Todos usan zona México explícitamente
- **Frontend**: Debe interpretar fechas en zona México

---

## 1. Configuración de Base de Datos

### Tipos de Datos

| Campo | Tipo | Zona Horaria | Propósito |
|-------|------|-------------|-----------|
| `created_at` | TIMESTAMP WITH TIME ZONE | México | Cuándo se creó el registro |
| `updated_at` | TIMESTAMP WITH TIME ZONE | México | Última actualización |
| `transaction_date` | DATE | N/A | Fecha del gasto (sin hora) |

### Conexión PostgreSQL

El pool de conexiones está configurado para usar timezone México:

```javascript
// backend/src/db/connection.js
pool.on('connect', async (client) => {
    await client.query("SET timezone = 'America/Mexico_City'");
});
```

Esto significa que **TODAS** las consultas SQL que usen `CURRENT_TIMESTAMP` o `NOW()` retornarán la hora de Ciudad de México automáticamente.

### Migración 005

Se aplicó la migración `005_fix_timezones_up.sql` que convirtió todos los campos `TIMESTAMP` a `TIMESTAMP WITH TIME ZONE`.

**Antes:**
```sql
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

**Después:**
```sql
created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
```

---

## 2. Helpers de Fecha (`/backend/src/utils/dateUtils.js`)

### Funciones Disponibles

#### `getTodayMexico()`
Retorna la fecha actual en México en formato `YYYY-MM-DD`.

```javascript
getTodayMexico()
// Retorna: "2025-11-20"
```

**Cuándo usar:** Para asignar `transaction_date` cuando el usuario no especifica fecha.

---

#### `toMexicoDateString(date)`
Convierte un objeto Date a formato `YYYY-MM-DD` en zona México.

```javascript
const date = new Date('2025-11-20T14:30:00Z');
toMexicoDateString(date)
// Retorna: "2025-11-20"
```

**Cuándo usar:** Para convertir fechas UTC/servidor a formato México.

---

#### `getNowMexico()`
Retorna un objeto Date ajustado a zona horaria de México.

```javascript
getNowMexico()
// Retorna: Date object con hora de México
```

**Cuándo usar:** Para operaciones que requieren la hora actual de México.

---

#### `getStartOfMonthMexico()`
Retorna el primer día del mes actual en México.

```javascript
getStartOfMonthMexico()
// Retorna: "2025-11-01"
```

**Cuándo usar:** Para filtros de "mes actual" en consultas.

---

#### `getEndOfMonthMexico()`
Retorna el último día del mes actual en México.

```javascript
getEndOfMonthMexico()
// Retorna: "2025-11-30"
```

**Cuándo usar:** Para filtros de "mes actual" en consultas.

---

#### `getISOTimestampMexico()`
Retorna timestamp ISO 8601 con offset de México.

```javascript
getISOTimestampMexico()
// Retorna: "2025-11-20T14:30:45-06:00" (CST) o "-05:00" (CDT)
```

**Cuándo usar:** Para APIs externas que requieren formato ISO con timezone.

---

#### `getTimestampMexicoForDB()` ✨ NUEVO
Retorna timestamp actual en formato compatible con PostgreSQL.

```javascript
getTimestampMexicoForDB()
// Retorna: "2025-11-20 14:30:45"
```

**Cuándo usar:** Si necesitas insertar manualmente un timestamp (normalmente NO necesario, usa `CURRENT_TIMESTAMP`).

---

#### `formatTimestampForDB(date)` ✨ NUEVO
Formatea un Date object a timestamp para BD (zona México).

```javascript
const date = new Date();
formatTimestampForDB(date)
// Retorna: "2025-11-20 14:30:45"
```

**Cuándo usar:** Para convertir un Date específico a formato BD.

---

## 3. Buenas Prácticas

### ✅ HACER

#### En SQL: Usar `CURRENT_TIMESTAMP`
```javascript
// Correcto - La conexión ya está configurada para México
const sql = `
    UPDATE users
    SET updated_at = CURRENT_TIMESTAMP
    WHERE phone = $1
`;
```

#### En Servicios: Usar helpers para `transaction_date`
```javascript
// Correcto
const finalDate = transaction_date || getTodayMexico();
```

#### En Filtros: Usar helpers para periodos
```javascript
// Correcto
const startDate = getStartOfMonthMexico();
const endDate = getEndOfMonthMexico();
```

---

### ❌ NO HACER

#### No usar `new Date()` sin conversión
```javascript
// INCORRECTO - Usará zona del servidor
const today = new Date();
const month = today.getMonth() + 1;
```

```javascript
// CORRECTO - Usa helper
const today = getNowMexico();
const month = today.getMonth() + 1;
```

#### No insertar timestamps manualmente sin necesidad
```javascript
// INCORRECTO - No necesario
const now = getTimestampMexicoForDB();
const sql = `INSERT INTO users (phone, created_at) VALUES ($1, $2)`;
await execute(sql, [phone, now]);
```

```javascript
// CORRECTO - Deja que PostgreSQL lo maneje
const sql = `INSERT INTO users (phone) VALUES ($1)`;
await execute(sql, [phone]);
// created_at se genera automáticamente con CURRENT_TIMESTAMP
```

---

## 4. Casos de Uso Comunes

### Crear una transacción
```javascript
import { getTodayMexico } from '../utils/dateUtils.js';

export async function createTransaction(data) {
    const { transaction_date } = data;

    // Si no se especifica fecha, usar hoy en México
    const finalDate = transaction_date || getTodayMexico();

    const result = await execute(`
        INSERT INTO transactions (
            user_phone, category_id, type, amount,
            description, transaction_date
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
    `, [user_phone, category_id, type, amount, description, finalDate]);

    // created_at se genera automáticamente en zona México
    return result.rows[0];
}
```

### Consultar transacciones del mes actual
```javascript
import { getStartOfMonthMexico, getEndOfMonthMexico } from '../utils/dateUtils.js';

export async function getMonthlyTransactions(user_phone) {
    const startDate = getStartOfMonthMexico(); // "2025-11-01"
    const endDate = getEndOfMonthMexico();     // "2025-11-30"

    const transactions = await query(`
        SELECT * FROM transactions
        WHERE user_phone = $1
          AND transaction_date >= $2
          AND transaction_date <= $3
        ORDER BY transaction_date DESC, created_at DESC
    `, [user_phone, startDate, endDate]);

    return transactions;
}
```

### Actualizar registro con timestamp
```javascript
export async function updateUser(phone, data) {
    // ... validaciones ...

    // CURRENT_TIMESTAMP usará automáticamente zona México
    const sql = `
        UPDATE users
        SET name = $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE phone = $2
    `;

    await execute(sql, [name, phone]);
}
```

---

## 5. Verificación

### Verificar timezone del pool
```javascript
const pool = getDatabase();
const result = await pool.query('SHOW timezone');
console.log(result.rows[0].TimeZone);
// Debe mostrar: "America/Mexico_City"
```

### Verificar tipo de columnas
```sql
SELECT
    table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name IN ('created_at', 'updated_at')
ORDER BY table_name;
```

Debe mostrar `data_type = 'timestamp with time zone'` para todas.

### Verificar timestamp actual
```javascript
const pool = getDatabase();
const result = await pool.query('SELECT NOW()');
console.log(result.rows[0].now);
// Debe mostrar hora de Ciudad de México con offset -06:00 o -05:00
```

---

## 6. Horario de Verano (Daylight Saving Time)

**México** cambia de hora dos veces al año:
- **Noviembre-Marzo**: CST (UTC-6)
- **Abril-Octubre**: CDT (UTC-5)

PostgreSQL maneja esto automáticamente cuando se configura timezone a `America/Mexico_City`.

**No necesitas hacer nada especial** - el sistema ajusta automáticamente.

---

## 7. Frontend Considerations

El frontend debe interpretar las fechas recibidas del backend como zona México.

### Ejemplo: Mostrar created_at
```javascript
// Backend retorna:
{
  id: 123,
  created_at: "2025-11-20T14:30:45.123-06:00"
}

// Frontend puede usar:
const date = new Date(transaction.created_at);
const formattedDate = date.toLocaleString('es-MX', {
  timeZone: 'America/Mexico_City',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
});
// Muestra: "20 de noviembre de 2025, 14:30"
```

---

## 8. Troubleshooting

### Problema: Timestamps se guardan en hora incorrecta

**Verificar:**
1. Que la conexión tenga el timezone configurado:
   ```sql
   SHOW timezone;
   -- Debe retornar: America/Mexico_City
   ```

2. Que las columnas sean `TIMESTAMP WITH TIME ZONE`:
   ```sql
   \d+ transactions
   -- created_at debe mostrar: timestamp with time zone
   ```

3. Que la migración 005 se haya aplicado correctamente

---

### Problema: Filtros de fecha no funcionan

**Verificar:**
1. Que uses helpers de `dateUtils.js`:
   ```javascript
   // CORRECTO
   const today = getTodayMexico();

   // INCORRECTO
   const today = new Date().toISOString().split('T')[0];
   ```

2. Que compares `transaction_date` (DATE) con strings `YYYY-MM-DD`
3. Que compares `created_at` (TIMESTAMP) con timestamps completos si es necesario

---

## 9. Resumen de Archivos Modificados

| Archivo | Cambio | Propósito |
|---------|--------|-----------|
| `/backend/src/utils/dateUtils.js` | Corregido `getISOTimestampMexico()` + 2 helpers nuevos | Cálculo correcto de offset México |
| `/backend/src/db/connection.js` | Agregado `pool.on('connect')` | Configurar timezone en todas las conexiones |
| `/backend/src/db/migrations/005_fix_timezones_up.sql` | Migración nueva | Convertir TIMESTAMP → TIMESTAMP WITH TIME ZONE |
| `/backend/src/db/migrations/005_fix_timezones_down.sql` | Migración revert | Revertir cambios si es necesario |

---

## 10. Checklist de Implementación

- [x] Helpers de fecha corregidos y nuevos agregados
- [x] Configuración de timezone en pool de conexiones
- [x] Migración SQL creada (up y down)
- [ ] **Aplicar migración en BD de producción** ⚠️
- [ ] Verificar timezone con `SHOW timezone`
- [ ] Verificar columnas con `\d+ transactions`
- [ ] Probar creación de transacciones
- [ ] Probar filtros de fecha

---

## Contacto

Para dudas sobre timezone, consultar:
- Este documento
- `/backend/src/utils/dateUtils.js` (helpers)
- `/backend/src/db/connection.js` (configuración)

**Última actualización:** 2025-11-20
