#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ "${OSTYPE:-}" != darwin* && "${OSTYPE:-}" != linux* ]]; then
  echo "This setup only supports macOS and Linux."
  exit 1
fi

detect_package_manager() {
  if command -v apt-get >/dev/null 2>&1; then
    echo "apt"
    return
  fi
  if command -v dnf >/dev/null 2>&1; then
    echo "dnf"
    return
  fi
  if command -v pacman >/dev/null 2>&1; then
    echo "pacman"
    return
  fi
  echo ""
}

if [[ "${OSTYPE:-}" == darwin* ]]; then
  PACKAGE_MANAGER="brew"
else
  PACKAGE_MANAGER="$(detect_package_manager)"
fi

MISSING_COMMANDS=()
for cmd in curl git; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    MISSING_COMMANDS+=("$cmd")
  fi
done

if [[ "${#MISSING_COMMANDS[@]}" -gt 0 ]]; then
  echo "Detected missing commands: ${MISSING_COMMANDS[*]}. Installing prerequisites..."
  if [[ "$PACKAGE_MANAGER" == "brew" ]]; then
    if ! command -v brew >/dev/null 2>&1; then
      echo "Homebrew is required to install missing packages on macOS."
      exit 1
    fi
    brew install "${MISSING_COMMANDS[@]}"
  elif [[ "$PACKAGE_MANAGER" == "apt" ]]; then
    sudo apt-get update
    sudo apt-get install -y "${MISSING_COMMANDS[@]}"
  elif [[ "$PACKAGE_MANAGER" == "dnf" ]]; then
    sudo dnf install -y "${MISSING_COMMANDS[@]}"
  elif [[ "$PACKAGE_MANAGER" == "pacman" ]]; then
    sudo pacman -Sy "${MISSING_COMMANDS[@]}"
  else
    echo "No supported package manager found. Install ${MISSING_COMMANDS[*]} manually."
    exit 1
  fi
fi

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
