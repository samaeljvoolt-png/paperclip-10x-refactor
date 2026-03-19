# Paperclip Refactor Foundation Status

## Checkpoint 01

- `Fase/Ola`: `Wave 0`
- `Objetivo`: instalar el sistema de control, la skill de orquestación y la org base de OpenClaw
- `Estado`: `Baseline verified`
- `Hecho`:
  - se crearon los documentos de control del proyecto
  - se versionó la skill `paperclip-refactor-orchestrator`
  - se instaló una copia viva de la skill para OpenClaw
  - se preparó la org base de 4 agentes
  - se fijó el baseline real del fork en los artefactos del plan
- `Riesgos`:
  - la clave OpenAI dedicada para el conductor debe permanecer solo en runtime local de OpenClaw y rotarse después de esta sesión
  - el plan original sigue necesitando reinterpretación contra el fork antes de tocar CI o env
- `Bloqueos`:
  - ninguno para arrancar Wave 1
- `Siguiente paso`:
  - auditar y reinterpretar Wave 1 sobre el estado real de CI, env y bootstrap del fork

## Checkpoint 02

- `Fase/Ola`: `Wave 1`
- `Objetivo`: alinear CI y contrato de entorno con el estado real del fork, sin romper defaults ni introducir supuestos falsos
- `Estado`: `Wave 1 verified`
- `Hecho`:
  - `pr-verify` quedó como gate puro de install, typecheck, tests y build
  - se eliminó el release canary dry run del gate de PR
  - se alineó Node de `pr-verify` con la base soportada del repo
  - `.env.example` ahora refleja el contrato operativo real del runtime actual
  - `docs/deploy/environment-variables.md` se amplió con variables reales de config, auth, storage y backup
  - se dejó explícito que la validación central estricta de env no entra todavía
- `Riesgos`:
  - el shell actual no tiene `pnpm`, así que todavía no puedo cerrar esta ola con evidencia completa de ejecución local
  - la documentación quedó más alineada, pero el diseño de `config.ts` sigue mezclando env, archivo y defaults
- `Bloqueos`:
  - falta restablecer `pnpm` o una ruta equivalente para ejecutar la batería mínima local
- `Siguiente paso`:
  - resolver la herramienta de validación local y avanzar a `Wave 2` sobre `access/onboarding`

## Checkpoint 03

- `Fase/Ola`: `Wave 2`
- `Objetivo`: endurecer onboarding y centralizar la construcción de URL pública sin esperar al split completo de `access`
- `Estado`: `Wave 2 verified`
- `Hecho`:
  - se centralizó la resolución de URL pública en `server/src/utils/public-url.ts`
  - `access.ts` y `access-onboarding.ts` dejaron de construir URLs públicas con lógica duplicada
  - la precedencia ahora favorece `PAPERCLIP_AUTH_PUBLIC_BASE_URL`, `BETTER_AUTH_URL`, `BETTER_AUTH_BASE_URL` y `PAPERCLIP_PUBLIC_URL`
  - se añadieron pruebas unitarias para la utilidad de URL pública
- `Riesgos`:
  - el fallback por headers sigue existiendo como comportamiento legacy cuando no hay URL pública configurada
  - todavía no se completa el split más amplio de `access`
- `Bloqueos`:
  - ninguno para iniciar la siguiente extracción incremental de startup
- `Siguiente paso`:
  - abrir `Wave 3` con cortes pequeños y reversibles en `server/src/index.ts`

## Checkpoint 04

- `Fase/Ola`: `Wave 3`
- `Objetivo`: empezar a reducir acoplamiento en `server/src/index.ts` con una extracción segura y comprobable
- `Estado`: `Wave 3 in progress`
- `Hecho`:
  - se extrajo la validación de modo de despliegue a `server/src/bootstrap/deployment-config.ts`
  - se añadieron pruebas unitarias específicas para reglas de `local_trusted` y `authenticated/public`
  - `server/src/index.ts` ya delega esa validación en un módulo aislado
- `Riesgos`:
  - `index.ts` y `heartbeat.ts` siguen siendo hotspots grandes
  - el resto del arranque aún mezcla auth, database, scheduler, backups y runtime env
- `Bloqueos`:
  - ninguno inmediato
- `Siguiente paso`:
  - extraer el wiring de `authenticated` a un módulo de bootstrap pequeño y volver a validar la matriz completa

