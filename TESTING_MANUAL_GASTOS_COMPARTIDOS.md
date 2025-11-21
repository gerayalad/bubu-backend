# 🧪 Guía de Testing Manual - Gastos Compartidos

## Información General

**Feature:** Gastos Compartidos con División Configurable
**Versión:** 1.0.0
**Fecha:** 2025-11-20
**Sprints:** 1, 2, 3

## 📋 Preparación del Testing

### Requisitos Previos

- [ ] Migration `004_shared_expenses_up.sql` aplicada
- [ ] Servidor backend corriendo sin errores
- [ ] WhatsApp Business API configurada
- [ ] Variables de entorno configuradas:
  - `WHATSAPP_PHONE_NUMBER_ID`
  - `WHATSAPP_TOKEN`
  - `WEBHOOK_VERIFY_TOKEN`
- [ ] Dos números de WhatsApp para testing (Usuario A y Usuario B)

### Verificación de Base de Datos

Ejecutar estos queries antes de empezar:

```sql
-- Verificar que las tablas existen
SELECT table_name FROM information_schema.tables
WHERE table_name IN ('relationships', 'shared_transactions');
-- Esperado: 2 rows

-- Verificar columnas en transactions
SELECT column_name FROM information_schema.columns
WHERE table_name = 'transactions'
  AND column_name IN ('is_shared', 'shared_transaction_id');
-- Esperado: 2 rows

-- Limpiar datos de testing anterior (opcional)
DELETE FROM shared_transactions;
DELETE FROM relationships WHERE status != 'active';
```

---

## 🧪 Test Suite 1: Registro de Pareja

### Test 1.1: Registro Exitoso con División Default (50/50)

**Objetivo:** Verificar que se puede registrar una pareja con división default

**Pasos:**
1. Usuario A envía mensaje: `"Quiero registrar a mi pareja con el número 5522223333"`

**Resultado Esperado:**
```
✅ Usuario A recibe confirmación:
"✅ ¡Listo! Solicitud enviada a 5522223333

División propuesta: 50% tú, 50% tu pareja

Cuando acepte la solicitud, podrán empezar a registrar gastos compartidos.

Para registrar un gasto compartido, di algo como:
• "Gasté 200 en comida, pagué yo"
• "Gasté 300 en restaurante, pagué yo 50/50""
```

```
✅ Usuario B (5522223333) recibe notificación WhatsApp:
"👫 *Solicitud de Pareja*

5511112222 quiere compartir gastos contigo.

📊 División propuesta:
• Tú: 50%
• 5511112222: 50%

¿Aceptas? Responde:
✅ "Acepto" para aceptar
❌ "Rechazar" para rechazar"
```

**Verificación en Base de Datos:**
```sql
SELECT * FROM relationships
WHERE user_phone_1 = '5511112222' AND user_phone_2 = '5522223333';

-- Verificar:
-- status = 'pending'
-- default_split_user1 = 50.00
-- default_split_user2 = 50.00
```

**Criterios de Éxito:**
- [ ] Relación creada con status 'pending'
- [ ] División es 50/50
- [ ] Usuario A recibe confirmación
- [ ] Usuario B recibe notificación WhatsApp
- [ ] No hay errores en logs

---

### Test 1.2: Registro con División Custom (65/35)

**Objetivo:** Verificar división personalizada

**Pasos:**
1. Usuario A envía: `"Registra a mi pareja con 5533334444, dividir 65/35"`

**Resultado Esperado:**
```
✅ Confirmación muestra "División propuesta: 65% tú, 35% tu pareja"
✅ Notificación a B muestra "Tú: 35%, 5511112222: 65%"
```

**Verificación BD:**
```sql
SELECT default_split_user1, default_split_user2
FROM relationships
WHERE user_phone_2 = '5533334444';

-- Esperado: 65.00, 35.00
```

**Criterios de Éxito:**
- [ ] División custom guardada correctamente
- [ ] Notificación muestra porcentajes correctos

---

### Test 1.3: Edge Case - Teléfono Inválido

**Objetivo:** Verificar validación de formato de teléfono

**Pasos:**
1. Usuario A envía: `"Registra a mi pareja con 123"`

**Resultado Esperado:**
```
❌ "El teléfono de tu pareja debe tener 10 dígitos. Ejemplo: 5512345678"
```

