#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ "${OSTYPE:-}" != darwin* && "${OSTYPE:-}" != linux* ]]; then
  echo "Este setup solo soporta macOS y Linux."
  exit 1
fi

for cmd in curl git bash; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Falta el comando requerido: $cmd"
    exit 1
  fi
done

if ! command -v openclaw >/dev/null 2>&1; then
  echo "[setup] Instalando OpenClaw público con el instalador oficial..."
  curl -fsSL https://openclaw.ai/install.sh | bash -s -- --no-onboard
  hash -r
fi

if ! command -v openclaw >/dev/null 2>&1; then
  echo "OpenClaw no quedó disponible en PATH después del instalador."
  echo "Abre una nueva terminal o revisa la salida del instalador oficial."
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Node sigue sin estar disponible después de instalar OpenClaw."
  exit 1
fi

if ! command -v pnpm >/dev/null 2>&1; then
  if command -v corepack >/dev/null 2>&1; then
    echo "[setup] Activando pnpm con corepack..."
    corepack enable
    corepack prepare pnpm@9.15.4 --activate
  else
    echo "[setup] Instalando pnpm globalmente..."
    npm install -g pnpm@9.15.4
  fi
fi

cd "$ROOT_DIR"
node scripts/setup-alquim-ia.mjs "$@"
