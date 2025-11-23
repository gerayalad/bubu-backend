# 📝 Changelog - Sprint 2: AI Integration (Gastos Compartidos)

## Información General

**Feature:** Gastos Compartidos con División Configurable
**Sprint:** 2 de 4
**Fecha:** 2025-11-20
**Autor:** Claude Code
**Estimación:** 8 horas
**Estado:** ✅ Completado

## 🎯 Objetivos del Sprint 2

- [x] Modificar `openaiService.js` para agregar nuevos intents de gastos compartidos
- [x] Modificar intent `registrar_transaccion` para detectar gastos compartidos
- [x] Crear handlers en `chatController.js` para los nuevos intents
- [x] Modificar `handleRegistrarTransaccion` para procesar gastos compartidos
- [x] Modificar `generateNaturalResponse` para formatear respuestas de gastos compartidos
- [x] Verificar sintaxis JavaScript de todos los cambios

## 📦 Archivos Modificados

### 1. `src/services/openaiService.js`

**Propósito:** Agregar capacidad de detección de intents relacionados con gastos compartidos

#### Cambios Realizados:

**A. Modificación del intent `registrar_transaccion` (líneas 20-67)**

Se agregaron 4 nuevos parámetros para detectar gastos compartidos:

```javascript
{
    name: 'registrar_transaccion',
    description: '... GASTOS COMPARTIDOS: Detecta si dice "pagué yo", "pagó mi pareja", "50/50", "partes iguales", "mitad", "40/60", etc.',
    parameters: {
        // ... parámetros existentes ...

        // NUEVOS PARÁMETROS:
        es_compartido: {
            type: 'boolean',
            description: 'true si menciona "pagué yo", "pagó mi pareja", o especifica división (50/50, etc.)'
        },
        quien_pago: {
            type: 'string',
            enum: ['yo', 'pareja', null],
            description: 'Quién pagó el gasto'
        },
        split_custom_user: {
            type: 'number',
            description: 'Porcentaje custom del usuario si especifica división'
        },
        split_custom_partner: {
            type: 'number',
            description: 'Porcentaje custom de la pareja'
        }
    }
}
```

**Ejemplos de detección:**
- "Gasté 200 en comida, pagué yo" → `es_compartido: true, quien_pago: 'yo'`
- "Gasté 200 en comida, pagó mi pareja" → `es_compartido: true, quien_pago: 'pareja'`
- "Gasté 200 en comida, 50/50" → `es_compartido: true, split_custom_user: 50, split_custom_partner: 50`
- "Gasté 200 en comida" → `es_compartido: false` (gasto individual)

**B. Nuevos Intents Agregados (líneas 379-454)**

Se agregaron 4 nuevos intents ANTES de `conversacion_general`:

**1. `registrar_pareja` (líneas 379-403)**

```javascript
{
    name: 'registrar_pareja',
    description: 'Registra una relación con otra persona para compartir gastos...',
    parameters: {
        partner_phone: 'string',      // Teléfono de 10 dígitos
        partner_name: 'string',       // Opcional
        split_user: 'number',         // Default 50
        split_partner: 'number'       // Default 50
    }
}
```

**Ejemplos de activación:**
- "Quiero registrar a mi pareja"
- "Registrar a mi roommate con el número 5511112222"
- "Quiero compartir gastos con mi pareja"

**2. `consultar_balance` (líneas 404-417)**

```javascript
{
    name: 'consultar_balance',
    description: 'Consulta el balance de gastos compartidos...',
    parameters: {
        periodo: 'string'  // mes_actual, mes_pasado, todos
    }
}
```

**Ejemplos de activación:**
- "¿Cómo va el balance con mi pareja?"
- "¿Quién debe a quién?"
- "Muéstrame el balance del mes pasado"

**3. `listar_gastos_compartidos` (líneas 418-436)**

```javascript
{
    name: 'listar_gastos_compartidos',
    description: 'Lista los gastos compartidos con la pareja...',
    parameters: {
        periodo: 'string',     // mes_actual, mes_pasado, todos
        categoria: 'string'    // Opcional
    }
}
```

