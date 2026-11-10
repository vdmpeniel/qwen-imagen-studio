#!/usr/bin/env bash
# Instalador de Qwen Imagen Studio (Linux).
# Uso: ./instalar.sh [--backend auto|cpu|cuda|vulkan] [--no-merge] [--sin-gpu]
# Instalador de Qwen Imagen Studio (Linux): descarga y verifica motores, modelos y Node.js.
set -euo pipefail

BACKEND="auto"
NO_MERGE=0
while [ $# -gt 0 ]; do
  case "$1" in
    --backend) BACKEND="${2:-auto}"; shift 2 ;;
    --backend=*) BACKEND="${1#--backend=}"; shift ;;
    --no-merge) NO_MERGE=1; shift ;;
    --sin-gpu) BACKEND="cpu"; shift ;;
    -h|--help)
      echo "Uso: $0 [--backend auto|cpu|cuda|vulkan] [--no-merge]"
      echo "  cuda: compila sd-server con CUDA (requiere nvidia-cuda-toolkit); si falla, usa Vulkan."
      exit 0 ;;
    *) echo "Opción desconocida: $1" >&2; exit 1 ;;
  esac
done
case "$BACKEND" in
  auto|cpu|cuda|vulkan) ;;
  *) echo "Backend inválido: $BACKEND (auto|cpu|cuda|vulkan)" >&2; exit 1 ;;
esac

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"
# shellcheck source=common.sh
. "$PROJECT_ROOT/scripts/common.sh"

mkdir -p models logs .downloads outputs

ENGINE_REV="88411ef"
ENGINE_BASE="https://github.com/leejet/stable-diffusion.cpp/releases/download/master-908-${ENGINE_REV}"
CPU_ZIP_URL="$ENGINE_BASE/sd-master-${ENGINE_REV}-bin-Linux-Ubuntu-24.04-x86_64.zip"
CPU_ZIP_SHA="d8fd5749e7de377912588ba025bf8f7fb7fbc2c3cf16855cd0ee03b8c0eadec2"
VULKAN_ZIP_URL="$ENGINE_BASE/sd-master-${ENGINE_REV}-bin-Linux-Ubuntu-24.04-x86_64-vulkan.zip"
VULKAN_ZIP_SHA="3f898579f384a97368fed42daebc4ed81e65798c633ed09b84cb27812a65ba33"
NODE_VERSION="v24.21.0"
NODE_TAR_URL="https://nodejs.org/dist/$NODE_VERSION/node-$NODE_VERSION-linux-x64.tar.xz"
NODE_TAR_SHA="fd8e59d5a511510f6a298afb548f18c7d2b1be404d8b4a27d94fbe49f56cb2d6"

step() { echo; echo "== $1"; }

sha_ok() { # sha_ok file expected
  [ "$(sha256sum "$1" | awk '{print $1}')" = "$2" ]
}

# Descarga reanudable a <dest>.part; solo toma el nombre final tras el SHA256.
download() { # download url dest sha
  local url="$1" dest="$2" sha="$3"
  if [ -f "$dest" ]; then
    echo "Verificando $dest..."
    if sha_ok "$dest" "$sha"; then return 0; fi
    echo "AVISO: $dest no coincide con el archivo oficial; se descargará de nuevo." >&2
    rm -f "$dest"
  fi
  local part="$dest.part"
  echo "Descargando $dest..."
  if ! curl -fL --retry 8 --retry-all-errors -C - -o "$part" "$url"; then
    if [ -f "$part" ] && sha_ok "$part" "$sha"; then
      mv -f "$part" "$dest"
      return 0
    fi
    echo "Descarga interrumpida. Ejecuta el instalador nuevamente para reanudar $dest." >&2
    return 1
  fi
  if ! sha_ok "$part" "$sha"; then
    rm -f "$part"
    echo "El archivo descargado $dest no coincide con el oficial. Ejecuta el instalador nuevamente." >&2
    return 1
  fi
  mv -f "$part" "$dest"
}

runtime_unzip() { # runtime_unzip folder zip
  local folder="$1" zip="$2"
  mkdir -p "$folder"
  # Defensa contra zip-slip: rechaza rutas absolutas o con ..
  if unzip -l "$zip" | awk '{print $4}' | grep -Eq '(^/|(^|\/)\.\.(\/|$))'; then
    echo "Ruta no válida en $zip" >&2
    return 1
  fi
  unzip -o -q "$zip" -d "$folder"
  chmod +x "$folder/sd-server"
  rm -f "$zip"
}

