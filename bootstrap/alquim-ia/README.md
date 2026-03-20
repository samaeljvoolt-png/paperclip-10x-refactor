# Bootstrap de Alquim-IA en un comando

Este perfil empaqueta la parte pública y reproducible de la empresa `Alquim-IA`:

- metadatos de la empresa
- roster curado de agentes
- jerarquía (`reportsTo`)
- roles y prompt templates
- documentos de gobierno de organización y skills

Intencionalmente **no** incluye:

- token del gateway de OpenClaw
- llaves de dispositivo
- claim files activos
- secretos de Better Auth
- API keys reales

## División pública vs privada

Usa:

- `bootstrap/alquim-ia/public/` para el perfil público versionado
- un JSON privado para los secretos reales
- un repo o carpeta privada opcional con tus workspaces reales de OpenClaw

## Instalación guiada para principiantes

Si quieres la experiencia más simple posible, usa el wrapper:

```bash
./scripts/setup-alquim-ia.sh
```

Ese setup hace esto:

1. valida macOS/Linux + `curl` + `git`
2. instala la versión pública de OpenClaw si no existe
3. activa `pnpm` si falta
4. te pide solo la API key del proveedor de modelos
5. ejecuta `openclaw onboard` en modo no interactivo
6. genera/recupera el gateway token automáticamente
7. instala el árbol de agentes de Alquim-IA en `~/.openclaw/agents`
8. instala las skills públicas del repo en `~/.openclaw/skills`
9. aplica un bundle privado opcional si existe en `~/.config/paperclip-bootstrap/alquim-ia.bundle`
10. arranca Paperclip local
11. bootstrapea la empresa `Alquim-IA`

## Un solo comando avanzado

```bash
pnpm bootstrap:alquim-ia --private-config ~/.config/paperclip-bootstrap/alquim-ia.private.json
```

## Configuración privada

Parte de:

```text
bootstrap/alquim-ia/private-config.example.json
```

Y cópialo a:

```text
~/.config/paperclip-bootstrap/alquim-ia.private.json
```

Ese instalador va a:

1. importar o actualizar la empresa `Alquim-IA`
2. configurar todos los agentes `openclaw_gateway` con tu URL/token reales
3. generar un claim file por agente
4. copiar tus carpetas privadas de agentes OpenClaw a `~/.openclaw/agents`
5. copiar tus skills privadas de OpenClaw a `~/.openclaw/skills`
6. verificar que la empresa quede bien armada

## Contenido del perfil público

- `public/paperclip.manifest.json`
- `public/COMPANY.md`
- `public/agents/*/AGENTS.md`
- `public/docs/ORGANIZATION.md`
- `public/docs/SKILLS.md`

## Notas

- El perfil público excluye agentes efímeros de smoke usados solo durante la refactorización.
- El instalador es idempotente: si ya existe una empresa llamada `Alquim-IA`, la actualiza en vez de duplicarla.
- Para paridad total con tu stack privado, crea un bundle opcional en `~/.config/paperclip-bootstrap/alquim-ia.bundle` con:
  - `agents/<slug>/AGENTS.md`
  - `skills/<skill>/SKILL.md`
  - `docs/ORGANIZATION.md`
  - `docs/SKILLS.md`
