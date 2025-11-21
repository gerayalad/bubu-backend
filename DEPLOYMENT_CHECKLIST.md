# 🚀 Checklist de Deployment - Gastos Compartidos

## Información General

**Feature:** Gastos Compartidos con División Configurable
**Versión:** 1.0.0
**Sprints:** 1, 2, 3, 4
**Fecha Target:** 2025-11-20
**Estimación Total:** 30 horas
**Estado:** ✅ Listo para deploy

---

## 📋 PRE-DEPLOYMENT (1-2 días antes)

### 1. Verificación de Código

- [ ] Todos los archivos tienen sintaxis válida
  ```bash
  node --check src/services/relationshipService.js
  node --check src/services/sharedTransactionService.js
  node --check src/services/balanceService.js
  node --check src/services/notificationService.js
  node --check src/services/openaiService.js
  node --check src/controllers/chatController.js
  node --check src/services/tutorialService.js
  ```

- [ ] No hay console.logs de debug innecesarios
  ```bash
  grep -r "console.log.*DEBUG" src/
  # Esperado: Sin resultados
  ```

- [ ] Código commiteado en repositorio
  ```bash
  git status
  # Esperado: working tree clean
  ```

- [ ] Branch de feature creado y pusheado
  ```bash
  git checkout -b feature/gastos-compartidos
  git push -u origin feature/gastos-compartidos
  ```

### 2. Documentación

- [ ] CHANGELOG_SPRINT1.md creado y completo
- [ ] CHANGELOG_SPRINT2.md creado y completo
- [ ] CHANGELOG_SPRINT3.md creado y completo
- [ ] CHANGELOG_SPRINT4.md creado y completo
- [ ] ROLLBACK_PLAN.md actualizado con todos los sprints
- [ ] TESTING_MANUAL_GASTOS_COMPARTIDOS.md creado
- [ ] DEPLOYMENT_CHECKLIST.md creado (este archivo)

### 3. Base de Datos

- [ ] Migration scripts revisados
  - `004_shared_expenses_up.sql`
  - `004_shared_expenses_down.sql`

- [ ] Script de verificación probado en ambiente local
  ```bash
  psql -U bubu_user -d bubu_db_dev -f verify_shared_expenses_db.sql
  ```

- [ ] Backup de producción programado
  ```bash
  # Agendar backup 1 hora antes del deploy
  pg_dump -U bubu_user -d bubu_db -F c -f backup_before_shared_expenses_$(date +%Y%m%d_%H%M%S).dump
  ```

### 4. Ambiente de Testing

- [ ] Feature testeada en ambiente local
- [ ] Feature testeada en ambiente de staging (si existe)
- [ ] Testing manual ejecutado según TESTING_MANUAL_GASTOS_COMPARTIDOS.md
- [ ] Al menos 5 flows completos probados:
  - [ ] Registro y aceptación de pareja
  - [ ] Rechazo de solicitud
  - [ ] Gasto compartido con división default
  - [ ] Gasto compartido con división custom
  - [ ] Consultar balance

### 5. WhatsApp Business API

- [ ] Token de WhatsApp validado y no está por expirar
- [ ] Número de WhatsApp verificado en Business API
- [ ] Límite de mensajes diarios verificado (suficiente para testing y producción)
- [ ] Webhooks configurados correctamente
- [ ] Variables de entorno verificadas:
  ```bash
  echo $WHATSAPP_PHONE_NUMBER_ID
  echo $WHATSAPP_TOKEN
  echo $WEBHOOK_VERIFY_TOKEN
  ```

### 6. Git Tags

- [ ] Tag creado ANTES de aplicar cambios
  ```bash
  git tag -a v1.0.0-before-shared-expenses -m "Estado antes de implementar gastos compartidos"
  git push origin v1.0.0-before-shared-expenses
  ```

---

## 🚀 DEPLOYMENT DAY

### Paso 1: Backup de Producción (T-60 min)

- [ ] Detener tráfico de nuevos usuarios (opcional, solo si es crítico)
- [ ] Ejecutar backup completo de base de datos
  ```bash
  TIMESTAMP=$(date +%Y%m%d_%H%M%S)
  pg_dump -U bubu_user -d bubu_db -F c -f backup_prod_$TIMESTAMP.dump
  ```

- [ ] Verificar que el backup se creó correctamente
  ```bash
  ls -lh backup_prod_$TIMESTAMP.dump
  # Debe tener tamaño > 0
  ```

