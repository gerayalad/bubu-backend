# ♻️ Refactor — Mejorar Código Existente

Modo especializado para refactorizar código, mejorar estructura y mantener calidad del sistema.

## Contexto del Proyecto
Sistema de finanzas personales con múltiples componentes: backend API, frontend React neumórfico, integración OpenAI, base de datos.

## Tu Tarea

Cuando refactorices código:

### 1. Identificar Qué Refactorizar
- Código duplicado
- Funciones muy largas
- Lógica compleja difícil de entender
- Nombres poco claros
- Acoplamiento alto
- Bajo nivel de abstracción
- Violaciones de principios SOLID
- Código con "code smells"

### 2. Entender el Código Actual
- Lee y comprende completamente el código existente
- Identifica todas las dependencias
- Documenta el comportamiento actual
- Asegúrate de no romper funcionalidad

### 3. Planificar la Refactorización
- Define el objetivo (¿qué mejorará?)
- Identifica pasos incrementales
- Minimiza el riesgo
- Mantén la funcionalidad constante

### 4. Refactorizar Incrementalmente
- Cambios pequeños y seguros
- Un paso a la vez
- Valida después de cada cambio
- No mezcles refactor con nuevas features

### 5. Validar
- Funcionalidad sigue igual
- Tests pasan (si existen)
- Código es más limpio y mantenible
- No se introdujeron bugs

## Tipos de Refactorización

### 1. Extract Function (Extraer Función)
**Cuando:** Fragmento de código con propósito específico

**Antes:**
```javascript
async function handleTransactionMessage(req, res) {
  const { user_phone, message } = req.body;

  // Parsear con OpenAI
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'Eres un asistente...' },
      { role: 'user', content: message }
    ],
    functions: [...]
  });

  const parsed = completion.choices[0].message;

  // Crear transacción
  const args = JSON.parse(parsed.function_call.arguments);
  const transaction = await db.run(
    'INSERT INTO transactions...',
    [user_phone, args.type, args.amount]
  );

  res.json({ success: true, transaction });
}
```

**Después:**
```javascript
async function handleTransactionMessage(req, res) {
  const { user_phone, message } = req.body;

  const parsed = await parseMessage(message);
  const transaction = await createTransaction(user_phone, parsed);

  res.json({ success: true, transaction });
}

async function parseMessage(message) {
  const completion = await openai.chat.completions.create({...});
  return completion.choices[0].message;
}

async function createTransaction(userPhone, parsed) {
  const args = JSON.parse(parsed.function_call.arguments);
  return await db.run('INSERT INTO transactions...', [...]);
}
```

---

### 2. Rename Variable/Function (Renombrar)
**Cuando:** Nombres poco descriptivos

**Antes:**
```javascript
async function proc(d) {
  const r = await db.all('SELECT * FROM transactions WHERE user_phone = ?', [d]);
  return r;
}
```

**Después:**
```javascript
async function getUserTransactions(userPhone) {
  const transactions = await db.all(
    'SELECT * FROM transactions WHERE user_phone = ?',
    [userPhone]
  );
  return transactions;
}
```

---

### 3. Extract Constant (Extraer Constante)
**Cuando:** Valores mágicos repetidos

**Antes:**
```javascript
if (amount > 100000) {
  // alerta de monto grande
}

// En otro lugar
const limit = 100000;
```

**Después:**
```javascript
const LARGE_TRANSACTION_THRESHOLD = 100000;

if (amount > LARGE_TRANSACTION_THRESHOLD) {
  // alerta de monto grande
}
```

---

### 4. Simplify Conditional (Simplificar Condicional)
**Cuando:** Condicionales complejos

**Antes:**
```javascript
if (type === 'expense' && amount > 0 && category && date) {
  return true;
}
return false;
```

**Después:**
```javascript
function isValidExpense(type, amount, category, date) {
  return type === 'expense'
    && amount > 0
    && category
    && date;
}

if (isValidExpense(type, amount, category, date)) {
  // ...
}
```

