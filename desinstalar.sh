#!/usr/bin/env bash
# Desinstala los artefactos descargados por el instalador, conservando el código fuente.
set -euo pipefail
cd "$(dirname "$0")"

echo "Deteniendo el estudio si está en ejecución..."
bash scripts/stop.sh 2>/dev/null || true

echo "Eliminando artefactos de la instalación..."
rm -rf \
  node/ \
  runtime-cpu-v0.2.1/ \
  runtime-vulkan-v0.2.1/ \
  logs/ \
  outputs/ \
  .downloads/ \
  models/qwen_image_2.1*.gguf \
  models/qwen_image_2.1*.safetensors \
  models/Qwen3VL-*.gguf \
  models/mmproj-*.gguf \
  models/loras/ \
  models/merged-lora.json

echo "Desinstalación completa. Se conservaron los archivos de código fuente y licencias."
