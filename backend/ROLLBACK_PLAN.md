# 🔄 Plan de Rollback - Gastos Compartidos

## Información General

**Feature:** Gastos Compartidos con División Configurable
**Sprint:** 1 - Foundation (Base de Datos y Services Core)
**Fecha de Implementación:** 2025-11-20
**Tag pre-implementación:** `v1.0.0-before-shared-expenses` (crear antes de aplicar cambios)

## ⚠️ Cuándo Hacer Rollback

Ejecutar rollback si se presenta cualquiera de estas situaciones:

- ❌ Errores 500 al crear transacciones normales (individuales)
- ❌ Balance muestra números incorrectos o NaN
- ❌ Transacciones duplicadas en el sistema
- ❌ Usuarios reportan pérdida de datos
- ❌ >10% de usuarios experimentan problemas
- ❌ Base de datos en estado inconsistente
- ❌ Errores de foreign key constraints
- ❌ Imposibilidad de consultar estado financiero

## 📋 Checklist Pre-Rollback

Antes de ejecutar el rollback, verificar:

- [ ] Confirmar que el problema es causado por esta feature
- [ ] Revisar logs del servidor para identificar el error exacto
- [ ] Verificar que tienes backup de la base de datos
- [ ] Notificar al equipo que se realizará rollback
- [ ] Tener acceso a servidor de producción
- [ ] Verificar que el tag `v1.0.0-before-shared-expenses` existe

## 🔄 Procedimiento de Rollback

### Paso 1: Detener Aplicación

**Tiempo estimado:** 1 minuto

```bash
# En servidor de producción
pm2 stop bubu-backend

# O si usas otro process manager
# systemctl stop bubu-backend
# O: pkill -f "node src/app.js"
```

**Verificación:**
```bash
# Confirmar que no hay procesos corriendo
pm2 list
# O: ps aux | grep node
```

### Paso 2: Backup de Base de Datos Actual

**Tiempo estimado:** 2-3 minutos

**IMPORTANTE:** Hacer backup antes de rollback por si necesitamos recuperar datos

```bash
# Crear backup con timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
pg_dump -U bubu_user -d bubu_db -F c -f backup_before_rollback_$TIMESTAMP.dump

# Verificar que el backup se creó correctamente
ls -lh backup_before_rollback_$TIMESTAMP.dump
```

### Paso 3: Revertir Base de Datos

**Tiempo estimado:** 1 minuto

**Opción A: Ejecutar Migration Down (Recomendado)**

```bash
# Conectar a PostgreSQL
psql -U bubu_user -d bubu_db

# Ejecutar rollback script
\i src/db/migrations/004_shared_expenses_down.sql

# Salir
\q
```

**Opción B: Restaurar desde Backup Pre-Implementación**

```bash
# Restaurar backup anterior a la feature
pg_restore -U bubu_user -d bubu_db -c backup_before_shared_expenses.dump
```

**Verificación Post-Rollback de BD:**

```bash
# Verificar que las tablas fueron eliminadas
psql -U bubu_user -d bubu_db -c "
SELECT table_name
FROM information_schema.tables
WHERE table_name IN ('relationships', 'shared_transactions');
"
# Resultado esperado: 0 rows (tablas no existen)

# Verificar que columns fueron eliminadas de transactions
psql -U bubu_user -d bubu_db -c "
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'transactions'
  AND column_name IN ('is_shared', 'shared_transaction_id');
"
# Resultado esperado: 0 rows (columnas no existen)

# Verificar que transacciones existentes siguen intactas
psql -U bubu_user -d bubu_db -c "SELECT COUNT(*) FROM transactions;"
# Resultado esperado: Número igual al que había antes
```

### Paso 4: Revertir Código

**Tiempo estimado:** 2 minutos

**Opción A: Git Checkout al Tag Anterior**

```bash
cd /path/to/bubu2/backend

# Verificar tag existe
git tag | grep v1.0.0-before-shared-expenses

# Checkout al tag
git checkout v1.0.0-before-shared-expenses

# Instalar dependencias (por si acaso)
npm install
```

**Opción B: Git Revert (Si ya se hizo commit)**

```bash
cd /path/to/bubu2/backend

# Encontrar commit hash del sprint 1
git log --oneline -10

# Revertir commit específico
git revert [commit-hash-sprint-1]

# Push del revert
git push origin main
```

**Opción C: Eliminar Archivos Manualmente**

```bash
# Eliminar archivos nuevos
rm src/services/relationshipService.js
rm src/services/sharedTransactionService.js
rm src/services/balanceService.js
rm src/db/migrations/004_shared_expenses_up.sql
rm src/db/migrations/004_shared_expenses_down.sql
rm ROLLBACK_PLAN.md
```

### Paso 5: Reiniciar Aplicación

**Tiempo estimado:** 1 minuto

```bash
# Reiniciar servidor
pm2 start bubu-backend

# O si usas otro process manager
# npm start &
# O: systemctl start bubu-backend
```

**Verificación:**
```bash
# Ver logs en tiempo real
pm2 logs bubu-backend --lines 50

# Verificar que no hay errores de sintaxis o imports
# Verificar que servidor está escuchando en el puerto correcto
```

### Paso 6: Verificar Funcionalidad Básica

**Tiempo estimado:** 5 minutos

```bash
# Test 1: Health check
curl https://tu-dominio.com/api/health
# Esperado: {"success": true, "message": "BUBU API está funcionando"}

# Test 2: Crear transacción individual (debe funcionar normal)
# Enviar mensaje por WhatsApp: "Gasté 100 en café"
# Esperado: Respuesta exitosa con confirmación

# Test 3: Consultar estado
# Enviar mensaje: "¿Cómo voy este mes?"
# Esperado: Resumen financiero sin errores

# Test 4: Verificar base de datos
psql -U bubu_user -d bubu_db -c "SELECT COUNT(*) FROM transactions;"
# Esperado: Número correcto de transacciones (sin duplicados ni pérdidas)
```

