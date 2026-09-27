#!/usr/bin/env bash
# Compartido por install.sh y start.sh (Linux).
# Node.js portable descargado por el instalador, o Node.js del sistema >=22.

get_app_node() {
  local root="$1"
  if [ -x "$root/node/bin/node" ]; then
    echo "$root/node/bin/node"
    return 0
  fi
  if command -v node >/dev/null 2>&1; then
    local ver major
    ver="$(node --version 2>/dev/null)"
    major="$(echo "$ver" | sed -E 's/^v([0-9]+).*/\1/')"
    if [ -n "$major" ] && [ "$major" -ge 22 ]; then
      command -v node
      return 0
    fi
  fi
  return 1
}

# Dependencias del sistema para los motores Linux (sin Visual C++).
# Devuelve 0 si está todo, 1 si falta algo (e imprime qué instalar).
check_linux_deps() {
  local missing=""
  command -v curl >/dev/null 2>&1 || missing="$missing curl"
  command -v unzip >/dev/null 2>&1 || missing="$missing unzip"
  ldconfig -p 2>/dev/null | grep -q "libgomp\.so" || missing="$missing libgomp1"
  ldconfig -p 2>/dev/null | grep -q "libvulkan\.so" || missing="$missing libvulkan1"
  if [ -n "$missing" ]; then
    echo "Faltan dependencias:$missing" >&2
    echo "Instálalas con: sudo apt install -y curl unzip libgomp1 libvulkan1" >&2
    return 1
  fi
  return 0
}
