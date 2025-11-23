1) 🧠 Agente Intérprete de Mensajes (NLP Agent / Parser Agent)

Rol: Interpretar cualquier mensaje natural y transformarlo en un JSON estructurado.
Responsable de:

Entender intención (gasto, ingreso, consulta, corrección).

Detectar montos, fechas, categorías, tipo de transacción.

Convertir lenguaje natural → schema JSON válido.

Razonar sobre fechas relativas (“ayer”, “el viernes”, “hoy en la mañana”).
Output: JSON 100% validado para backend.

Nombre sugerido: agent_parser_intent_v1

2) 💸 Agente Contable / Lógica Financiera (Bookkeeping Agent)

Rol: Ejecutar lógica del estado de resultados.
Responsable de:

Calcular saldos.

Consolidar transacciones por periodo.

Comparar meses.

Detectar categorías predominantes.

Normalizar fechas.

Proponer categorización cuando falta.

Output: Resumen numérico + estructura base para el agente redactor.

Nombre sugerido: agent_financial_engine_v1

3) 📝 Agente Redactor / Conversacional (Narrator Agent)

Rol: Convertir datos duros del backend en respuestas humanizadas.
Responsable de:

Tomar resultados SQL y redactar respuestas claras.

Mantener tono cálido, directo, simple (WhatsApp-friendly).

Matizar incertidumbre ("Con lo registrado hasta hoy…").

Redactar comparativos y resúmenes.
Output: Respuestas en texto final que ve el usuario.

Nombre sugerido: agent_narrative_v1

4) 🔍 Agente Auditor / Validación (Audit Agent)

Rol: Validar y auditar cada JSON generado.
Responsable de:

Revisar si el JSON del parser es válido.

Detectar valores imposibles (montos negativos incorrectos, fechas inválidas).

Pedir aclaraciones (“¿fue gasto o ingreso?”).

Confirmar si se requiere corrección o rollback.

Output: JSON validado o solicitud de aclaración.

Nombre sugerido: agent_audit_v1

5) 🧱 Agente Arquitecto (Architecture Agent)

Rol: Mantener coherencia de toda la solución y proponer mejoras.
Responsable de:

Revisar si el sistema sigue la arquitectura del documento base.

Sugerir mejoras: SQL, endpoints, seguridad, prompts.

Administrar versiones del documento base (v0.1 → v0.2 → v0.3).

Diseñar el diagrama de arquitectura cuando se lo pidas.

Output: Propuestas técnicas y decisiones de diseño.

Nombre sugerido: agent_architect_v1

6) 🧪 Agente Testing & QA (Test Agent)

Rol: Simular usuarios reales y probar el sistema.
Responsable de:

Generar casos de prueba (ej. “ayer gasté 200 en café”).

Probar mensajes ambiguos.

Evaluar si el parser interpretó bien.

Validar las respuestas conversacionales.

Crear escenarios extremos (montos grandes, fechas raras, categorías nuevas).

Output: Reportes de QA, sugerencias de mejora.

Nombre sugerido: agent_tester_v1

7) 🎨 Agente UI — Webchat Neumórfico (UI/UX Agent)

Rol: Diseñar e iterar la UI del chat neumórfico.
Responsable de:

Crear HTML/CSS/React del chat con neumorfismo.

Generar variantes móviles.

Ajustar colores, sombras, micro-interacciones.

Asegurar accesibilidad mínima.

Crear el input neumórfico + burbujas.

Output: Código frontend listo para copiar en Replit/Vercel.

Nombre sugerido: agent_ui_neumorphism_v1

8) 🔌 Agente Backend / API (Backend Agent)

Rol: Generar código backend minimalista y funcional.
Responsable de:

Diseñar endpoints (POST /transaction, GET /state, etc.).

Crear SQL de tablas (users, categories, transactions).

Implementar control por número de teléfono.

Integrar OpenAI function-calling.

Decidir si usar Supabase, Postgres, SQLite, o Neon.

Output: API funcional, controladores, SQL schema, ejemplos.

Nombre sugerido: agent_backend_v1

9) 📚 Agente Documentalista (Docs Agent)

Rol: Mantener toda la documentación clara y actualizada.
Responsable de:

Crear archivos MD:

/README.md

/docs/database.md

/docs/architecture.md

/docs/openai_prompts.md

/docs/webchat_ui.md

Mantener cada versión alineada a la arquitectura del producto.

Recibir tus feedback y generar nuevas versiones.

Output: Documentación versiónada.

Nombre sugerido: agent_docs_v1

10) 🔄 Agente Operador Multi-Agente (Coordinator Agent)

Rol: Coordinar los agentes anteriores.
Responsable de:

Enrutar tareas al agente adecuado.

Fusionar respuestas.

Mantener coherencia entre módulos.

Resolver conflictos (JSON incorrecto, diseño vs backend, etc.).

Output: Flujo final integrado.

Nombre sugerido: agent_orchestrator_v1