**Ejemplos de activación:**
- "Muéstrame los gastos compartidos"
- "Lista los gastos con mi pareja de este mes"
- "¿Qué gastos compartidos tenemos en comida?"

**4. `actualizar_division_default` (líneas 437-454)**

```javascript
{
    name: 'actualizar_division_default',
    description: 'Actualiza la división por defecto...',
    parameters: {
        split_user: 'number',
        split_partner: 'number'
    }
}
```

**Ejemplos de activación:**
- "Cambiar la división a 60/40"
- "Quiero que sea 50/50 por defecto"
- "Actualizar división a 65% yo y 35% mi pareja"

**C. Modificación de `generateNaturalResponse` (líneas 706-729)**

Se modificó el case de `registrar_transaccion` para diferenciar entre gastos individuales y compartidos:

```javascript
case 'registrar_transaccion':
    // Detectar si es gasto compartido
    if (result.is_shared) {
        // Gasto compartido
        const whoPaid = result.payer_phone === data.userPhone ? 'tú' : 'tu pareja';
        prompt = `El usuario registró un GASTO COMPARTIDO:
- Total: $${result.total_amount}
- Pagó: ${whoPaid}
- División: Usuario ${result.user_percentage}% ($${result.user_amount}) / Pareja ${result.partner_percentage}% ($${result.partner_amount})
...
Genera una confirmación breve y clara (2-3 líneas) que:
1. Confirme que se registró el gasto compartido
2. Mencione el total y quién pagó
3. Muestre la división (porcentajes y montos de cada uno)`;
    } else {
        // Gasto individual (comportamiento original)
        prompt = `El usuario registró una transacción: ${JSON.stringify(result)}.
Genera una confirmación breve y amigable (1-2 líneas) confirmando que se registró...`;
    }
    break;
```

**Ejemplo de respuesta generada para gasto compartido:**
```
✅ Registré el gasto compartido de $200 en Comida. Tú pagaste todo, pero se divide: tú 65% ($130) y tu pareja 35% ($70).
```

**Ejemplo de respuesta generada para gasto individual:**
```
✅ Registré tu gasto de $200 en Comida.
```

---

### 2. `src/controllers/chatController.js`

**Propósito:** Procesar los nuevos intents y modificar el flujo de registro de transacciones

#### Cambios Realizados:

**A. Imports Agregados (líneas 16-18)**

```javascript
import { createRelationship, getRelationship, updateDefaultSplitByPhone } from '../services/relationshipService.js';
import { createSharedTransaction, getSharedTransactions, getSplitInfo } from '../services/sharedTransactionService.js';
import { calculateBalance, getSharedTransactionsForBalance } from '../services/balanceService.js';
```

**B. Switch Cases Agregados (líneas 251-269)**

Se agregaron 4 nuevos cases en el switch principal:

```javascript
case 'registrar_pareja':
    result = await handleRegistrarPareja(user_phone, intent.parameters);
    response = result.response;
    break;

case 'consultar_balance':
    result = await handleConsultarBalance(user_phone, intent.parameters);
    response = result.response;
    break;

case 'listar_gastos_compartidos':
    result = await handleListarGastosCompartidos(user_phone, intent.parameters);
    response = result.response;
    break;

case 'actualizar_division_default':
    result = await handleActualizarDivisionDefault(user_phone, intent.parameters);
    response = result.response;
    break;
```

**C. Modificación de `handleRegistrarTransaccion` (líneas 340-452)**

Se modificó completamente la función para detectar y procesar gastos compartidos:

**Antes (gasto individual solamente):**
```javascript
async function handleRegistrarTransaccion(user_phone, params) {
    const { tipo, monto, descripcion, categoria, fecha } = params;

    // ... validaciones de categoría ...

    const transaction = await createTransaction({...});
    saveLastTransaction(user_phone, transaction);
    return transaction;
}
```