- [ ] Guardar backup en almacenamiento seguro
  ```bash
  # Copiar a S3, Google Cloud Storage, o similar
  # Ejemplo con scp:
  scp backup_prod_$TIMESTAMP.dump user@backup-server:/backups/
  ```

### Paso 2: Aplicar Migration (T-30 min)

- [ ] Conectar a base de datos de producción
  ```bash
  psql -U bubu_user -d bubu_db
  ```

- [ ] Ejecutar migration
  ```sql
  \i src/db/migrations/004_shared_expenses_up.sql
  ```

- [ ] Verificar que la migration se aplicó correctamente
  ```bash
  psql -U bubu_user -d bubu_db -f verify_shared_expenses_db.sql
  ```

- [ ] Verificar output del script de verificación
  - ✅ Todas las tablas existen
  - ✅ Todas las columnas existen
  - ✅ Todos los constraints existen
  - ✅ Todos los índices existen
  - ✅ Sin errores de integridad

### Paso 3: Deploy de Código (T-15 min)

#### Opción A: Deploy con Git Pull

```bash
# SSH al servidor de producción
ssh user@production-server

# Ir al directorio del proyecto
cd /path/to/bubu2/backend

# Pull de los cambios
git fetch origin
git checkout feature/gastos-compartidos
git pull origin feature/gastos-compartidos

# Instalar dependencias (por si acaso)
npm install

# Reiniciar servidor
pm2 restart bubu-backend
```

#### Opción B: Deploy con CI/CD

- [ ] Merge de branch feature a main
  ```bash
  git checkout main
  git merge feature/gastos-compartidos
  git push origin main
  ```

- [ ] Esperar a que CI/CD ejecute el deploy automático
- [ ] Verificar que el deploy fue exitoso en panel de CI/CD

### Paso 4: Verificación Post-Deploy (T+0 min)

- [ ] Verificar que el servidor está corriendo
  ```bash
  pm2 status bubu-backend
  # Status debe ser: online
  ```

- [ ] Verificar logs en tiempo real
  ```bash
  pm2 logs bubu-backend --lines 50
  ```

- [ ] Buscar errores en logs
  ```bash
  pm2 logs bubu-backend | grep -i "error\|exception"
  # No debe haber errores críticos
  ```

- [ ] Health check del API
  ```bash
  curl https://api.bubu.com/api/health
  # Esperado: {"success": true, "message": "BUBU API está funcionando"}
  ```

### Paso 5: Testing en Producción (T+5 min)

#### Test 1: Gasto Individual (Backward Compatibility)

- [ ] Usuario de prueba envía: "Gasté 100 en café"
- [ ] Verificar que se crea transacción individual
- [ ] Verificar que NO es compartida
- [ ] Verificar que la respuesta es correcta

#### Test 2: Registro de Pareja

- [ ] Usuario A envía: "Quiero registrar a mi pareja con [teléfono de testing]"
- [ ] Verificar respuesta de confirmación
- [ ] Verificar que Usuario B recibe notificación WhatsApp
- [ ] Verificar en BD que relación fue creada con status 'pending'
  ```sql
  SELECT * FROM relationships WHERE user_phone_1 = '[teléfono A]';
  ```

#### Test 3: Aceptación de Solicitud

- [ ] Usuario B envía: "Acepto"
- [ ] Verificar confirmación a Usuario B
- [ ] Verificar notificación a Usuario A
- [ ] Verificar en BD que status cambió a 'active'
  ```sql
  SELECT status FROM relationships WHERE user_phone_2 = '[teléfono B]';
  ```

#### Test 4: Gasto Compartido

- [ ] Usuario A envía: "Gasté 200 en comida, pagué yo"
- [ ] Verificar respuesta con división
- [ ] Verificar notificación a Usuario B
- [ ] Verificar en BD:
  ```sql
  SELECT * FROM shared_transactions WHERE payer_phone = '[teléfono A]';
  SELECT * FROM transactions WHERE is_shared = true ORDER BY created_at DESC LIMIT 2;
  ```
- [ ] Verificar que se crearon exactamente 2 transacciones

#### Test 5: Consultar Balance

- [ ] Usuario A envía: "¿Cómo va el balance?"
- [ ] Verificar que muestra balance correcto
- [ ] Verificar que los cálculos son correctos

### Paso 6: Monitoreo (T+15 min a T+2 horas)

- [ ] Monitorear logs continuamente
  ```bash
  pm2 logs bubu-backend --lines 100 | grep "💑\|👫\|💳\|📨"
  ```