**Criterios de Éxito:**
- [ ] No se crea relación
- [ ] Mensaje de error claro
- [ ] No se envía notificación

---

### Test 1.4: Edge Case - División No Suma 100%

**Objetivo:** Verificar validación de división

**Pasos:**
1. Usuario A envía: `"Registra pareja con 5544445555, dividir 60/50"`

**Resultado Esperado:**
```
❌ "La división debe sumar 100%. Especificaste 60/50 que suma 110%."
```

**Criterios de Éxito:**
- [ ] No se crea relación
- [ ] Mensaje indica el error de suma

---

### Test 1.5: Edge Case - Relación Consigo Mismo

**Objetivo:** Impedir que un usuario se registre como su propia pareja

**Pasos:**
1. Usuario A (5511112222) envía: `"Registra pareja con 5511112222"`

**Resultado Esperado:**
```
❌ "No puedes crear una relación contigo mismo 😅"
```

**Criterios de Éxito:**
- [ ] No se crea relación
- [ ] Mensaje de error amigable

---

### Test 1.6: Edge Case - Ya Tiene Relación Activa

**Objetivo:** Impedir múltiples relaciones activas

**Setup:** Usuario A ya tiene relación activa con 5522223333

**Pasos:**
1. Usuario A envía: `"Registra pareja con 5599998888"`

**Resultado Esperado:**
```
"Ya tienes una relación activa para gastos compartidos. Si quieres cambiar la división, puedes decir: "cambia la división a 50/50""
```

**Criterios de Éxito:**
- [ ] No se crea nueva relación
- [ ] Mensaje sugiere cómo cambiar división

---

## 🧪 Test Suite 2: Aceptación de Solicitud

### Test 2.1: Aceptación Exitosa

**Setup:** Usuario A ya envió solicitud a Usuario B (Test 1.1)

**Pasos:**
1. Usuario B envía: `"Acepto"`

**Resultado Esperado:**
```
✅ Usuario B recibe:
"🎉 ¡Perfecto! Ahora compartes gastos con 5511112222

📊 División configurada:
• Tú: 50%
• 5511112222: 50%

💡 Ahora cuando registres gastos puedes decir:
• "Gasté 200 en comida, pagué yo"
• "Mi pareja pagó 150 en uber"
• "Gasté 300 en super, pagué yo 60/40"

Para ver el balance di: "¿Cómo va el balance?""
```

```
✅ Usuario A recibe notificación WhatsApp:
"🎉 *¡Tu pareja aceptó!*

5522223333 aceptó tu solicitud. Ahora pueden compartir gastos.

💡 Para registrar gastos compartidos, di:
• "Gasté 200 en comida, pagué yo"
• "Mi pareja pagó 150 en uber"
• "Gasté 300 en super, pagué yo 60/40""
```

**Verificación BD:**
```sql
SELECT status FROM relationships
WHERE user_phone_1 = '5511112222' AND user_phone_2 = '5522223333';

-- Esperado: status = 'active'
```

**Criterios de Éxito:**
- [ ] Status cambió a 'active'
- [ ] Usuario B recibe confirmación
- [ ] Usuario A recibe notificación WhatsApp
- [ ] Logs muestran: "🎉 Solicitud aceptada"

---

### Test 2.2: Edge Case - Acepta Sin Solicitud Pendiente

**Objetivo:** Manejar caso donde usuario dice "acepto" sin tener solicitud

**Setup:** Usuario C no tiene solicitudes pendientes

**Pasos:**
1. Usuario C envía: `"Acepto"`

**Resultado Esperado:**
```
"No tienes solicitudes pendientes de pareja.

Si alguien quiere compartir gastos contigo, recibirás una notificación aquí."
```

**Criterios de Éxito:**
- [ ] Mensaje claro
- [ ] No hay error
- [ ] No se modifica BD

---

## 🧪 Test Suite 3: Rechazo de Solicitud

### Test 3.1: Rechazo Exitoso

**Setup:** Usuario A envió solicitud a Usuario D

**Pasos:**
1. Usuario D envía: `"Rechazar"`

**Resultado Esperado:**
```
✅ Usuario D recibe:
"✅ Solicitud rechazada

No compartirás gastos con 5511112222. Puedes seguir usando BUBU normalmente."
```

