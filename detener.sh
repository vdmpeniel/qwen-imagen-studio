#!/usr/bin/env bash
# Detiene Qwen Imagen Studio (Linux).
set -euo pipefail
cd "$(dirname "$0")"
exec bash scripts/stop.sh "$@"