- [ ] Verificar métricas de servidor
  - CPU usage
  - Memory usage
  - Response time
  - Error rate

- [ ] Verificar que las notificaciones WhatsApp están llegando

- [ ] Revisar quejas de usuarios (si las hay)

---

## 📊 POST-DEPLOYMENT (24-48 horas después)

### Día 1 Post-Deploy

- [ ] Revisar métricas de uso:
  ```sql
  -- Cuántas relaciones se crearon
  SELECT COUNT(*) FROM relationships;

  -- Cuántas fueron aceptadas
  SELECT COUNT(*) FROM relationships WHERE status = 'active';

  -- Cuántos gastos compartidos se registraron
  SELECT COUNT(*) FROM shared_transactions;
  ```

- [ ] Revisar logs de errores
  ```bash
  pm2 logs bubu-backend --err --lines 200
  ```

- [ ] Verificar que notificaciones están funcionando
  ```bash
  pm2 logs bubu-backend | grep "📨" | tail -20
  ```

- [ ] Recolectar feedback de usuarios beta (si hay)

### Semana 1 Post-Deploy

- [ ] Analizar adoption rate (cuántos usuarios están usando la feature)
  ```sql
  SELECT
      COUNT(DISTINCT user_phone_1) + COUNT(DISTINCT user_phone_2) as total_users_using_feature
  FROM relationships
  WHERE status = 'active';
  ```

- [ ] Revisar casos edge encontrados en producción
- [ ] Documentar bugs/issues en GitHub Issues
- [ ] Priorizar fixes si es necesario

---

## 🔴 ROLLBACK (Si algo sale mal)

### Triggers para Rollback Inmediato

Ejecutar rollback SI:

- ❌ Error rate > 10% en los primeros 30 minutos
- ❌ Servidor se cae o reinicia constantemente
- ❌ Más de 5 usuarios reportan errores críticos
- ❌ Notificaciones no están llegando y no se puede arreglar rápido
- ❌ Base de datos muestra datos inconsistentes
- ❌ Gastos individuales dejan de funcionar

### Procedimiento de Rollback

1. **Detener servidor**
   ```bash
   pm2 stop bubu-backend
   ```

2. **Backup de BD actual**
   ```bash
   pg_dump -U bubu_user -d bubu_db -F c -f backup_before_rollback_$(date +%Y%m%d_%H%M%S).dump
   ```

3. **Revertir BD**
   ```bash
   psql -U bubu_user -d bubu_db -f src/db/migrations/004_shared_expenses_down.sql
   ```

4. **Revertir código**
   ```bash
   git checkout v1.0.0-before-shared-expenses
   npm install
   ```

5. **Reiniciar servidor**
   ```bash
   pm2 restart bubu-backend
   ```

6. **Verificar**
   ```bash
   # Health check
   curl https://api.bubu.com/api/health

   # Verificar que gastos individuales funcionan
   # Enviar mensaje de prueba
   ```

**Seguir:** `ROLLBACK_PLAN.md` para procedimiento completo

---

## ✅ Checklist de Confirmación Final

Marcar SOLO cuando todo esté verificado:

- [ ] ✅ Feature deployada sin errores
- [ ] ✅ Backward compatibility verificada (gastos individuales funcionan)
- [ ] ✅ Al menos 3 flows completos probados en producción
- [ ] ✅ Notificaciones WhatsApp funcionando
- [ ] ✅ Base de datos consistente (sin orphans, sin divisiones inválidas)
- [ ] ✅ Logs no muestran errores críticos
- [ ] ✅ Métricas de servidor normales
- [ ] ✅ Plan de monitoreo activo para próximos 7 días
- [ ] ✅ Equipo notificado del deploy exitoso
- [ ] ✅ Documentación actualizada en wiki/confluence

---

## 📞 Contactos de Emergencia

**Durante Deploy:**
- DevOps Lead: [contacto]
- Backend Lead: [contacto]
- Product Owner: [contacto]

**Post-Deploy:**
- On-call Engineer: [contacto]
- Database Admin: [contacto]

---

## 📝 Notas del Deploy

**Fecha de Deploy:** _______________

**Deployed por:** _______________

**Duración Total:** _______________ (desde T-60 hasta verificación final)

**Issues Encontrados:**
-
-
-

**Resoluciones:**
-
-
-

**Próximos Steps:**
-
-
-

---

**Última actualización:** 2025-11-20
