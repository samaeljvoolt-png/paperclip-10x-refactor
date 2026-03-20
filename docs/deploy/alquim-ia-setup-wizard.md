---
title: Alquim-IA Setup Wizard
summary: Instalación guiada de OpenClaw público + Paperclip + empresa Alquim-IA
---

## Objetivo

Este wizard existe para quitarle al operador principiante la parte más frágil del setup:

- instalar OpenClaw público
- generar y recuperar el gateway token
- sembrar agents y skills de Alquim-IA
- arrancar Paperclip local
- crear la empresa completa en una sola pasada

## Comando recomendado

Desde la raíz del repo:

```bash
./scripts/setup-alquim-ia.sh
```

## Qué valida

- sistema operativo: macOS o Linux
- `curl`
- `git`
- `node`
- `pnpm`
- `openclaw`

Si `openclaw` no existe, el wrapper llama al instalador oficial público:

```bash
curl -fsSL https://openclaw.ai/install.sh | bash -s -- --no-onboard
```

## Qué pide al usuario

En el flujo normal, solo:

- proveedor principal de modelos
- API key del proveedor

Si ya existe una key en variables de entorno, el wizard la reutiliza y no vuelve a pedirla.

## Qué instala en OpenClaw

- árbol de agentes de `Alquim-IA` en `~/.openclaw/agents`
- skills públicas del repo en `~/.openclaw/skills`
- bundle privado opcional en `~/.config/paperclip-bootstrap/alquim-ia.bundle`

## Bundle privado opcional

Si quieres máxima paridad con tu stack privado, crea:

```text
~/.config/paperclip-bootstrap/alquim-ia.bundle/
```

Con esta estructura:

```text
agents/<slug>/AGENTS.md
skills/<skill>/SKILL.md
docs/ORGANIZATION.md
docs/SKILLS.md
```

El wizard detecta ese bundle automáticamente y lo superpone sobre el perfil público.

## Qué deja persistido

- config privada del bootstrap:
  - `~/.config/paperclip-bootstrap/alquim-ia.private.json`
- logs locales de Paperclip:
  - `~/.config/paperclip-bootstrap/alquim-ia/logs/paperclip.log`
- PID del Paperclip local levantado por el wizard:
  - `~/.config/paperclip-bootstrap/alquim-ia/paperclip.pid`

## Qué hace después de OpenClaw

1. ejecuta `openclaw onboard --non-interactive`
2. fuerza gateway token si falta
3. recupera `gateway.auth.token`
4. arma la config privada para Paperclip
5. arranca Paperclip local si no está sano
6. ejecuta `pnpm bootstrap:alquim-ia`

## Parámetros útiles

```bash
pnpm setup:alquim-ia --help
```

Flags importantes:

- `--provider <id>`
- `--api-key <key>`
- `--private-bundle <dir>`
- `--paperclip-public-url <url>`
- `--skip-openclaw-install`
- `--skip-openclaw-onboard`
- `--skip-paperclip-start`
- `--skip-bootstrap`
- `--dry-run`

## Qué no guarda el branch público

- API keys reales
- gateway token real
- claim files activos
- llaves privadas
- secretos de Better Auth

## Siguiente paso recomendado

Cuando termine el wizard:

1. abre Paperclip en `http://127.0.0.1:3100`
2. verifica la empresa `Alquim-IA`
3. si usarás un dominio o despliegue remoto, cambia `paperclip.agentReachableApiUrl` en tu config privada y vuelve a correr `pnpm bootstrap:alquim-ia`
