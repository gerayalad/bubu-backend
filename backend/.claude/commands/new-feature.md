# ✨ New Feature — Implementar Nueva Funcionalidad

Modo especializado para diseñar e implementar nuevas features en el sistema.

## Contexto del Proyecto
Sistema de finanzas personales con webchat, OpenAI, base de datos, frontend neumórfico y backend API REST.

## Tu Tarea

Cuando el usuario solicite una nueva funcionalidad:

### 1. Entender el Requerimiento
- ¿Qué problema resuelve esta feature?
- ¿Quién la usará y cuándo?
- ¿Qué valor aporta al usuario?
- ¿Es consistente con la visión del producto?

### 2. Diseñar la Solución
- Definir user stories
- Diseñar flujos de usuario
- Identificar componentes afectados
- Diseñar schema de DB si es necesario
- Definir endpoints de API
- Diseñar UI/UX

### 3. Validar Coherencia Arquitectónica
- ¿Se alinea con el documento base (bubu_app.md)?
- ¿Respeta los principios del sistema (conversacional, simple, individual)?
- ¿Mantiene la arquitectura existente?
- ¿Requiere nuevas dependencias?

### 4. Planificar Implementación
- Dividir en tareas pequeñas
- Definir orden de ejecución
- Identificar dependencias
- Estimar complejidad

### 5. Implementar
- Backend (si aplica)
- Base de datos (si aplica)
- Frontend (si aplica)
- Integración con OpenAI (si aplica)
- Tests básicos

### 6. Documentar
- Actualizar documentación técnica
- Crear ejemplos de uso
- Documentar API endpoints nuevos

## Proceso Paso a Paso

### Fase 1: Análisis y Diseño

**Preguntas clave:**
- ¿Qué hace la feature exactamente?
- ¿Cómo interactúa el usuario con ella?
- ¿Qué datos necesita?
- ¿Qué responde el sistema?
- ¿Hay casos edge a considerar?

**Output:**
- User story(ies)
- Flujo de usuario
- Casos de uso
- Criterios de aceptación

### Fase 2: Diseño Técnico

**Backend:**
- ¿Nuevos endpoints? Diseña el contrato de API
- ¿Cambios en DB? Diseña el schema
- ¿Nueva lógica de negocio? Define los servicios
- ¿Integración con OpenAI? Diseña los prompts

**Frontend:**
- ¿Nuevos componentes? Diseña la estructura
- ¿Cambios en UI? Diseña mockups o describe el look
- ¿Nuevas interacciones? Define los eventos

### Fase 3: Implementación

**Orden recomendado:**
1. Schema de base de datos (si aplica)
2. Modelos y servicios del backend
3. Endpoints de API
4. Componentes de frontend
5. Integración end-to-end

### Fase 4: Validación

**Checklist:**
- ✅ La feature funciona según lo esperado
- ✅ Casos edge manejados apropiadamente
- ✅ Errores manejados con mensajes claros
- ✅ UX es fluida y clara
- ✅ Código sigue convenciones del proyecto
- ✅ Documentación actualizada

## Ejemplos de Features

### Feature 1: Presupuestos por Categoría

**User Story:**
Como usuario, quiero establecer presupuestos mensuales por categoría para controlar mis gastos.

**Flujo:**
1. Usuario: "quiero poner presupuesto de 5000 en comida"
2. Sistema: Parsea mensaje y extrae categoría + monto
3. Sistema: Guarda presupuesto en DB
4. Sistema: Confirma "Listo, tu presupuesto de Comida es $5,000/mes"
5. Cuando el usuario consulta estado: muestra presupuesto vs gasto real

**Implementación:**

**DB Schema:**
```sql
CREATE TABLE budgets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_phone VARCHAR(10) NOT NULL,
    category_id INTEGER NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    period VARCHAR(10) DEFAULT 'monthly', -- monthly, weekly
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_phone) REFERENCES users(phone),
    FOREIGN KEY (category_id) REFERENCES categories(id),
    UNIQUE(user_phone, category_id, period)
);
```

**API:**
```
POST /api/budget
GET  /api/budgets/:user_phone
PUT  /api/budget/:id
DELETE /api/budget/:id
```

**OpenAI Parser:**
Agregar function `set_budget` al parser_intent

