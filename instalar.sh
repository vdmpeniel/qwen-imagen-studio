#!/usr/bin/env bash
# Instalador de Qwen Imagen Studio (Linux).
set -euo pipefail
cd "$(dirname "$0")"
exec bash scripts/install.sh "$@"
