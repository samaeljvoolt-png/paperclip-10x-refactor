---
title: Alquim-IA Bootstrap
summary: Instala el perfil completo de Alquim-IA con un solo comando
---

Este branch incluye un perfil público y reproducible para montar la empresa `Alquim-IA`.

El objetivo del diseño es:

- el repo público contiene la estructura de la empresa, prompts, jerarquía y lógica de instalación
- la configuración privada contiene los secretos y las carpetas privadas de agentes OpenClaw
- un solo comando materializa toda la empresa dentro de una instancia real de Paperclip

## Qué sí viaja en el branch público

- `bootstrap/alquim-ia/public/paperclip.manifest.json`
- `bootstrap/alquim-ia/public/COMPANY.md`
- `bootstrap/alquim-ia/public/agents/*/AGENTS.md`
- `bootstrap/alquim-ia/public/docs/ORGANIZATION.md`
- `bootstrap/alquim-ia/public/docs/SKILLS.md`
- `scripts/bootstrap-alquim-ia.mjs`

## Qué no viaja en el branch público

- token del gateway de OpenClaw
- claim files de agentes
- secretos de Better Auth
- API keys activas
- workspaces privados de OpenClaw

## Configuración privada

Parte del ejemplo:

`bootstrap/alquim-ia/private-config.example.json`

Ruta recomendada:

```bash
mkdir -p ~/.config/paperclip-bootstrap
cp bootstrap/alquim-ia/private-config.example.json ~/.config/paperclip-bootstrap/alquim-ia.private.json
```

Luego completa:

- `paperclip.apiUrl`
- `paperclip.agentReachableApiUrl`
- `openclaw.gatewayUrl`
- `openclaw.gatewayToken`
- `openclaw.agentsSourceDir`

## Instalación de un comando

Desde la raíz del repo:

```bash
pnpm bootstrap:alquim-ia --private-config ~/.config/paperclip-bootstrap/alquim-ia.private.json
```

El instalador va a:

1. comprobar el health de Paperclip
2. crear o actualizar la empresa `Alquim-IA`
3. importar el roster curado completo
4. inyectar tu configuración real de OpenClaw gateway
5. generar claim files por agente
6. copiar tus carpetas privadas de OpenClaw a `~/.openclaw/agents`
7. ejecutar la verificación post-instalación

## Modo preview

```bash
pnpm bootstrap:alquim-ia --private-config ~/.config/paperclip-bootstrap/alquim-ia.private.json --dry-run
```

## Idempotencia

El instalador es intencionalmente idempotente:

- si `Alquim-IA` ya existe, actualiza esa empresa en vez de crear un duplicado
- los agentes importados usan `collisionStrategy=replace`
- los claim files se regeneran
- las bootstrap keys previas se rotan

## Notas operativas

- El perfil excluye agentes efímeros de smoke usados en QA de la refactorización.
- El comando asume que se ejecuta contra una instancia de Paperclip accesible por loopback o red privada.
- Para instalaciones privadas o de servidor, ejecútalo en el mismo host donde `paperclip.apiUrl` sea alcanzable.