---

### 5. Remove Duplication (Eliminar Duplicación)
**Cuando:** Código repetido en múltiples lugares

**Antes:**
```javascript
// En transactionController.js
const user = await db.get('SELECT * FROM users WHERE phone = ?', [phone]);
if (!user) {
  await db.run('INSERT INTO users (phone) VALUES (?)', [phone]);
}

// En queryController.js
const user = await db.get('SELECT * FROM users WHERE phone = ?', [phone]);
if (!user) {
  await db.run('INSERT INTO users (phone) VALUES (?)', [phone]);
}
```

**Después:**
```javascript
// En models/User.js
async function ensureUserExists(phone) {
  const user = await db.get('SELECT * FROM users WHERE phone = ?', [phone]);
  if (!user) {
    await db.run('INSERT INTO users (phone) VALUES (?)', [phone]);
  }
  return user || { phone };
}

// Usar en ambos controladores
const user = await ensureUserExists(phone);
```

---

### 6. Introduce Parameter Object (Objeto de Parámetros)
**Cuando:** Muchos parámetros en una función

**Antes:**
```javascript
async function createTransaction(userPhone, type, amount, category, date, description) {
  // ...
}

await createTransaction('5512345678', 'expense', 350, 'alimentos', '2025-11-17', 'tacos');
```

**Después:**
```javascript
async function createTransaction(transactionData) {
  const { userPhone, type, amount, category, date, description } = transactionData;
  // ...
}

await createTransaction({
  userPhone: '5512345678',
  type: 'expense',
  amount: 350,
  category: 'alimentos',
  date: '2025-11-17',
  description: 'tacos'
});
```

---

### 7. Replace Magic Number (Reemplazar Número Mágico)
**Cuando:** Números sin contexto

**Antes:**
```javascript
const recent = transactions.slice(0, 50);
```

**Después:**
```javascript
const DEFAULT_TRANSACTION_LIMIT = 50;
const recent = transactions.slice(0, DEFAULT_TRANSACTION_LIMIT);
```

---

### 8. Split Large Function (Dividir Función Grande)
**Cuando:** Función hace muchas cosas

**Antes:**
```javascript
async function processMessage(message, userPhone) {
  // 1. Parse message (20 líneas)
  // 2. Validate (15 líneas)
  // 3. Create transaction (20 líneas)
  // 4. Generate response (25 líneas)
  // Total: 80 líneas
}
```

**Después:**
```javascript
async function processMessage(message, userPhone) {
  const parsed = await parseMessage(message);
  validateParsedData(parsed);
  const transaction = await createTransaction(userPhone, parsed);
  return generateConfirmation(transaction);
}

// Cada función con responsabilidad única
```

---

### 9. Improve Error Handling (Mejorar Manejo de Errores)
**Cuando:** Manejo de errores inconsistente

**Antes:**
```javascript
async function getUser(phone) {
  const user = await db.get('SELECT * FROM users WHERE phone = ?', [phone]);
  return user;
}

// Uso
const user = await getUser(phone);
if (user.name) { // Puede fallar si user es null
  //...
}
```

**Después:**
```javascript
async function getUser(phone) {
  try {
    const user = await db.get('SELECT * FROM users WHERE phone = ?', [phone]);
    if (!user) {
      throw new Error(`User not found: ${phone}`);
    }
    return user;
  } catch (error) {
    logger.error('Error getting user:', error);
    throw error;
  }
}

// Uso con manejo apropiado
try {
  const user = await getUser(phone);
  // Seguro usar user.name
} catch (error) {
  // Manejar error
}
```

---

### 10. Use Async/Await Consistently (Uso Consistente de Async/Await)
**Cuando:** Mezcla de callbacks, promises y async/await

**Antes:**
```javascript
function getTransactions(phone) {
  return db.all('SELECT * FROM transactions WHERE user_phone = ?', [phone])
    .then(rows => {
      return rows.map(r => ({
        ...r,
        amount: parseFloat(r.amount)
      }));
    });
}
```

