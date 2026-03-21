#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ "${OSTYPE:-}" != darwin* && "${OSTYPE:-}" != linux* ]]; then
  echo "This setup only supports macOS and Linux."
  exit 1
fi

for cmd in curl git bash; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Missing required command: $cmd"
    exit 1
  fi
done

if ! command -v openclaw >/dev/null 2>&1; then
  echo "[setup] Installing the public OpenClaw CLI with the official installer..."
  curl -fsSL https://openclaw.ai/install.sh | bash -s -- --no-onboard
  hash -r
fi

if ! command -v openclaw >/dev/null 2>&1; then
  echo "OpenClaw was still not available in PATH after the installer finished."
  echo "Open a new terminal or review the official installer output."
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Node is still not available after installing OpenClaw."
  exit 1
fi

if ! command -v pnpm >/dev/null 2>&1; then
  if command -v corepack >/dev/null 2>&1; then
    echo "[setup] Enabling pnpm with corepack..."
    corepack enable
    corepack prepare pnpm@9.15.4 --activate
  else
    echo "[setup] Installing pnpm globally..."
    npm install -g pnpm@9.15.4
  fi
fi

cd "$ROOT_DIR"
node scripts/setup-alquim-ia.mjs "$@"