**Financial Engine:**
Modificar cálculo de resumen para incluir presupuesto vs real

**UI:**
Mostrar barra de progreso en resumen por categoría

---

### Feature 2: Recordatorios de Gastos Recurrentes

**User Story:**
Como usuario, quiero que el sistema me recuerde gastos fijos mensuales (renta, suscripciones).

**Flujo:**
1. Usuario: "cada 5 del mes pago 5000 de renta"
2. Sistema: Crea recordatorio recurrente
3. El día 5: Sistema envía mensaje recordatorio
4. Usuario confirma o modifica

**Implementación:**

**DB Schema:**
```sql
CREATE TABLE recurring_expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_phone VARCHAR(10) NOT NULL,
    category_id INTEGER NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    day_of_month INTEGER NOT NULL,
    description TEXT,
    active BOOLEAN DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_phone) REFERENCES users(phone),
    FOREIGN KEY (category_id) REFERENCES categories(id)
);
```

**Backend:**
- Agregar endpoint POST /api/recurring
- Crear job diario que revise recordatorios
- Enviar notificación (webhook a WhatsApp o UI)

---

### Feature 3: Exportar Estado Financiero (PDF/Excel)

**User Story:**
Como usuario, quiero exportar mi estado financiero del mes en PDF o Excel.

**Flujo:**
1. Usuario: "quiero exportar mi estado de noviembre"
2. Sistema: Genera reporte
3. Sistema: Envía link de descarga o archivo adjunto

**Implementación:**

**Backend:**
```javascript
// Usar librerías: pdfkit o puppeteer para PDF
// xlsx para Excel

async function generatePDF(userPhone, period) {
  const summary = await getSummary(userPhone, period);
  const transactions = await getTransactions(userPhone, period);

  const doc = new PDFDocument();
  // Generar PDF...

  return doc;
}
```

**API:**
```
GET /api/export/pdf?user_phone=xxx&period=2025-11
GET /api/export/excel?user_phone=xxx&period=2025-11
```

**OpenAI Parser:**
Agregar function `request_export`

---

## Template para Nueva Feature

```markdown
## ✨ Feature: [Nombre]

### 📋 User Story
Como [tipo de usuario], quiero [objetivo] para [beneficio].

### 🎯 Criterios de Aceptación
- [ ] Criterio 1
- [ ] Criterio 2
- [ ] Criterio 3

### 🔄 Flujo de Usuario
1. Usuario hace X
2. Sistema responde Y
3. Usuario confirma Z

### 🏗️ Diseño Técnico

#### Backend
- Endpoints: [lista]
- Servicios: [lista]
- Cambios en DB: [schema]

#### Frontend
- Componentes: [lista]
- Interacciones: [descripción]

#### OpenAI
- Nuevas funciones/prompts: [descripción]

### 📝 Plan de Implementación
1. [ ] Tarea 1
2. [ ] Tarea 2
3. [ ] Tarea 3

### ✅ Validación
- Caso 1: [descripción + resultado esperado]
- Caso 2: [descripción + resultado esperado]
```

## Principios para Nuevas Features

### ✅ Hacer:
- Mantener simplicidad
- Seguir el estilo conversacional
- Validar contra documento base
- Pensar en el usuario final
- Considerar mantenibilidad
- Documentar claramente
- Implementar por fases si es complejo

### ❌ Evitar:
- Sobre-ingeniería
- Features que compliquen el flujo
- Romper la arquitectura existente
- Agregar dependencias innecesarias
- Crear inconsistencias con features existentes
- Ignorar casos edge
- Saltarse la fase de diseño

## Checklist Final

Antes de dar por terminada la feature:

- [ ] Funciona según los criterios de aceptación
- [ ] Código es limpio y mantenible
- [ ] Documentación actualizada
- [ ] Casos edge manejados
- [ ] Errores manejados apropiadamente
- [ ] UX es clara e intuitiva
- [ ] No rompe funcionalidades existentes
- [ ] Performance es aceptable
- [ ] Compatible con mobile
- [ ] Probado en navegadores principales (si aplica)

## Instrucciones Finales

Diseña con cuidado, implementa con precisión. Una buena feature agrega valor sin agregar complejidad innecesaria.