```
✅ Usuario A recibe notificación WhatsApp:
"⚠️ *Solicitud rechazada*

5544445555 rechazó tu solicitud de compartir gastos.

Puedes seguir usando BUBU normalmente para tus gastos personales."
```

**Verificación BD:**
```sql
SELECT status FROM relationships WHERE user_phone_2 = '5544445555';
-- Esperado: status = 'rejected'
```

**Criterios de Éxito:**
- [ ] Status cambió a 'rejected'
- [ ] Usuario D recibe confirmación
- [ ] Usuario A recibe notificación
- [ ] Logs muestran: "🚫 Solicitud rechazada"

---

## 🧪 Test Suite 4: Gastos Compartidos

### Test 4.1: Gasto Compartido con División Default

**Setup:** Usuario A y B tienen relación activa (50/50)

**Pasos:**
1. Usuario A envía: `"Gasté 200 en comida, pagué yo"`

**Resultado Esperado:**
```
✅ Usuario A recibe:
"✅ Registré el gasto compartido de $200 en Comida. Tú pagaste todo, pero se divide: tú 50% ($100) y tu pareja 50% ($100)."
```

```
✅ Usuario B recibe notificación WhatsApp:
"💳 *Nuevo Gasto Compartido*

🍔 $200 en Comida
📝 Comida

Pagó 5511112222

📊 División:
• Tu parte: 50% ($100)
• Pareja: 50% ($100)

💡 Consulta el balance diciendo:
"¿Cómo va el balance?""
```

**Verificación BD:**
```sql
-- Verificar shared_transaction creado
SELECT * FROM shared_transactions WHERE payer_phone = '5511112222';
-- Debe existir 1 row

-- Verificar que se crearon 2 transacciones
SELECT COUNT(*) FROM transactions WHERE is_shared = true;
-- Debe ser 2 (una para cada usuario)

-- Verificar montos
SELECT user_phone, amount FROM transactions
WHERE shared_transaction_id = (SELECT id FROM shared_transactions WHERE payer_phone = '5511112222');
-- Usuario A: -100
-- Usuario B: -100
```

**Criterios de Éxito:**
- [ ] Se crearon 2 transacciones
- [ ] Montos son correctos (50% cada uno)
- [ ] `is_shared = true` en ambas
- [ ] Usuario B recibió notificación
- [ ] Logs: "💑 Detectado gasto compartido"

---

### Test 4.2: Gasto Compartido con División Custom

**Pasos:**
1. Usuario A envía: `"Gasté 300 en restaurante, pagué yo 70/30"`

**Resultado Esperado:**
```
✅ División: 70% ($210) y 30% ($90)
✅ Usuario A: -210
✅ Usuario B: -90
```

**Verificación BD:**
```sql
SELECT split_percentage_user1, split_percentage_user2, total_amount
FROM shared_transactions WHERE total_amount = 300;

-- Esperado: 70.00, 30.00, 300.00
```

**Criterios de Éxito:**
- [ ] División custom aplicada correctamente
- [ ] Notificación muestra porcentajes custom

---

### Test 4.3: Gasto Pagado por Pareja

**Pasos:**
1. Usuario A envía: `"Mi pareja pagó 150 en uber"`

**Resultado Esperado:**
```
✅ payer_phone = 5522223333 (Usuario B)
✅ Notificación va a B: "Pagaste tú"
```

**Verificación BD:**
```sql
SELECT payer_phone FROM shared_transactions WHERE total_amount = 150;
-- Esperado: payer_phone = '5522223333'
```

**Criterios de Éxito:**
- [ ] Pagador es Usuario B
- [ ] Notificación correcta

---

### Test 4.4: Edge Case - Gasto Compartido Sin Pareja (Fallback a Individual)

**Setup:** Usuario E no tiene pareja registrada

**Pasos:**
1. Usuario E envía: `"Gasté 200 en comida, pagué yo"`

**Resultado Esperado:**
```
✅ "Registré tu gasto de $200 en Comida.

💡 Si quieres compartir gastos con alguien, puedes registrar una pareja diciendo: 'Registra a mi pareja con el número [teléfono]'"
```

**Verificación en Base de Datos:**
```sql
-- Verificar que se creó como gasto individual
SELECT is_shared, amount, description FROM transactions
WHERE user_phone = '[teléfono E]' AND amount = 200
ORDER BY created_at DESC LIMIT 1;

-- Esperado: is_shared = false (o NULL), amount = 200
```