**Después (con soporte para gastos compartidos):**
```javascript
async function handleRegistrarTransaccion(user_phone, params) {
    const {
        tipo, monto, descripcion, categoria, fecha,
        es_compartido, quien_pago, split_custom_user, split_custom_partner
    } = params;

    // ... validaciones de categoría ...

    // ============ GASTO COMPARTIDO ============
    if (es_compartido === true) {
        console.log(`💑 Detectado gasto compartido: ${user_phone} | Pagó: ${quien_pago || 'yo'}`);

        // 1. Verificar que tenga pareja registrada
        const relationship = await getRelationship(user_phone);
        if (!relationship) {
            throw new Error('No tienes una pareja registrada...');
        }

        // 2. Verificar que la relación esté activa
        if (relationship.status !== 'active') {
            throw new Error('Tu pareja aún no ha aceptado la solicitud...');
        }

        // 3. Obtener información de división (custom o default)
        const splitInfo = await getSplitInfo(
            user_phone,
            split_custom_user,
            split_custom_partner
        );

        // 4. Determinar quién pagó
        let payer_phone = quien_pago === 'pareja'
            ? splitInfo.partner_phone
            : user_phone;

        // 5. Crear gasto compartido (2 transacciones)
        const sharedTransaction = await createSharedTransaction({
            payer_phone,
            partner_phone: splitInfo.partner_phone,
            total_amount: monto,
            category_id: category.id,
            type,
            description: descripcion,
            split_user1: splitInfo.user_split,
            split_user2: splitInfo.partner_split,
            transaction_date: transactionDate,
            relationship_id: relationship.id
        });

        // 6. Guardar referencia
        saveLastTransaction(user_phone, {
            id: sharedTransaction.user_transaction_id,
            amount: sharedTransaction.user_amount,
            type,
            description: descripcion,
            category_id: category.id,
            is_shared: true,
            shared_transaction_id: sharedTransaction.shared_transaction_id
        });

        // 7. Retornar con metadata completa
        return {
            ...sharedTransaction,
            category_name: category.name,
            category_icon: category.icon,
            is_shared: true
        };
    }

    // ============ GASTO INDIVIDUAL ============
    console.log(`👤 Gasto individual: ${user_phone}`);

    const transaction = await createTransaction({...});
    saveLastTransaction(user_phone, transaction);
    return transaction;
}
```

**Flujo de Validación:**

1. ✅ Detecta si `es_compartido === true`
2. ✅ Verifica que el usuario tenga una relación registrada
3. ✅ Verifica que la relación esté en estado `active`
4. ✅ Obtiene división (custom override o default de la relación)
5. ✅ Determina quién pagó (usuario o pareja)
6. ✅ Crea 2 transacciones vinculadas
7. ✅ Retorna objeto completo con metadata

**D. Nuevos Handler Functions Agregados (líneas 1562-1802)**

**1. `handleRegistrarPareja` (líneas 1562-1624)**

```javascript
async function handleRegistrarPareja(user_phone, params) {
    const { partner_phone, partner_name, split_user = 50, split_partner = 50 } = params;

    // Validar teléfono (10 dígitos)
    if (!partner_phone || !/^\d{10}$/.test(partner_phone)) {
        return { response: 'El teléfono debe tener 10 dígitos...' };
    }

    // Validar split suma 100%
    if (split_user + split_partner !== 100) {
        return { response: 'La división debe sumar 100%...' };
    }

    // Crear relación (status: pending)
    const relationship = await createRelationship({
        user_phone_1: user_phone,
        user_phone_2: partner_phone,
        default_split_user1: split_user,
        default_split_user2: split_partner
    });

    return {
        relationship,
        response: `✅ Solicitud enviada a ${partner_name || partner_phone}...\n\n📊 División configurada: Tú ${split_user}% / ${partner_name || 'Tu pareja'} ${split_partner}%\n\n⏳ Tu pareja debe aceptar la solicitud para empezar a registrar gastos compartidos.`
    };
}
```

