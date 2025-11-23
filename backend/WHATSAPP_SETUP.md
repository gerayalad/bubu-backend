# 📱 Configuración de WhatsApp Business API

Guía paso a paso para conectar BUBU con WhatsApp Business.

---

## ✅ Estado Actual

- [x] Credenciales configuradas en `.env`
- [x] Servicio de WhatsApp creado
- [x] Controlador de webhook creado
- [x] Rutas configuradas
- [ ] Webhook configurado en Meta Developer Console
- [ ] Prueba completa del flujo

---

## 🚀 Paso 1: Exponer el servidor localmente

Para que WhatsApp pueda enviar mensajes a tu servidor, necesitas exponer tu localhost a internet.

### Opción A: Usar ngrok (Recomendado para testing)

1. **Instalar ngrok:**
   ```bash
   # En Mac (con Homebrew)
   brew install ngrok

   # O descarga desde: https://ngrok.com/download
   ```

2. **Crear cuenta en ngrok:**
   - Ve a: https://dashboard.ngrok.com/signup
   - Copia tu authtoken

3. **Autenticar ngrok:**
   ```bash
   ngrok config add-authtoken TU_AUTH_TOKEN
   ```

4. **Levantar el servidor BUBU:**
   ```bash
   npm run dev
   ```

5. **En otra terminal, exponer el puerto 3001:**
   ```bash
   ngrok http 3001
   ```

6. **Copiar la URL pública:**
   ```
   Forwarding   https://abc123.ngrok.io -> http://localhost:3001
   ```

   Tu webhook URL será: `https://abc123.ngrok.io/api/whatsapp/webhook`

### Opción B: Usar un servidor en producción

Si ya tienes un servidor (VPS, AWS, etc.):

1. Despliega el backend en tu servidor
2. Configura HTTPS con Let's Encrypt
3. Tu webhook URL será: `https://tudominio.com/api/whatsapp/webhook`

---

## 📲 Paso 2: Configurar Webhook en Meta Developer Console

1. **Ve a Meta Developer Console:**
   - URL: https://developers.facebook.com/apps
   - Selecciona tu app

2. **Ir a WhatsApp > Configuration:**
   - En el panel izquierdo, click en "WhatsApp"
   - Click en "Configuration"

3. **Configurar Callback URL:**
   - **Callback URL:** `https://tu-url-ngrok.ngrok.io/api/whatsapp/webhook`
   - **Verify Token:** `bubu_webhook_2025_secure_token` (debe coincidir con .env)
   - Click en "Verify and Save"

4. **Suscribir a eventos (Webhook Fields):**
   Marcar los siguientes checkboxes:
   - ✅ `messages` (mensajes entrantes)
   - ✅ `message_status` (status de mensajes)

5. **Guardar cambios**

---

## 🧪 Paso 3: Probar la Integración

### Prueba 1: Verificar que el webhook está funcionando

```bash
# Verificar que el servidor está corriendo
curl http://localhost:3001/api/health

# Debería responder:
# {"success":true,"message":"BUBU API está funcionando","timestamp":"..."}
```

### Prueba 2: Enviar un mensaje de prueba desde WhatsApp

1. **Abre WhatsApp en tu teléfono**

2. **Envía un mensaje a tu número de WhatsApp Business:**
   - Número: **+52 811 067 0468**
   - Mensaje: `Hola`

3. **Verifica los logs del servidor:**
   Deberías ver:
   ```
   📩 Webhook recibido de WhatsApp
   📱 Mensaje de 5215551234567: "Hola"
   ✅ Mensaje marcado como leído
   ✅ Respuesta enviada a 5215551234567
   ```

4. **Recibir respuesta en WhatsApp:**
   BUBU debería responder: `¡Hola! Soy BUBU, tu asistente de finanzas personales...`

### Prueba 3: Probar funcionalidades completas

Envía estos mensajes y verifica las respuestas:

#### Registrar gasto:
```
Mensaje: "Gasté 350 en tacos"
Respuesta esperada: "✅ Registré tu gasto de $350 en Comida. ¡Qué rico!"
```