**Criterios de Éxito:**
- [ ] Se crea transacción INDIVIDUAL (is_shared = false)
- [ ] Solo aparece en estado del usuario E
- [ ] Mensaje incluye confirmación del gasto
- [ ] Mensaje incluye sugerencia amigable con emoji 💡
- [ ] Logs muestran: "⚠️ Usuario sin pareja detectado, creando gasto individual con sugerencia"

---

### Test 4.5: Edge Case - Relación Pendiente (No Activa)

**Setup:** Usuario A envió solicitud a F pero F no ha aceptado

**Pasos:**
1. Usuario A envía: `"Gasté 200 en comida, pagué yo"`

**Resultado Esperado:**
```
❌ "Tu pareja aún no ha aceptado la solicitud de relación. Los gastos compartidos solo funcionan cuando ambos han aceptado."
```

**Criterios de Éxito:**
- [ ] No se crea gasto compartido
- [ ] Mensaje explica que debe esperar aceptación

---

### Test 4.6: Gasto Individual (No Compartido)

**Setup:** Usuario A tiene pareja activa

**Pasos:**
1. Usuario A envía: `"Gasté 100 en café"` (sin mencionar "pagué yo")

**Resultado Esperado:**
```
✅ Se crea transacción INDIVIDUAL (is_shared = false)
✅ NO se envía notificación a pareja
✅ Solo aparece en estado de Usuario A
```

**Verificación BD:**
```sql
SELECT is_shared FROM transactions WHERE amount = 100 AND description LIKE '%café%';
-- Esperado: is_shared = false (o NULL)
```

**Criterios de Éxito:**
- [ ] Gasto es individual
- [ ] No se notifica a pareja
- [ ] Logs: "👤 Gasto individual"

---

## 🧪 Test Suite 5: Consultar Balance

### Test 5.1: Balance con Gastos del Mes Actual

**Setup:**
- Usuario A pagó: $200 (1 gasto)
- Usuario B pagó: $300 (2 gastos)
- Total compartido: $500
- División: 50/50

**Pasos:**
1. Usuario A envía: `"¿Cómo va el balance?"`

**Resultado Esperado:**
```
"💰 Balance de gastos compartidos (este mes)

📊 Resumen:
• Total gastos compartidos: $500.00
• Número de gastos: 3

👤 Tú:
• Pagaste: $200.00 (1 gastos)
• Debes: $250.00
• Balance: -$50.00

👥 Tu pareja:
• Pagó: $300.00 (2 gastos)
• Debe: $250.00
• Balance: $50.00

✅ Tu pareja te debe: $50.00"
```

**Criterios de Éxito:**
- [ ] Balance calculado correctamente
- [ ] Indica quién debe a quién
- [ ] Montos cuadran

---

### Test 5.2: Edge Case - Sin Gastos Compartidos

**Setup:** Relación activa pero sin gastos

**Pasos:**
1. Usuario envía: `"¿Cómo va el balance?"`

**Resultado Esperado:**
```
Balance muestra:
• Total gastos compartidos: $0.00
• Número de gastos: 0
• Balance: 0
```

**Criterios de Éxito:**
- [ ] No hay error
- [ ] Muestra ceros

---

## 🧪 Test Suite 6: Actualizar División Default

### Test 6.1: Actualización Exitosa

**Setup:** Relación activa con división 50/50

**Pasos:**
1. Usuario A envía: `"Cambia la división a 65/35"`

**Resultado Esperado:**
```
✅ Usuario A recibe confirmación con nueva división
✅ Usuario B recibe notificación WhatsApp del cambio
```

**Verificación BD:**
```sql
SELECT default_split_user1, default_split_user2 FROM relationships
WHERE user_phone_1 = '5511112222';

-- Esperado: 65.00, 35.00
```

**Criterios de Éxito:**
- [ ] División actualizada en BD
- [ ] Pareja notificada
- [ ] Próximos gastos usan nueva división

---

### Test 6.2: Edge Case - División Inválida

**Pasos:**
1. Usuario envía: `"Cambia la división a 60/50"`

**Resultado Esperado:**
```
❌ "La división debe sumar 100%. Especificaste 60/50 que suma 110%."
```

**Criterios de Éxito:**
- [ ] No se actualiza división
- [ ] Mensaje claro de error

---

## 🧪 Test Suite 7: Listar Gastos Compartidos

