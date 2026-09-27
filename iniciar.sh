#!/usr/bin/env bash
# Inicia Qwen Imagen Studio (Linux).
set -euo pipefail
cd "$(dirname "$0")"
exec bash scripts/start.sh "$@"