runtime_fetch() { # runtime_fetch folder kind url sha
  local folder="$1" kind="$2" url="$3" sha="$4"
  if [ -x "$folder/sd-server" ]; then return 0; fi
  mkdir -p "$folder"
  local zip=".downloads/engine-$kind-$ENGINE_REV.zip"
  download "$url" "$zip" "$sha"
  runtime_unzip "$folder" "$zip"
}

echo "Instalador de Qwen Imagen Studio (Linux)"
FREE_GB="$(df -BG "$PROJECT_ROOT" | awk 'NR==2 {gsub(/G/,"",$4); print $4}')"
if [ "${FREE_GB:-99}" -lt 25 ]; then
  echo "AVISO: hay ${FREE_GB} GB libres. La instalación necesita unos 25 GB durante el proceso y ocupa unos 13 GB al terminar." >&2
fi

step "Node.js"
NODE_BIN="$(get_app_node "$PROJECT_ROOT" || true)"
if [ -n "${NODE_BIN:-}" ]; then
  echo "Usando $NODE_BIN"
else
  NODE_TAR=".downloads/node-$NODE_VERSION-linux-x64.tar.xz"
  download "$NODE_TAR_URL" "$NODE_TAR" "$NODE_TAR_SHA"
  rm -rf node .downloads/node-extract
  mkdir -p .downloads/node-extract
  tar -xJf "$NODE_TAR" -C .downloads/node-extract
  mv ".downloads/node-extract/node-$NODE_VERSION-linux-x64" node
  rm -rf .downloads/node-extract "$NODE_TAR"
  NODE_BIN="$(get_app_node "$PROJECT_ROOT")"
  echo "Node.js portable instalado en node/ ($NODE_VERSION)"
fi

cfg() {
  "$NODE_BIN" -e "const c=require('./model-config.json');process.stdout.write(String(c[process.argv[1]] ?? ''))" "$1"
}
RUNTIME_CPU="$(cfg runtimeCpu)"
RUNTIME_VULKAN="$(cfg runtimeVulkan)"
RUNTIME_CUDA="$(cfg runtime)"
LORA_SHA="$(cfg loraSha256)"

step "Dependencias del sistema (curl, unzip, libgomp1, libvulkan1)"
if ! check_linux_deps; then
  echo "Continúa la instalación, pero los motores fallarán hasta instalarlas." >&2
else
  echo "Dependencias OK."
fi

step "Motores stable-diffusion.cpp (Linux)"
runtime_fetch "$RUNTIME_CPU" "cpu-linux" "$CPU_ZIP_URL" "$CPU_ZIP_SHA"
if [ "$BACKEND" = "auto" ] || [ "$BACKEND" = "vulkan" ]; then
  runtime_fetch "$RUNTIME_VULKAN" "vulkan-linux" "$VULKAN_ZIP_URL" "$VULKAN_ZIP_SHA"
fi
HAS_NVIDIA=0
if command -v nvidia-smi >/dev/null 2>&1; then
  if nvidia-smi --query-gpu=name --format=csv,noheader 2>/dev/null | grep -q .; then
    HAS_NVIDIA=1
  fi
fi
if [ "$BACKEND" = "cuda" ] || { [ "$BACKEND" = "auto" ] && [ "$HAS_NVIDIA" -eq 1 ]; }; then
  # En Linux no hay zip CUDA precompilado para esta revisión: se compila.
  # Si la compilación falla, se usa Vulkan para la GPU (paridad degradada, sin SageAttention).
  if [ ! -x "$RUNTIME_CUDA/sd-server" ]; then
    if bash "$PROJECT_ROOT/scripts/build-cuda.sh" "$RUNTIME_CUDA"; then
      echo "Motor CUDA compilado en $RUNTIME_CUDA."
    else
      echo "AVISO: no se pudo compilar el motor CUDA; se usará Vulkan para la GPU." >&2
      runtime_fetch "$RUNTIME_VULKAN" "vulkan-linux" "$VULKAN_ZIP_URL" "$VULKAN_ZIP_SHA"
    fi
  fi
fi

step "Modelos: codificador de texto, lector de referencias y VAE"
download "https://huggingface.co/Qwen/Qwen3-VL-8B-Instruct-GGUF/resolve/main/Qwen3VL-8B-Instruct-Q4_K_M.gguf" \
  "models/Qwen3VL-8B-Instruct-Q4_K_M.gguf" \
  "67d1659bfe71b89d50b45a4ad1a9e5b997e5bb16ce5da66a6a6167abd569e9e2"