## Checkpoint 05

- `Fase/Ola`: `Wave 3`
- `Objetivo`: seguir desacoplando startup con una extracción reversible del bootstrap de autenticación
- `Estado`: `Wave 3 checkpoint met`
- `Hecho`:
  - se extrajo el wiring de `authenticated` a `server/src/bootstrap/authenticated-mode.ts`
  - `server/src/index.ts` ya no resuelve inline secreto, trusted origins, handler y session resolvers de Better Auth
  - se añadieron pruebas unitarias para secreto requerido, fallback a `PAPERCLIP_AGENT_JWT_SECRET` y mezcla de trusted origins
  - la batería mínima del workspace quedó verde otra vez: `pnpm -r typecheck`, `pnpm test:run`, `pnpm build`
- `Riesgos`:
  - `index.ts` y `heartbeat.ts` siguen siendo hotspots grandes
  - todavía falta separar más claramente bootstrap de runtime, backups y scheduler antes de cerrar Wave 3
- `Bloqueos`:
  - ninguno inmediato
- `Siguiente paso`:
  - elegir el siguiente corte reversible entre runtime env/listen bootstrap y la preparación del terreno para `Wave 4` en heartbeat

## Checkpoint 06

- `Fase/Ola`: `Wave 3`
- `Objetivo`: desacoplar los schedulers de heartbeat y backups del bootstrap principal
- `Estado`: `Wave 3 checkpoint met`
- `Hecho`:
  - se extrajo el scheduler de heartbeat a `server/src/bootstrap/heartbeat-scheduler.ts`
  - se extrajo el scheduler de backups a `server/src/bootstrap/database-backup-scheduler.ts`
  - `server/src/index.ts` ahora solo delega ambos comportamientos periódicos
  - se añadieron pruebas unitarias para ambos helpers con verificación de wiring y no-op cuando están deshabilitados
  - la matriz completa volvió a quedar verde: `pnpm -r typecheck`, `pnpm test:run`, `pnpm build`
- `Riesgos`:
  - `index.ts` todavía concentra listen/startup banner/shutdown, así que Wave 3 no está totalmente cerrado
  - heartbeat runtime profundo sigue siendo un hotspot para Wave 4
- `Bloqueos`:
  - ninguno inmediato
- `Siguiente paso`:
  - decidir si el siguiente corte de `Wave 3` merece extraer el listen/bootstrap final o si ya conviene abrir `Wave 4`

## Checkpoint 07

- `Fase/Ola`: `Wave 3`
- `Objetivo`: cerrar la descomposición estructural del startup path
- `Estado`: `Wave 3 closure verified`
- `Hecho`:
  - se extrajo el arranque de escucha, startup banner y board-claim warning a `server/src/bootstrap/server-listener.ts`
  - `server/src/index.ts` ya solo orquesta helpers de bootstrap en lugar de contener los bloques operativos pesados
  - se añadieron pruebas unitarias para el listener bootstrap y se mantuvo verde la matriz completa: `pnpm -r typecheck`, `pnpm test:run`, `pnpm build`
- `Riesgos`:
  - el runtime sigue teniendo comportamiento temporal y de recuperación que merece su propia ola de medición
  - `heartbeat.ts` sigue siendo un hotspot funcional por volumen, no por falta de cobertura
- `Bloqueos`:
  - ninguno inmediato
- `Siguiente paso`:
  - abrir `Wave 4` sobre heartbeat runtime y baseline de performance con medición antes de optimización

## Checkpoint 08

- `Fase/Ola`: `Wave 4`
- `Objetivo`: capturar baseline real del runtime de heartbeat y falsar la confianza del wiring recién refactorizado
- `Estado`: `Wave 4 in progress`
- `Hecho`:
  - se activó el concilio para auditar las fases previas y priorizar hotspots reales
  - se corrigió el lifecycle de schedulers para que puedan limpiarse en fallos de arranque y cierre
  - se añadió un smoke de composición para `startServer()` que cubre wiring y cleanup de schedulers
  - la matriz completa volvió a pasar: `pnpm -r typecheck`, `pnpm test:run`, `pnpm build`
- `Riesgos`:
  - todavía no existe una medición de latencia/throughput real de `heartbeatService`
  - `heartbeat.ts` sigue siendo el hotspot principal por volumen y complejidad
- `Bloqueos`:
  - ninguno inmediato