**2. `handleConsultarBalance` (líneas 1629-1691)**

```javascript
async function handleConsultarBalance(user_phone, params) {
    const { periodo = 'mes_actual' } = params;

    const relationship = await getRelationship(user_phone);
    if (!relationship) {
        return { response: 'No tienes una pareja registrada...' };
    }

    const partner_phone = relationship.user_phone_1 === user_phone
        ? relationship.user_phone_2
        : relationship.user_phone_1;

    const balance = await calculateBalance(user_phone, partner_phone, periodo);

    // Generar respuesta formateada
    const periodoTexto = {
        'mes_actual': 'este mes',
        'mes_pasado': 'el mes pasado',
        'todos': 'en total'
    };

    let debtMessage = '';
    if (balance.who_owes_whom === 'partner_owes_user') {
        debtMessage = `✅ Tu pareja te debe: $${balance.amount_owed}`;
    } else if (balance.who_owes_whom === 'user_owes_partner') {
        debtMessage = `⚠️ Le debes a tu pareja: $${balance.amount_owed}`;
    } else {
        debtMessage = `💚 Están balanceados (no hay deuda)`;
    }

    const response = `💰 Balance de gastos compartidos (${periodoTexto[periodo]})

📊 Resumen:
• Total gastos compartidos: $${balance.total_shared_expenses}
• Número de gastos: ${balance.expense_count}

👤 Tú:
• Pagaste: $${balance.user.paid_total} (${balance.user.paid_count} gastos)
• Debes: $${balance.user.owes_total}
• Balance: $${balance.user.balance}

👥 Tu pareja:
• Pagó: $${balance.partner.paid_total} (${balance.partner.paid_count} gastos)
• Debe: $${balance.partner.owes_total}
• Balance: $${balance.partner.balance}

${debtMessage}`;

    return { balance, response };
}
```

**3. `handleListarGastosCompartidos` (líneas 1696-1756)**

```javascript
async function handleListarGastosCompartidos(user_phone, params) {
    const { periodo = 'mes_actual', categoria } = params;

    let expenses = await getSharedTransactionsForBalance(user_phone, periodo);

    // Filtrar por categoría si se especificó
    if (categoria) {
        expenses = expenses.filter(e =>
            e.category.name.toLowerCase().includes(categoria.toLowerCase())
        );
    }

    if (expenses.length === 0) {
        return {
            expenses: [],
            response: `No encontré gastos compartidos${categoria ? ` en ${categoria}` : ''} en ${periodoTexto[periodo]}.`
        };
    }

    // Generar lista formateada
    const list = expenses.map((e, i) => {
        const paidBy = e.paid_by_user ? 'Pagaste tú' : 'Pagó tu pareja';
        return `${i + 1}. ${e.category.icon} $${e.total_amount} - ${e.description}
   ${paidBy} | Tu parte: ${e.user_percentage}% ($${e.user_amount})
   Fecha: ${e.transaction_date}`;
    }).join('\n\n');

    const response = `📋 Gastos compartidos (${periodoTexto[periodo]})${categoria ? ` - ${categoria}` : ''}

${list}

💡 Total: ${expenses.length} gasto${expenses.length > 1 ? 's' : ''}`;

    return { expenses, response };
}
```

**4. `handleActualizarDivisionDefault` (líneas 1761-1802)**

```javascript
async function handleActualizarDivisionDefault(user_phone, params) {
    const { split_user, split_partner } = params;

    // Validar que sume 100%
    if (split_user + split_partner !== 100) {
        return {
            response: `❌ La división debe sumar 100%. Recibí ${split_user}% + ${split_partner}% = ${split_user + split_partner}%`
        };
    }

    // Actualizar división
    const updated = await updateDefaultSplitByPhone(
        user_phone,
        split_user,
        split_partner
    );

    return {
        updated,
        response: `✅ División actualizada: Tú ${split_user}% / Tu pareja ${split_partner}%