#### Consultar estado:
```
Mensaje: "¿Cómo voy este mes?"
Respuesta esperada: "En lo que va de este mes tuviste ingresos de $X y gastos de $Y..."
```

#### Listar transacciones:
```
Mensaje: "¿Qué gastos tengo en comida?"
Respuesta esperada:
Encontré 3 transacciones:

1. $350 - Tacos (Comida) - 2025-11-17
2. $200 - Desayuno (Comida) - 2025-11-16
3. $150 - Café (Comida) - 2025-11-15

Puedes decir "elimina el 1" o "cambia el 2 a $600"...
```

#### Eliminar transacción:
```
Mensaje: "Elimina el 1"
Respuesta esperada: "✅ Eliminé el gasto de $350 - Tacos correctamente."
```

---

## 🔧 Troubleshooting

### Error: "Webhook verification failed"

**Causa:** El `WEBHOOK_VERIFY_TOKEN` no coincide.

**Solución:**
1. Verifica que `.env` tenga: `WEBHOOK_VERIFY_TOKEN=bubu_webhook_2025_secure_token`
2. Usa exactamente el mismo token en Meta Developer Console
3. Reinicia el servidor: `npm run dev`

---

### Error: "Connection timeout"

**Causa:** WhatsApp no puede alcanzar tu servidor.

**Solución:**
1. Verifica que ngrok esté corriendo: `ngrok http 3001`
2. Verifica que el servidor esté corriendo: `npm run dev`
3. Usa la URL de ngrok en Meta Developer Console
4. Asegúrate de que la URL incluya `/api/whatsapp/webhook`

---

### Error: "Messages not being received"

**Causa:** Webhook no está suscrito a eventos o hay error en la lógica.

**Solución:**
1. Ve a Meta Developer Console > WhatsApp > Configuration
2. Verifica que "messages" esté marcado en Webhook Fields
3. Revisa los logs del servidor para ver si llegan los webhooks
4. Verifica que el número de teléfono esté verificado en Meta

---

### Los mensajes llegan pero no responde

**Causa:** Error en el procesamiento del mensaje.

**Solución:**
1. Revisa los logs del servidor para ver el error exacto
2. Verifica que `OPENAI_API_KEY` esté configurada correctamente
3. Verifica que la base de datos esté inicializada: `npm run init-db`

---

## 📊 Monitoreo

### Ver logs en tiempo real:

```bash
# Terminal 1: Servidor
npm run dev

# Terminal 2: ngrok
ngrok http 3001

# Observar:
# - Mensajes entrantes
# - Intents parseados
# - Respuestas enviadas
# - Errores (si los hay)
```

### Verificar mensajes enviados:

Ve a Meta Developer Console > WhatsApp > API Setup > Send and receive messages

---

## 🎯 Próximos Pasos

Una vez que funcione en local con ngrok:

1. **Desplegar en producción:**
   - Configurar servidor con HTTPS
   - Usar dominio real
   - Actualizar webhook URL en Meta

2. **Configurar notificaciones proactivas:**
   - Recordatorios de gastos fijos
   - Alertas de presupuesto

3. **Agregar más features:**
   - Envío de reportes en PDF
   - Gráficas de gastos
   - Metas de ahorro

---

## 📞 Contacto y Soporte

Si tienes problemas:
1. Revisa los logs del servidor
2. Revisa la consola de Meta Developer
3. Verifica que todas las credenciales estén correctas
4. Asegúrate de que ngrok esté corriendo

---

## ✅ Checklist de Setup

- [ ] ngrok instalado y autenticado
- [ ] Servidor corriendo (`npm run dev`)
- [ ] ngrok exponiendo puerto 3001
- [ ] URL de ngrok copiada
- [ ] Webhook configurado en Meta Developer Console
- [ ] Token de verificación coincide
- [ ] Eventos "messages" suscritos
- [ ] Mensaje de prueba enviado
- [ ] Respuesta recibida en WhatsApp

¡Listo! 🎉 BUBU ahora funciona en WhatsApp.