download "https://huggingface.co/Qwen/Qwen3-VL-8B-Instruct-GGUF/resolve/main/mmproj-Qwen3VL-8B-Instruct-F16.gguf" \
  "models/mmproj-Qwen3VL-8B-Instruct-F16.gguf" \
  "ca524100ebf825c9a870db1c580d03879e0da0ab2541697e2458e64891cf9d38"
download "https://huggingface.co/Comfy-Org/Qwen-Image-2.1/resolve/main/vae/qwen_image_2.1_vae_bf16.safetensors" \
  "models/qwen_image_2.1_vae_bf16.safetensors" \
  "bb21f7473051e1ac368515dd3f2e15cd44d7a11748ee8823e1ddca3e4876b7c9"

step "Modelo de imagen optimizado (Qwen-Image 2.1 + LoRA Viggle Turbo fusionado)"
# El LoRA se fusiona una vez sobre la base oficial Q8_0 y se guarda como Q4_K. Ambos orígenes son temporales.
MERGED=0
if "$NODE_BIN" "$PROJECT_ROOT/scripts/merge-lora.mjs" --verify; then
  MERGED=1
fi
SOURCE="$(cfg source)"
REVISION="$(cfg revision)"
LORA_FILE="$(cfg lora)"
LORA_URL="https://huggingface.co/$SOURCE/resolve/$REVISION/$LORA_FILE"
DOWNLOADED_LORA=".downloads/$LORA_FILE"
if [ "$MERGED" -eq 0 ] && [ "$NO_MERGE" -eq 0 ]; then
  echo "Descarga única de 9 GB y varios minutos de cálculo en CPU (unos 8 min con 16 hilos)."
  PRECISE_FILE="$(cfg preciseBase)"
  PRECISE_SHA="$(cfg preciseBaseSha256)"
  BASE_SOURCE="$(cfg baseSource)"
  BASE_REVISION="$(cfg baseRevision)"
  set +e
  download "$LORA_URL" "$DOWNLOADED_LORA" "$LORA_SHA"
  DL1=$?
  download "https://huggingface.co/$BASE_SOURCE/resolve/$BASE_REVISION/$PRECISE_FILE" ".downloads/$PRECISE_FILE" "$PRECISE_SHA"
  DL2=$?
  set -e
  if [ "$DL1" -eq 0 ] && [ "$DL2" -eq 0 ]; then
    if "$NODE_BIN" "$PROJECT_ROOT/scripts/merge-lora.mjs" ".downloads/$PRECISE_FILE"; then
      MERGED=1
      rm -f ".downloads/$PRECISE_FILE" "$DOWNLOADED_LORA"
    else
      echo "AVISO: la fusión del LoRA no terminó. Se instalará el modo compatible." >&2
    fi
  else
    echo "AVISO: no se creó el modelo optimizado. Se instalará el modo compatible (LoRA aplicado durante la generación, más lento)." >&2
  fi
fi
if [ "$MERGED" -eq 0 ]; then
  # Modo compatible: base Q4_K + LoRA convertido al formato sd.cpp y aplicado en ejecución.
  mkdir -p "models/loras"
  BASE_FILE="$(cfg base)"
  BASE_SHA="$(cfg baseSha256)"
  BASE_SOURCE="$(cfg baseSource)"
  BASE_REVISION="$(cfg baseRevision)"
  download "https://huggingface.co/$BASE_SOURCE/resolve/$BASE_REVISION/qwen_image_2.1-Q4_K.gguf" "models/$BASE_FILE" "$BASE_SHA"
  LORA_DEST="models/loras/$LORA_FILE"
  if [ -f "$DOWNLOADED_LORA" ] && [ ! -f "$LORA_DEST" ]; then
    mv "$DOWNLOADED_LORA" "$LORA_DEST"
  fi
  download "$LORA_URL" "$LORA_DEST" "$LORA_SHA"
  "$NODE_BIN" "$PROJECT_ROOT/scripts/prepare-lora.mjs" lora-r256
fi

echo
if [ "$MERGED" -eq 1 ]; then
  echo "Instalación completa con el modelo optimizado."
else
  echo "Instalación completa en modo compatible. Ejecuta de nuevo el instalador para crear el modelo optimizado."
fi
echo 'Ejecuta "./iniciar.sh" para abrir el estudio.'
