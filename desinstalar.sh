#!/usr/bin/env bash
# Desinstala los artefactos descargados por el instalador.
# Conserva el código fuente, las licencias y tus imágenes de outputs/.
set -euo pipefail
cd "$(dirname "$0")"

if [ "${1:-}" != "--yes" ] && [ "${1:-}" != "-y" ]; then
  printf 'Se borrarán motores, modelos, Node.js portable, registros y descargas temporales.\n'
  printf 'Se conservarán outputs/ y el código fuente. ¿Continuar? [s/N] '
  read -r answer || true
  case "${answer:-}" in
    s|S|si|sí|Si|SI|y|Y) ;;
    *) echo "Cancelado."; exit 0 ;;
  esac
fi

echo "Deteniendo el estudio si está en ejecución..."
bash scripts/stop.sh 2>/dev/null || true

echo "Eliminando artefactos de la instalación..."
rm -rf \
  node/ \
  runtime-cpu-v0.2.1/ \
  runtime-vulkan-v0.2.1/ \
  runtime-v0.2.1/ \
  logs/ \
  .downloads/ \
  models/qwen_image_2.1*.gguf \
  models/qwen_image_2.1*.safetensors \
  models/Qwen-Image-2.1-*.gguf \
  models/Qwen3VL-*.gguf \
  models/Qwen3-VL-*.gguf \
  models/mmproj-*.gguf \
  models/loras/ \
  models/merged-lora.json \
  model-selection.json \
  model-selection.json.tmp \
  model-selection.pending.json \
  model-selection.pending.json.tmp

echo "Desinstalación completa. Se conservaron outputs/ y los archivos de código fuente."
