#!/usr/bin/env bash
# Compila sd-server con backend CUDA para esta revisión fijada.
# Uso: scripts/build-cuda.sh <carpeta-destino>
# Sin binario CUDA precompilado en Linux, compilar el motor es la única vía para usar CUDA.
# Si falla, el instalador usa Vulkan para la GPU. NO probado en este equipo (sin NVIDIA).
set -euo pipefail

DEST="${1:?Uso: $0 <carpeta-destino>}"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENGINE_REV="88411ef"
TAG="master-908-${ENGINE_REV}"

for cmd in git cmake nvcc curl unzip; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Falta $cmd. Instálalo, por ejemplo: sudo apt install -y git cmake nvidia-cuda-toolkit curl unzip" >&2
    exit 1
  fi
done

WORK=".downloads/sd-build-cuda"
rm -rf "$WORK"
mkdir -p .downloads
git clone --depth 1 --branch "$TAG" https://github.com/leejet/stable-diffusion.cpp.git "$WORK"
cd "$WORK"
mkdir -p build && cd build
cmake .. -DSD_CUDA=ON -DCMAKE_BUILD_TYPE=Release
cmake --build . --config Release -j "$(nproc)"
mkdir -p "$PROJECT_ROOT/$DEST"
cp -f bin/sd-server "$PROJECT_ROOT/$DEST/sd-server"
chmod +x "$PROJECT_ROOT/$DEST/sd-server"
echo "CUDA sd-server instalado en $DEST."
