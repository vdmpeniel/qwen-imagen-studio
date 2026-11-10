#!/usr/bin/env bash
# Detiene Qwen Imagen Studio (Linux).
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# Lee un campo de un JSON plano sin depender de Python.
json_value() { # json_value file key
  sed -n 's/.*"'"$2"'"[[:space:]]*:[[:space:]]*"\{0,1\}\([^",}]*\)"\{0,1\}.*/\1/p' "$1" 2>/dev/null | head -n 1
}

APP_RECORD="logs/app-process.json"
if [ -f "$APP_RECORD" ]; then
  APP_PID="$(json_value "$APP_RECORD" pid)"
  APP_EXE="$(json_value "$APP_RECORD" executable)"
  if [ -n "${APP_PID:-}" ] && kill -0 "$APP_PID" 2>/dev/null; then
    ACTUAL_EXE="$(readlink -f "/proc/$APP_PID/exe" 2>/dev/null || true)"
    # node puede ser un enlace; compara también el cmdline del gateway.
    if { [ -n "$APP_EXE" ] && [ "$ACTUAL_EXE" = "$APP_EXE" ]; } || tr '\0' ' ' < "/proc/$APP_PID/cmdline" 2>/dev/null | grep -q "scripts/server.mjs"; then
      kill "$APP_PID" 2>/dev/null || true
    fi
  fi
  rm -f "$APP_RECORD"
fi

ENGINE_PID_FILE="logs/engine.pid"
if [ -f "$ENGINE_PID_FILE" ]; then
  ENGINE_PID="$(cat "$ENGINE_PID_FILE" 2>/dev/null || true)"
  if [ -n "${ENGINE_PID:-}" ] && kill -0 "$ENGINE_PID" 2>/dev/null; then
    ACTUAL_EXE="$(readlink -f "/proc/$ENGINE_PID/exe" 2>/dev/null || true)"
    case "$ACTUAL_EXE" in
      "$PROJECT_ROOT"/*/sd-server)
        kill "$ENGINE_PID" 2>/dev/null || true
        ;;
    esac
  fi
  rm -f "$ENGINE_PID_FILE"
fi
rm -f logs/engine-process.json
echo "Qwen Imagen Studio detenido. Tus imágenes siguen guardadas en outputs."