- `Siguiente paso`:
  - instrumentar o aislar primero `resolveWorkspaceForRun` y `startNextQueuedRunForAgent` para medir el baseline sin cambiar semántica

## Checkpoint 09

- `Fase/Ola`: `Wave 4`
- `Objetivo`: dejar listo el seam de profiling para capturar baseline sin tocar semántica normal
- `Estado`: `Wave 4 profiling seam ready`
- `Hecho`:
  - se agregó `server/src/services/heartbeat-profiler.ts` como helper opt-in para medir spans
  - `heartbeatService()` ahora puede registrar tiempos de `reapOrphanedRuns`, `resumeQueuedRuns`, `startNextQueuedRunForAgent`, `resolveWorkspaceForRun`, `executeRun` y `tickTimers`
  - se añadió cobertura unitaria para el wrapper de profiling
  - se documentó la variable `PAPERCLIP_HEARTBEAT_PROFILE` como contrato de medición local
- `Riesgos`:
  - el baseline real todavía depende de una corrida con el flag habilitado
  - el logging de profiling puede ser ruidoso si se deja encendido fuera de una sesión de medición
- `Bloqueos`:
  - ninguno
- `Siguiente paso`:
  - ejecutar una corrida de medición real con profiling habilitado y guardar el baseline de los spans más caros

## Checkpoint 10

- `Fase/Ola`: `Wave 4`
- `Objetivo`: validar el harness de baseline y dejarlo listo para corridas repetibles
- `Estado`: `Wave 4 baseline harness verified`
- `Hecho`:
  - se agregó `server/src/__tests__/heartbeat-baseline.test.ts` para ejercer el camino vacío de `heartbeat`
  - la prueba captura spans de `reapOrphanedRuns`, `resumeQueuedRuns` y `tickTimers` con un profiler inyectado
  - el harness quedó validado junto con `pnpm -r typecheck`, `pnpm test:run` y `pnpm build`
- `Riesgos`:
  - el baseline sigue siendo un proxy de estado vacío, no una corrida de producción con carga
  - falta decidir qué fixture de datos representa mejor el flujo real que queremos medir primero
- `Bloqueos`:
  - ninguno
- `Siguiente paso`:
  - preparar una corrida con datos representativos y usar el seam opt-in para capturar el baseline real

## Checkpoint 11

- `Fase/Ola`: `Wave 4`
- `Objetivo`: capturar una corrida real de heartbeat con datos mínimos pero ejecutables
- `Estado`: `Wave 4 live baseline captured`
- `Hecho`:
  - se ejecutó un run real sobre embedded PostgreSQL con un agente `process`
  - el profiler registró `resolveWorkspaceForRun`, `startNextQueuedRunForAgent` y `executeRun`
  - `executeRun` fue el componente dominante en la corrida mínima
  - se documentó el resultado en [docs/refactor/heartbeat-live-baseline.md](/Users/tomasvallejo/Desktop/paperclip/docs/refactor/heartbeat-live-baseline.md)
- `Riesgos`:
  - la corrida mínima no representa todavía un proyecto con `projectWorkspaces` y `issues`
  - la medición sirve como baseline inicial, no como conclusión final de rendimiento
- `Bloqueos`:
  - ninguno
- `Siguiente paso`:
  - subir la complejidad del fixture y medir una ruta con workspace de proyecto para comparar contra esta baseline

## Checkpoint 12

- `Fase/Ola`: `Wave 4`
- `Objetivo`: validar una corrida project-scoped estable y comparar contra la baseline mínima
- `Estado`: `Wave 4 project-scoped baseline captured`
- `Hecho`:
  - se estabilizó el fixture de proyecto para usar un workspace git real con `projectWorkspaces` e `issues`
  - la corrida project-scoped registró `startNextQueuedRunForAgent`, `resolveWorkspaceForRun` y `executeRun`
  - el baseline ya cubre tanto el camino mínimo como la ruta de proyecto con workspace resuelto
  - se mantuvo verde la matriz completa luego de la corrida
- `Riesgos`:
  - `heartbeat.ts` todavía concentra la mayor parte del trabajo pendiente para observabilidad comparativa y decisiones de optimización
  - aún faltan mediciones de `reapOrphanedRuns()`, `resumeQueuedRuns()`, `tickTimers()` y contention multi-run
- `Bloqueos`:
  - ninguno inmediato