**Después:**
```javascript
async function getTransactions(phone) {
  const rows = await db.all(
    'SELECT * FROM transactions WHERE user_phone = ?',
    [phone]
  );

  return rows.map(r => ({
    ...r,
    amount: parseFloat(r.amount)
  }));
}
```

## Code Smells a Buscar

### 1. **Long Function** (Función larga)
- Más de 20-30 líneas
- Solución: Extract Function

### 2. **Large Class** (Clase grande)
- Demasiadas responsabilidades
- Solución: Split Class, Extract Class

### 3. **Duplicated Code** (Código duplicado)
- Mismo código en múltiples lugares
- Solución: Extract Function, Extract Constant

### 4. **Long Parameter List** (Lista larga de parámetros)
- Más de 3-4 parámetros
- Solución: Parameter Object

### 5. **Divergent Change** (Cambios divergentes)
- Un archivo cambia por muchas razones
- Solución: Split Module

### 6. **Shotgun Surgery** (Cirugía de escopeta)
- Un cambio requiere tocar muchos archivos
- Solución: Centralizar lógica

### 7. **Feature Envy** (Envidia de features)
- Función usa más datos de otra clase que de la propia
- Solución: Move Function

### 8. **Comments** (Comentarios excesivos)
- Código necesita muchos comentarios para entenderse
- Solución: Rename, Extract Function con nombres claros

### 9. **Magic Numbers** (Números mágicos)
- Números sin contexto
- Solución: Extract Constant

### 10. **Nested Conditionals** (Condicionales anidados)
- if dentro de if dentro de if
- Solución: Guard Clauses, Extract Function

## Principios a Seguir

### DRY (Don't Repeat Yourself)
No repitas código. Extrae funciones comunes.

### KISS (Keep It Simple, Stupid)
Mantén el código simple. No sobre-ingenierices.

### YAGNI (You Aren't Gonna Need It)
No agregues complejidad para "por si acaso".

### Single Responsibility Principle
Cada función/clase debe tener una sola responsabilidad.

### Separation of Concerns
Separa lógica de negocio, de presentación, de datos.

## Proceso de Refactorización Segura

1. **Entender el código actual**
   - Lee y comprende completamente
   - Identifica todas las dependencias
   - Documenta comportamiento actual

2. **Escribir tests (si no existen)**
   - Al menos tests manuales
   - Documenta casos de prueba

3. **Hacer cambios pequeños**
   - Un refactor a la vez
   - Commits frecuentes

4. **Validar después de cada cambio**
   - Funcionalidad sigue igual
   - Tests pasan

5. **Iterar**
   - Continúa mejorando
   - No intentes perfección en un solo paso

## Template de Refactorización

```markdown
## ♻️ Refactor: [Área/Función]

### 🎯 Objetivo
[Qué quieres mejorar y por qué]

### 📊 Estado Actual
[Descripción del código actual y sus problemas]

### ✨ Estado Deseado
[Cómo será después del refactor]

### 📝 Plan de Refactorización
1. [ ] Paso 1
2. [ ] Paso 2
3. [ ] Paso 3

### ⚠️ Riesgos
[Qué podría romperse]

### ✅ Validación
[Cómo confirmar que todo sigue funcionando]
```

## Checklist de Refactorización

Antes de dar por terminado:

- [ ] Funcionalidad es idéntica a antes
- [ ] Código es más legible
- [ ] Nombres son más descriptivos
- [ ] Duplicación reducida o eliminada
- [ ] Funciones tienen responsabilidad única
- [ ] Complejidad reducida
- [ ] Manejo de errores mejorado
- [ ] Sin "magic numbers"
- [ ] Comentarios eliminados o reducidos (código auto-explicativo)
- [ ] Tests pasan (si existen)

## Instrucciones Finales

Refactoriza con cuidado y de forma incremental. El código debe mejorar sin romper funcionalidad. Valida constantemente.
