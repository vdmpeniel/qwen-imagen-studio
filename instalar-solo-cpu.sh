#!/usr/bin/env bash
# Instalación solo CPU (Linux): omite los motores de GPU.
set -euo pipefail
cd "$(dirname "$0")"
exec bash scripts/install.sh --backend cpu "$@"