Esta será la división por defecto para tus próximos gastos compartidos. Siempre puedes especificar una división diferente al momento de registrar el gasto.`
    };
}
```

## 📊 Estadísticas del Sprint 2

### Líneas de Código Modificadas

| Archivo | Líneas Agregadas | Líneas Modificadas | Total Cambios |
|---------|------------------|-------------------|---------------|
| `openaiService.js` | 95 | 15 | 110 |
| `chatController.js` | 295 | 25 | 320 |
| **Total** | **390** | **40** | **430** |

### Funciones Creadas/Modificadas

**En `chatController.js`:**
- ✅ `handleRegistrarTransaccion` - MODIFICADA (ahora detecta compartidos)
- ✅ `handleRegistrarPareja` - NUEVA
- ✅ `handleConsultarBalance` - NUEVA
- ✅ `handleListarGastosCompartidos` - NUEVA
- ✅ `handleActualizarDivisionDefault` - NUEVA

**En `openaiService.js`:**
- ✅ Intent `registrar_transaccion` - MODIFICADO (4 nuevos parámetros)
- ✅ Intent `registrar_pareja` - NUEVO
- ✅ Intent `consultar_balance` - NUEVO
- ✅ Intent `listar_gastos_compartidos` - NUEVO
- ✅ Intent `actualizar_division_default` - NUEVO
- ✅ `generateNaturalResponse` case `registrar_transaccion` - MODIFICADO

**Total:** 5 funciones nuevas, 2 funciones modificadas

## ✅ Testing y Verificación

### Sintaxis Verificada

```bash
✅ node --check src/services/openaiService.js
✅ node --check src/controllers/chatController.js
```

Ambos archivos tienen sintaxis JavaScript válida.

### Flujos a Testear Manualmente (Sprint 3)

**Flujo 1: Gasto Individual (sin cambios)**
```
Usuario: "Gasté 200 en comida"
Esperado: Gasto individual, NO compartido
```

**Flujo 2: Gasto Compartido con Default Split**
```
Usuario: "Gasté 200 en comida, pagué yo"
Esperado:
- Detecta es_compartido = true
- Detecta quien_pago = 'yo'
- Usa división default (65/35 o 50/50)
- Crea 2 transacciones
- Respuesta muestra total y división
```

**Flujo 3: Gasto Compartido con Custom Split**
```
Usuario: "Gasté 200 en comida, pagué yo 50/50"
Esperado:
- Detecta es_compartido = true
- Detecta quien_pago = 'yo'
- Detecta split_custom_user = 50, split_custom_partner = 50
- Crea 2 transacciones con 50/50
- Respuesta muestra división custom
```

**Flujo 4: Gasto Pagado por Pareja**
```
Usuario: "Mi pareja pagó 200 en comida"
Esperado:
- Detecta es_compartido = true
- Detecta quien_pago = 'pareja'
- payer_phone = partner_phone
- Crea 2 transacciones
```

**Flujo 5: Sin Pareja Registrada**
```
Usuario: "Gasté 200 en comida, pagué yo"
Esperado:
- Detecta es_compartido = true
- Error: "No tienes una pareja registrada..."
```

**Flujo 6: Registrar Pareja**
```
Usuario: "Quiero registrar a mi pareja con el número 5511112222"
Esperado:
- Crea relationship con status 'pending'
- Mensaje con división configurada
```

**Flujo 7: Consultar Balance**
```
Usuario: "¿Cómo va el balance con mi pareja?"
Esperado:
- Muestra balance completo
- Indica quién debe a quién
```

## 🔒 Validaciones Implementadas

### En `handleRegistrarTransaccion`:

1. ✅ **Relación Registrada**: Verifica que exista relación antes de crear gasto compartido
2. ✅ **Relación Activa**: Solo permite gastos compartidos si status = 'active'
3. ✅ **División Custom**: Valida que los porcentajes custom sumen 100% (en `getSplitInfo`)
4. ✅ **Pagador**: Determina correctamente quién pagó (usuario o pareja)

### En `handleRegistrarPareja`:

