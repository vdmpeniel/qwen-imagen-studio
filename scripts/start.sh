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

# Misma validación que usa el servidor: todas las piezas de la selección activa
# deben existir en disco antes de arrancar el motor.
if ! "$NODE_BIN" "$PROJECT_ROOT/scripts/check-models.mjs"; then
  echo 'Faltan modelos de la configuración activa. Ejecuta "./instalar.sh" para completarlos.' >&2
  exit 1
fi

cfg() {
  "$NODE_BIN" -e "const c=require('./model-config.json');process.stdout.write(String(c[process.argv[1]] ?? ''))" "$1"
}
RUNTIME_CPU="$(cfg runtimeCpu)"
if [ ! -x "$RUNTIME_CPU/sd-server" ]; then
  echo 'Falta el motor CPU. Ejecuta "./instalar.sh".' >&2
  exit 1
fi

# Elimina solo un motor de este proyecto dejado por una salida interrumpida.
ENGINE_RECORD="logs/engine-process.json"
if [ -f "$ENGINE_RECORD" ]; then
  json_value() {
    "$NODE_BIN" -e "try{const j=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));process.stdout.write(String(j[process.argv[2]]??''))}catch{}" "$1" "$2"
  }
  PRIOR_PID="$(json_value "$ENGINE_RECORD" pid)"
  PRIOR_EXE="$(json_value "$ENGINE_RECORD" executable)"
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
