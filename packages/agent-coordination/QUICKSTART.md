# Quick Start: Agent Coordination

## Para Codex CLI

En tu configuración de Codex, inicializa la sesión:

```bash
# Inicializar sesión
AGENT_TYPE=codex AGENT_NAME="Codex CLI" pnpm agent-coord init

# Antes de editar un archivo
pnpm agent-coord lock ui/src/components/NewIssueDialog.tsx

# Editar el archivo...

# Después de editar
pnpm agent-coord unlock ui/src/components/NewIssueDialog.tsx

# Enviar mensaje a otros agentes
pnpm agent-coord message "Terminé de actualizar NewIssueDialog.tsx"

# Ver mensajes de otros agentes
pnpm agent-coord messages

# Ver estado general
pnpm agent-coord status

# Al finalizar sesión
pnpm agent-coord cleanup
```

## Para Gemini

```bash
# Inicializar sesión
AGENT_TYPE=gemini AGENT_NAME="Gemini" pnpm agent-coord init

# Verificar si un archivo está bloqueado
pnpm agent-coord locked ui/src/components/File.tsx

# Ver actividad reciente
pnpm agent-coord activity 30

# Enviar mensaje
pnpm agent-coord message "Empezando a trabajar en auth module"
```

## Uso Programático

```typescript
import { AgentSession } from '@paperclipai/agent-coordination';

const session = new AgentSession({
  agentType: 'codex',
  agentName: 'Codex CLI',
});

await session.initialize();

// Adquirir lock
await session.acquireLock('src/file.ts');

// Trabajar en el archivo
await editFile();

// Liberar lock
await session.releaseLock('src/file.ts');

// Cleanup
await session.cleanup();
```

## Comandos Disponibles

| Comando | Descripción |
|---------|-------------|
| `init` | Inicializar sesión de coordinación |
| `status` | Ver agentes activos y estado |
| `lock <archivo>` | Adquirir lock en archivo/recurso |
| `unlock <archivo>` | Liberar lock |
| `locked <archivo>` | Verificar si está bloqueado |
| `message <texto>` | Enviar mensaje a otros agentes |
| `messages` | Ver mensajes de otros agentes |
| `activity [n]` | Ver últimas n actividades |
| `log <texto>` | Registrar actividad personalizada |
| `cleanup` | Limpiar y finalizar sesión |

## Variables de Entorno

- `AGENT_TYPE`: Tipo de agente (requerido: 'codex', 'gemini', 'claude', etc.)
- `AGENT_NAME`: Nombre legible del agente (opcional)
- `AGENT_COORDINATION_DIR`: Directorio de coordinación (default: `.agent-coordination`)

## Flujo Típico

1. **Iniciar**: `pnpm agent-coord init`
2. **Verificar**: `pnpm agent-coord status` - ver qué otros agentes están activos
3. **Leer mensajes**: `pnpm agent-coord messages` - ver contexto de otros agentes
4. **Bloquear archivo**: `pnpm agent-coord lock src/file.ts`
5. **Trabajar**: Editar archivos
6. **Registrar**: `pnpm agent-coord message "Terminé src/file.ts"`
7. **Desbloquear**: `pnpm agent-coord unlock src/file.ts`
8. **Limpiar**: `pnpm agent-coord cleanup`
