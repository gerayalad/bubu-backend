# 🧠 Ultra Think — Análisis Profundo

Activa el modo de pensamiento ultra-profundo para analizar problemas complejos con máximo detalle.

## Contexto del Proyecto
Este es un sistema de finanzas personales con webchat, OpenAI y base de datos. El sistema interpreta mensajes naturales para registrar transacciones y responder consultas sobre estados financieros.

## Tu Tarea

Analiza profundamente el problema o pregunta que el usuario te presente. Debes:

1. **Descomponer el problema** en sus componentes fundamentales
2. **Examinar el contexto completo** del proyecto (arquitectura, flujos, dependencias)
3. **Identificar todos los aspectos relevantes:**
   - Técnicos (código, base de datos, APIs)
   - Arquitectónicos (diseño, patrones, estructura)
   - De negocio (reglas, flujos, casos de uso)
   - De usuario (UX, casos edge, validaciones)

4. **Considerar múltiples enfoques** y sus trade-offs
5. **Evaluar riesgos y efectos secundarios** de cada solución
6. **Proponer la mejor solución** justificada con razonamiento profundo

## Modo de Análisis

Cuando uses este comando, dedica tiempo a:

- Leer y analizar código relevante
- Revisar la documentación del proyecto
- Examinar las dependencias entre componentes
- Considerar casos edge y escenarios poco comunes
- Pensar en escalabilidad y mantenibilidad
- Evaluar impacto en rendimiento
- Considerar implicaciones de seguridad
- Anticipar problemas futuros

## Output Esperado

Tu respuesta debe incluir:

### 1. Análisis del Problema
- ¿Qué es exactamente lo que se necesita?
- ¿Cuáles son los requisitos explícitos e implícitos?
- ¿Qué restricciones existen?

### 2. Contexto Relevante
- ¿Qué partes del sistema están involucradas?
- ¿Qué dependencias existen?
- ¿Qué código o documentos son relevantes?

### 3. Opciones Consideradas
- Opción A: [Descripción, pros, contras]
- Opción B: [Descripción, pros, contras]
- Opción C: [Descripción, pros, contras]

### 4. Recomendación
- ¿Cuál es la mejor solución y por qué?
- ¿Qué trade-offs implica?
- ¿Qué riesgos hay que mitigar?

### 5. Plan de Implementación
- Pasos específicos a seguir
- Orden de ejecución
- Puntos de validación

## Ejemplo de Uso

```
Usuario: /ultrathink cómo debería manejar correcciones de transacciones cuando el usuario dice "no, eran 200 no 300"
```

**Respuesta esperada:**

### Análisis del Problema
El usuario necesita corregir una transacción ya registrada. Esto implica:
- Identificar QUÉ transacción corregir (la última, una específica?)
- Entender QUÉ campo corregir (monto, categoría, fecha?)
- Decidir si MODIFICAR la transacción o crear una nueva

### Contexto Relevante
- El sistema actualmente solo CREA transacciones (parser_intent → create_transaction)
- No existe endpoint PUT/PATCH para editar transacciones
- El mensaje original se guarda en `original_message` para auditoría
- Las correcciones podrían ser: monto, fecha, categoría, o tipo (income/expense)

### Opciones Consideradas

**Opción A: Modificar transacción existente (UPDATE)**
- Pros: Historial limpio, no duplica registros
- Contras: Perdemos auditoría del error original, complejidad en identificar cuál editar

**Opción B: Crear transacción de corrección (reversa + nueva)**
- Pros: Auditoría completa, método contable apropiado
- Contras: Más registros en DB, puede confundir al usuario

**Opción C: Borrar y recrear**
- Pros: Simple de implementar
- Contras: Perdemos auditoría, riesgoso

### Recomendación
**Opción B con variante**: Implementar un sistema de correcciones que:
1. Detecte intención de corrección en el parser
2. Identifique la transacción a corregir (por defecto la última de ese tipo)
3. Marque la original como "corregida" (soft delete o flag)
4. Cree nueva transacción con datos correctos
5. Mantenga referencia entre ambas (correction_of_id)

Esto mantiene auditoría completa y sigue principios contables.

### Plan de Implementación
[Pasos detallados...]

---

## Instrucciones Finales

Tómate el tiempo necesario para pensar profundamente. No te apresures. La calidad del análisis es más importante que la velocidad de respuesta.

Sé exhaustivo pero claro. Explica tu razonamiento.