1. ✅ **Formato de Teléfono**: Valida que sea 10 dígitos
2. ✅ **División Suma 100%**: Valida que split_user + split_partner = 100
3. ✅ **Relación Duplicada**: El service `createRelationship` valida duplicados

### En `handleActualizarDivisionDefault`:

1. ✅ **División Suma 100%**: Valida antes de actualizar

## 🎯 Próximos Pasos

### Sprint 3: User Experience (7h) ⏳ PENDIENTE

- [ ] Implementar flujo de aceptación de relación (cuando la pareja recibe solicitud)
- [ ] Implementar notificaciones WhatsApp a la pareja cuando se crea gasto compartido
- [ ] Mejorar respuestas formateadas con emojis y estructura clara
- [ ] Implementar comando para rechazar solicitud de pareja
- [ ] Actualizar tutorial con nuevos comandos
- [ ] Testing de UX con usuarios reales

### Sprint 4: Testing y Documentation (5h) ⏳ PENDIENTE

- [ ] Integration tests E2E de flujos completos
- [ ] Edge cases (división 0%, montos negativos, etc.)
- [ ] Documentación final de API
- [ ] Guía de usuario para gastos compartidos
- [ ] Verificación pre-deploy

## 📝 Notas Importantes

### Detección de Gastos Compartidos

El sistema detecta gastos compartidos cuando el usuario dice:

**Indicadores de "Pagué yo":**
- "pagué yo"
- "lo pagué yo"
- "yo pagué"
- Implícito cuando dice división: "50/50", "partes iguales", "mitad"

**Indicadores de "Pagó pareja":**
- "pagó mi pareja"
- "mi pareja pagó"
- "pagó mi novio/novia"
- "pagó mi esposo/esposa"

**Indicadores de División Custom:**
- "50/50", "60/40", "65/35", etc.
- "partes iguales"
- "mitad"
- "70% yo y 30% mi pareja"

**NO se detecta como compartido:**
- "Gasté 200 en comida" (sin mención de pago o división)
- "Me llegó la nómina de 15000" (ingresos individuales)

### Backward Compatibility

✅ **100% compatible con gastos individuales:**
- Usuarios sin pareja pueden seguir usando BUBU normalmente
- Si no menciona "pagué yo" o división, el gasto es individual
- Transacciones existentes no se ven afectadas
- Nuevos parámetros en `registrar_transaccion` son opcionales

### Para Deployment

1. **Antes de deploy:** Aplicar migration de Sprint 1 si no se ha aplicado
2. **Orden:** Migration primero, luego código
3. **Testing:** Probar flujo individual primero, luego compartido
4. **Rollback:** Si falla, seguir `ROLLBACK_PLAN.md`

## 🐛 Bugs Conocidos

Ninguno detectado en Sprint 2. El código compila sin errores.

## 🔗 Dependencias con Sprint 1

Este Sprint 2 depende de:
- ✅ Tablas `relationships` y `shared_transactions` (creadas en Sprint 1)
- ✅ Servicios `relationshipService.js`, `sharedTransactionService.js`, `balanceService.js` (Sprint 1)
- ✅ Columnas `is_shared` y `shared_transaction_id` en tabla `transactions` (Sprint 1)

## 📋 Checklist Pre-Deploy Sprint 2

Antes de liberar a producción:

- [x] Sintaxis verificada en ambos archivos
- [ ] Testing manual de flujo individual (confirmar no rompimos nada)
- [ ] Testing manual de flujo compartido con pareja registrada
- [ ] Testing manual de error sin pareja registrada
- [ ] Testing de detección de intent para cada caso
- [ ] Verificar que migration de Sprint 1 está aplicada en producción
- [ ] Backup de base de datos
- [ ] Plan de rollback listo

---

**Sprint 2 Status:** ✅ COMPLETADO (Código)

**Siguiente:** Sprint 3 - User Experience (notificaciones, flujos de aceptación, tutorial)

**Última actualización:** 2025-11-20
