#!/usr/bin/env bash
# Inicia Qwen Imagen Studio (Linux).
# Uso: scripts/start.sh [--port 7871] [--no-browser]
set -euo pipefail

PORT=7871
NO_BROWSER=0
while [ $# -gt 0 ]; do
  case "$1" in
    --port) PORT="${2:?}"; shift 2 ;;
    --port=*) PORT="${1#--port=}"; shift ;;
    --no-browser) NO_BROWSER=1; shift ;;
    -h|--help) echo "Uso: $0 [--port 7871] [--no-browser]"; exit 0 ;;
    *) echo "Opción desconocida: $1" >&2; exit 1 ;;
  esac
done

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"
# shellcheck source=common.sh
. "$PROJECT_ROOT/scripts/common.sh"
mkdir -p logs

NODE_BIN="$(get_app_node "$PROJECT_ROOT" || true)"
if [ -z "${NODE_BIN:-}" ]; then
  echo 'Falta Node.js. Ejecuta "./instalar.sh".' >&2
  exit 1
fi

URL="http://127.0.0.1:$PORT"
if curl -fsS --max-time 3 "$URL/api/status" 2>/dev/null | grep -q "qwen-turbo-local"; then
  if [ "$NO_BROWSER" -eq 0 ]; then
    (xdg-open "$URL" >/dev/null 2>&1 || true) &
  fi
  exit 0
fi

cfg() {
  python3 -c "import json;print(json.load(open('model-config.json'))['$1'])"
}
MERGED_FILE="$(cfg merged)"
BASE_FILE="$(cfg base)"
RUNTIME_LORA="$(cfg runtimeLora)"
RUNTIME_CPU="$(cfg runtimeCpu)"

# El transformer fusionado sustituye a la base Q4_K y al LoRA en ejecución.
if python3 -c "import json;assert json.load(open('models/merged-lora.json'))['output']=='$MERGED_FILE'" 2>/dev/null \
  && [ -f "models/$MERGED_FILE" ]; then
  TRANSFORMER=("models/$MERGED_FILE")
else
  TRANSFORMER=("models/$BASE_FILE" "models/loras/$RUNTIME_LORA")
fi
for rel in "${TRANSFORMER[@]}" \
  "models/Qwen3VL-8B-Instruct-Q4_K_M.gguf" \
  "models/mmproj-Qwen3VL-8B-Instruct-F16.gguf" \
  "models/qwen_image_2.1_vae_bf16.safetensors"; do
  if [ ! -f "$rel" ]; then
    echo "Falta $rel. Ejecuta './instalar.sh'." >&2
    exit 1
  fi
done
if [ ! -x "$RUNTIME_CPU/sd-server" ]; then
  echo 'Falta el motor CPU. Ejecuta "./instalar.sh".' >&2
  exit 1
fi

# Elimina solo un motor de este proyecto dejado por una salida interrumpida.
ENGINE_RECORD="logs/engine-process.json"
if [ -f "$ENGINE_RECORD" ]; then
  PRIOR_PID="$(python3 -c "import json;print(json.load(open('$ENGINE_RECORD')).get('pid',''))" 2>/dev/null || true)"
  PRIOR_EXE="$(python3 -c "import json;print(json.load(open('$ENGINE_RECORD')).get('executable',''))" 2>/dev/null || true)"
  if [ -n "${PRIOR_PID:-}" ] && kill -0 "$PRIOR_PID" 2>/dev/null; then
    ACTUAL_EXE="$(readlink -f "/proc/$PRIOR_PID/exe" 2>/dev/null || true)"
    if [ "$ACTUAL_EXE" = "$PRIOR_EXE" ]; then
      case "$ACTUAL_EXE" in
        "$PROJECT_ROOT/$RUNTIME_CPU/sd-server"|"$PROJECT_ROOT/$(cfg runtime)/sd-server"|"$PROJECT_ROOT/$(cfg runtimeVulkan)/sd-server")
          kill "$PRIOR_PID" 2>/dev/null || true
          ;;
      esac
    fi
  fi
fi

export QWEN_PORT="$PORT"
export QWEN_ENGINE_PORT="$((PORT + 1))"
export QWEN_ENGINE_MANAGED="1"

# Lanza el servidor en segundo plano con logs rotativos por append.
setsid nohup "$NODE_BIN" "$PROJECT_ROOT/scripts/server.mjs" >>"$PROJECT_ROOT/logs/app.out.log" 2>>"$PROJECT_ROOT/logs/app.err.log" < /dev/null &
APP_PID=$!
echo "{\"pid\":$APP_PID,\"started\":\"$(date -u +%FT%TZ)\",\"executable\":\"$NODE_BIN\"}" > "$PROJECT_ROOT/logs/app-process.json"

READY=""
for _ in $(seq 1 60); do
  if READY="$(curl -fsS --max-time 2 "$URL/api/status" 2>/dev/null)"; then
    break
  fi
  sleep 0.5
done
if [ -z "${READY:-}" ]; then
  echo "La interfaz no inició. Revisa logs/app.err.log." >&2
  exit 1
fi
if [ "$NO_BROWSER" -eq 0 ]; then
  (xdg-open "$URL" >/dev/null 2>&1 || true) &
fi
echo "Estudio disponible en $URL. Detectando CPU y GPU; los modelos se precargan al abrir la página."