### Test 7.1: Listar Todos los Gastos

**Setup:** Usuario tiene 3 gastos compartidos

**Pasos:**
1. Usuario envía: `"Lista gastos compartidos"`

**Resultado Esperado:**
```
"📋 Gastos compartidos (este mes)

1. 🍔 $200 - Comida
   Pagaste tú | Tu parte: 50% ($100)
   Fecha: 2025-11-20

2. 🍽️ $300 - Restaurante
   Pagaste tú | Tu parte: 70% ($210)
   Fecha: 2025-11-20

3. 🚗 $150 - Uber
   Pagó tu pareja | Tu parte: 50% ($75)
   Fecha: 2025-11-20

💡 Total: 3 gastos"
```

**Criterios de Éxito:**
- [ ] Lista todos los gastos
- [ ] Indica quién pagó cada uno
- [ ] Muestra porcentaje correcto

---

## 📊 Resumen de Edge Cases

| Edge Case | Manejado | Mensaje de Error/Comportamiento |
|-----------|----------|--------------------------------|
| Teléfono inválido (< 10 dígitos) | ✅ | "El teléfono debe tener 10 dígitos" |
| División no suma 100% | ✅ | "La división debe sumar 100%" |
| Relación consigo mismo | ✅ | "No puedes crear relación contigo mismo" |
| Ya tiene relación activa | ✅ | "Ya tienes una relación activa" |
| Acepta sin solicitud | ✅ | "No tienes solicitudes pendientes" |
| Gasto compartido sin pareja | ✅ | "No tienes pareja registrada" |
| Relación pendiente (no activa) | ✅ | "Tu pareja no ha aceptado" |
| Sin gastos al consultar balance | ✅ | Balance con ceros |
| División custom inválida | ✅ | Error de validación |

---

## 🔍 Checklist de Verificación Post-Testing

Después de ejecutar todos los tests:

- [ ] Todas las notificaciones WhatsApp llegaron correctamente
- [ ] No hay errores en logs del servidor
- [ ] Base de datos está consistente (sin orphans)
- [ ] Gastos individuales siguen funcionando normal
- [ ] Tutorial muestra sección de gastos compartidos
- [ ] Todos los edge cases manejados apropiadamente
- [ ] No hay memory leaks (verificar con monitoring)

---

## 🐛 Troubleshooting

### Problema: Notificaciones No Llegan

**Síntomas:**
- Gasto compartido se crea pero pareja no recibe WhatsApp

**Diagnóstico:**
```bash
# Ver logs de notificaciones
pm2 logs bubu-backend | grep "📨"

# Verificar que no haya errores
pm2 logs bubu-backend | grep "❌.*notificación"
```

**Posibles Causas:**
1. Token de WhatsApp expiró
2. Número no está registrado en Business API
3. Límite de rate limit alcanzado

**Solución:**
1. Verificar WHATSAPP_TOKEN en .env
2. Verificar que número esté en whitelist
3. Esperar y reintentar

---

### Problema: Balance Incorrecto

**Síntomas:**
- Balance no cuadra con gastos registrados

**Diagnóstico:**
```sql
-- Ver todos los gastos compartidos
SELECT st.*, t.user_phone, t.amount
FROM shared_transactions st
JOIN transactions t ON (t.id = st.transaction_id_user1 OR t.id = st.transaction_id_user2)
WHERE st.payer_phone = '5511112222';

-- Calcular balance manualmente
SELECT
    SUM(CASE WHEN t.user_phone = '5511112222' THEN t.amount ELSE 0 END) as user_total,
    SUM(CASE WHEN t.user_phone = '5522223333' THEN t.amount ELSE 0 END) as partner_total
FROM transactions t
WHERE t.is_shared = true;
```

---

## 📝 Registro de Tests

Use esta tabla para documentar resultados:

| Test ID | Descripción | Fecha | Tester | Resultado | Notas |
|---------|-------------|-------|--------|-----------|-------|
| 1.1 | Registro exitoso 50/50 | | | ⬜ PASS / ❌ FAIL | |
| 1.2 | Registro custom 65/35 | | | ⬜ PASS / ❌ FAIL | |
| 1.3 | Teléfono inválido | | | ⬜ PASS / ❌ FAIL | |
| ... | ... | | | | |

---

**Última actualización:** 2025-11-20
