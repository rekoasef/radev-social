#!/usr/bin/env bash
# Prepara el servidor para correr RAdev Social (fase 4, T11). Una vez, después de harden.sh, como
# el usuario `ubuntu` (usa sudo donde hace falta). Idempotente: se puede correr de nuevo.
#   ssh radev-oracle 'bash -s' < infra/server/setup.sh
# 1. Docker Engine + Compose desde el repositorio oficial de Docker (amd64 y arm64).
# 2. Llave de solo lectura para bajar el repo privado de GitHub (deploy key).
# 3. El repo en ~/radev-social y la carpeta de media.
# 4. Un .env de producción con secretos nuevos; el resto se completa a mano (ver README).
set -euo pipefail

REPO_SSH="git@github.com:rekoasef/radev-social.git"
APP_DIR="$HOME/radev-social"
DEPLOY_KEY="$HOME/.ssh/github_deploy_radev"

step() { printf '\n== %s\n' "$*"; }

[ "$(id -u)" -ne 0 ] || { echo "Correlo como ubuntu, no como root."; exit 1; }

step "Docker"
if command -v docker >/dev/null && docker compose version >/dev/null 2>&1; then
  echo "OK: $(docker --version) · $(docker compose version --short)"
else
  sudo apt-get update -qq
  sudo apt-get install -y -qq ca-certificates curl >/dev/null
  sudo install -m 0755 -d /etc/apt/keyrings
  sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  sudo chmod a+r /etc/apt/keyrings/docker.asc
  codename=$(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${codename} stable" \
    | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
  sudo apt-get update -qq
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq docker-ce docker-ce-cli containerd.io \
    docker-buildx-plugin docker-compose-plugin >/dev/null
  sudo systemctl enable --now docker
  echo "Instalado: $(docker --version)"
fi
if ! id -nG "$USER" | grep -qw docker; then
  sudo usermod -aG docker "$USER"
  echo "Se sumó ${USER} al grupo docker: cerrá la sesión SSH y volvé a entrar para que tome efecto."
fi

step "Llave para GitHub (solo lectura)"
mkdir -p "$HOME/.ssh" && chmod 700 "$HOME/.ssh"
if [ ! -f "$DEPLOY_KEY" ]; then
  ssh-keygen -t ed25519 -N "" -C "radev-social-server-deploy" -f "$DEPLOY_KEY" >/dev/null
  echo "Creada."
fi
if ! grep -q "github_deploy_radev" "$HOME/.ssh/config" 2>/dev/null; then
  cat >> "$HOME/.ssh/config" <<SSH
Host github.com
  IdentityFile ${DEPLOY_KEY}
  IdentitiesOnly yes
SSH
  chmod 600 "$HOME/.ssh/config"
fi
ssh-keygen -F github.com >/dev/null || ssh-keyscan -t ed25519 github.com >> "$HOME/.ssh/known_hosts" 2>/dev/null

step "Repo"
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" pull -q --ff-only
  echo "OK: ya está en ${APP_DIR} (actualizado a $(git -C "$APP_DIR" log --oneline -1))."
elif git ls-remote "$REPO_SSH" HEAD >/dev/null 2>&1; then
  git clone -q "$REPO_SSH" "$APP_DIR"
  echo "Bajado en ${APP_DIR}."
else
  echo "GitHub todavía no acepta la llave. Cargala en el repo: Settings → Deploy keys → Add deploy key"
  echo "(título: radev-social servidor; SIN tildar 'Allow write access'):"
  echo
  cat "${DEPLOY_KEY}.pub"
  echo
  echo "Después corré este script de nuevo."
  exit 2
fi

step "Media"
# El usuario `node` de los contenedores (uid 1000) escribe los PNG; Caddy la lee.
mkdir -p "$APP_DIR/media"
sudo chown 1000:1000 "$APP_DIR/media"
echo "OK: ${APP_DIR}/media"

step ".env de producción"
env_file="$APP_DIR/.env"
if [ -f "$env_file" ]; then
  echo "OK: ya existe (no se toca)."
else
  cp "$APP_DIR/infra/server/env.production.example" "$env_file"
  chmod 600 "$env_file"
  # Secretos nuevos, propios del servidor (no los de la compu de desarrollo).
  sed -i \
    -e "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$(openssl rand -hex 24)|" \
    -e "s|^BETTER_AUTH_SECRET=.*|BETTER_AUTH_SECRET=$(openssl rand -base64 32)|" \
    -e "s|^RENDER_TOKEN=.*|RENDER_TOKEN=$(openssl rand -hex 24)|" \
    -e "s|^TOKEN_ENCRYPTION_KEY=.*|TOKEN_ENCRYPTION_KEY=$(openssl rand -base64 32)|" \
    "$env_file"
  echo "Creado con secretos nuevos. Faltan los valores marcados con COMPLETAR (ver infra/server/README.md)."
fi
missing=$(grep -cE '=COMPLETAR' "$env_file" || true)
[ "$missing" -eq 0 ] && echo "OK: .env completo." || echo "Faltan ${missing} valores en ${env_file}."

step "Listo"
echo "Cuando el .env esté completo y el DNS apunte acá: ~/radev-social/infra/server/deploy.sh"