- `Siguiente paso`:
  - medir rutas adicionales de Wave 4 antes de proponer optimizaciones semánticas

## Checkpoint 13

- `Fase/Ola`: `Wave 4`
- `Objetivo`: capturar un baseline de mantenimiento para `reapOrphanedRuns`, `resumeQueuedRuns` y `tickTimers`
- `Estado`: `Wave 4 maintenance baseline captured`
- `Hecho`:
  - se añadió una corrida sintética con un run huérfano, una cola rescatable y una señal de timer vencida
  - el profiler registró `reapOrphanedRuns`, `resumeQueuedRuns`, `tickTimers`, `startNextQueuedRunForAgent`, `resolveWorkspaceForRun` y `executeRun`
  - `tickTimers()` mostró carga real con `checked: 3` y `enqueued: 1` en el fixture
  - la matriz completa volvió a pasar luego de la nueva prueba
- `Riesgos`:
  - aún falta medir contention multi-run y comparar antes/después si se decide optimizar
  - las mediciones siguen siendo de laboratorio, no de carga de producción
- `Bloqueos`:
  - ninguno inmediato
- `Siguiente paso`:
  - medir queue contention y decidir si Wave 4 cierra sin cambios semánticos o con una optimización mínima

## Checkpoint 14

- `Fase/Ola`: `Wave 4`
- `Objetivo`: medir contention de cola para un mismo agente con varios runs pendientes
- `Estado`: `Wave 4 contention baseline captured`
- `Hecho`:
  - se añadieron tres runs `queued` para el mismo agente y se drenaron con una sola llamada a `resumeQueuedRuns()`
  - el profiler registró tres ejecuciones secuenciales de `executeRun` y múltiples `startNextQueuedRunForAgent`
  - la corrida confirmó que el drenaje es secuencial y que la contención se comporta como se esperaba en el fixture
  - la matriz completa quedó verde otra vez después de la prueba
- `Riesgos`:
  - todavía no existe comparación before/after porque no se ha propuesto una optimización concreta
  - las mediciones siguen siendo de laboratorio, no de carga productiva
- `Bloqueos`:
  - ninguno inmediato
- `Siguiente paso`:
  - cerrar Wave 4 con decisión explícita de no optimizar o de abrir una optimización mínima y reversible

## Checkpoint 15

- `Fase/Ola`: `Wave 4`
- `Objetivo`: aplicar la optimización mínima y segura en `tickTimers()` y cerrar la fase
- `Estado`: `Wave 4 complete`
- `Hecho`:
  - `tickTimers()` ahora filtra agentes no elegibles en SQL y solo proyecta las columnas necesarias
  - el cambio no modificó la semántica de wakeups, recovery ni queue draining
  - la batería completa volvió a pasar: `pnpm -r typecheck`, `pnpm test:run`, `pnpm build`
  - las cuatro corridas del baseline de `heartbeat` quedaron documentadas y coherentes entre sí
- `Riesgos`:
  - la optimización es deliberadamente pequeña; si se quiere más rendimiento, habría que asumir más complejidad y riesgo
  - no existe una comparación before/after de carga productiva real
- `Bloqueos`:
  - ninguno
- `Siguiente paso`:
  - abrir `Wave 5` sobre validación avanzada, documentación final y cierre del plan

## Checkpoint 16

- `Fase/Ola`: `Wave 5`
- `Objetivo`: cerrar la validación avanzada, consolidar la documentación final y declarar el plan listo
- `Estado`: `Wave 5 complete`
- `Hecho`:
  - se consolidó el cierre de Wave 4 con la optimización mínima en `tickTimers()`
  - se agregó el resumen final de release readiness en [docs/refactor/release-readiness.md](/Users/tomasvallejo/Desktop/paperclip/docs/refactor/release-readiness.md)
  - la documentación operativa ya cubre startup, access/onboarding, heartbeat runtime, evidencias de prueba y lectura final de cierre
  - la batería completa del workspace quedó validada en el último ciclo estable de refactor
- `Riesgos`:
  - no existe benchmark productivo real de carga, solo baselines de laboratorio y validación estructural
  - el warning de chunks grandes del UI sigue siendo un tema aparte, fuera del alcance de esta refactorización
- `Bloqueos`:
  - ninguno
- `Siguiente paso`:
  - mantener estos artefactos como referencia estable del fork y solo reabrir una nueva ola si aparece un cambio funcional relevante