## 📊 Checklist Post-Rollback

Verificar que todo funciona correctamente:

- [ ] Servidor está corriendo sin errores
- [ ] Health endpoint responde OK
- [ ] Usuarios pueden crear transacciones individuales
- [ ] Consultar estado financiero funciona
- [ ] No hay errores en logs
- [ ] Base de datos tiene estructura original
- [ ] No hay tablas `relationships` ni `shared_transactions`
- [ ] Tabla `transactions` no tiene columnas `is_shared` ni `shared_transaction_id`
- [ ] Todas las transacciones anteriores siguen existiendo
- [ ] WhatsApp webhook funciona normalmente

## 🔍 Troubleshooting

### Problema: Base de datos no revierte correctamente

**Síntoma:** Error "relation does not exist" al ejecutar down migration

**Solución:**
```bash
# Restaurar desde backup completo
pg_restore -U bubu_user -d bubu_db -c backup_before_shared_expenses.dump
```

### Problema: Código no compila después de rollback

**Síntoma:** Error de imports o syntax después de revertir

**Solución:**
```bash
# Limpiar node_modules y reinstalar
rm -rf node_modules
npm install

# Verificar sintaxis
node --check src/app.js
```

### Problema: Transacciones perdidas

**Síntoma:** Número de transacciones menor al esperado

**Solución:**
```bash
# Restaurar desde backup pre-rollback
pg_restore -U bubu_user -d bubu_db -c backup_before_rollback_TIMESTAMP.dump

# Contactar al equipo para revisar qué causó la pérdida
```

## 📝 Archivos Afectados por Rollback

### Archivos a Eliminar (Creados en Sprints 1, 2, 3)

**Sprint 1 - Base de Datos y Servicios:**
```
src/db/migrations/004_shared_expenses_up.sql
src/db/migrations/004_shared_expenses_down.sql
src/services/relationshipService.js
src/services/sharedTransactionService.js
src/services/balanceService.js
ROLLBACK_PLAN.md
CHANGELOG_SPRINT1.md
```

**Sprint 3 - Notificaciones:**
```
src/services/notificationService.js
```

**Sprint 4 - Testing y Documentación:**
```
CHANGELOG_SPRINT2.md
CHANGELOG_SPRINT3.md
CHANGELOG_SPRINT4.md (si existe)
TESTING_MANUAL_GASTOS_COMPARTIDOS.md
verify_shared_expenses_db.sql
```

### Archivos Modificados (Requieren Git Revert)

**Sprint 2 - AI Integration:**
```
src/services/openaiService.js
  - Revertir: 4 nuevos intents (registrar_pareja, consultar_balance, listar_gastos_compartidos, actualizar_division_default)
  - Revertir: Modificaciones a intent registrar_transaccion (parámetros es_compartido, quien_pago, split_custom_*)
  - Revertir: Modificaciones a generateNaturalResponse para gastos compartidos

src/controllers/chatController.js
  - Revertir: Imports de relationshipService, sharedTransactionService, balanceService
  - Revertir: 4 switch cases nuevos
  - Revertir: 4 handler functions nuevos (handleRegistrarPareja, handleConsultarBalance, etc.)
  - Revertir: Modificaciones a handleRegistrarTransaccion (lógica de gastos compartidos)
```

**Sprint 3 - User Experience:**
```
src/services/openaiService.js
  - Revertir: 2 intents adicionales (aceptar_solicitud_pareja, rechazar_solicitud_pareja)

src/controllers/chatController.js
  - Revertir: Import de notificationService
  - Revertir: 2 switch cases adicionales (aceptar/rechazar)
  - Revertir: 2 handler functions (handleAceptarSolicitudPareja, handleRechazarSolicitudPareja)
  - Revertir: Notificaciones agregadas a handleRegistrarPareja, handleRegistrarTransaccion, handleActualizarDivisionDefault

src/services/tutorialService.js
  - Revertir: Sección de gastos compartidos en tutorial
  - Revertir: Comandos de gastos compartidos en ayuda rápida
```

### Opción de Rollback por Git

Si todos los sprints fueron committeados por separado:

```bash
# Ver commits relacionados con gastos compartidos
git log --oneline | grep -i "compartid\|sprint"

# Revertir commits específicos (del más reciente al más antiguo)
git revert [commit-hash-sprint-3]
git revert [commit-hash-sprint-2]
git revert [commit-hash-sprint-1]

# O revertir todos a la vez
git revert [commit-hash-sprint-1]..[commit-hash-sprint-3]

# Push de los reverts
git push origin main
```

## ⏱️ Tiempo Total Estimado de Rollback

- Preparación y backup: 3 minutos
- Ejecución de rollback: 5 minutos
- Verificación: 5 minutos
- **Total: ~15 minutos**

## 🆘 Contactos de Emergencia

Si el rollback falla o hay problemas críticos:

1. **Contactar al equipo de desarrollo**
2. **Revisar backups disponibles**
3. **Considerar restauración completa desde backup pre-feature**

## ✅ Confirmación Final

Después del rollback, confirmar:

- ✅ Aplicación funciona sin la feature de gastos compartidos
- ✅ Usuarios pueden usar BUBU normalmente (gastos individuales)
- ✅ No hay pérdida de datos
- ✅ Base de datos está en estado consistente
- ✅ Logs no muestran errores

---

**Nota:** Este documento debe actualizarse después de cada Sprint para incluir nuevos archivos y cambios.
