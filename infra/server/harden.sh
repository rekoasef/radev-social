#!/usr/bin/env bash
# Asegura el servidor de producción (Ubuntu 24.04 en Oracle Cloud; fase 4, T10). Idempotente:
# correrlo de nuevo no duplica nada. Se corre como root desde la máquina del operador:
#   ssh radev-oracle 'sudo bash -s' < infra/server/harden.sh
# Qué hace (docs/ARCHITECTURE.md §2): SSH con llave o contraseña (ADR 0019) y sin root, fail2ban,
# firewall de Ubuntu con 22/80/443, actualizaciones de seguridad automáticas con reinicio a las 08:00 de Argentina.
# El firewall de la red de Oracle (Security List) se abre aparte: ver infra/server/README.md.
set -euo pipefail

ADMIN_USER="${ADMIN_USER:-ubuntu}"
# 08:00 en Argentina (UTC-3, sin horario de verano): después de la ventana de generación (02–07)
# y lejos de la hora de publicar. El servidor queda en UTC (CLAUDE.md, regla 11).
REBOOT_TIME_UTC="${REBOOT_TIME_UTC:-11:00}"
OPEN_PORTS=(80 443)
RULES_V4=/etc/iptables/rules.v4

step() { printf '\n== %s\n' "$*"; }
has_systemd() { [ -d /run/systemd/system ]; }

[ "$(id -u)" -eq 0 ] || { echo "Correlo como root (con sudo)."; exit 1; }

step "Usuario administrador: ${ADMIN_USER}"
# Protección para no quedar afuera: sin una llave cargada no se toca la config de SSH.
keys="/home/${ADMIN_USER}/.ssh/authorized_keys"
if ! id "$ADMIN_USER" >/dev/null 2>&1 || ! grep -qE '^(ssh-|ecdsa-)' "$keys" 2>/dev/null; then
  echo "ERROR: ${ADMIN_USER} no existe o no tiene llaves en ${keys}. No se toca nada."
  exit 1
fi
echo "OK: ${ADMIN_USER} tiene $(grep -cE '^(ssh-|ecdsa-)' "$keys") llave(s)."

step "Paquetes"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
# iptables-persistent: guarda el firewall entre reinicios (ya viene en la imagen de Oracle).
echo iptables-persistent iptables-persistent/autosave_v4 boolean false | debconf-set-selections
echo iptables-persistent iptables-persistent/autosave_v6 boolean false | debconf-set-selections
# fail2ban + python3-systemd: lee los intentos de SSH del journal (Ubuntu 24.04 no tiene auth.log).
apt-get install -y -qq openssh-server iptables iptables-persistent unattended-upgrades \
  fail2ban python3-systemd >/dev/null
echo "OK"

step "Zona horaria: UTC"
if has_systemd && command -v timedatectl >/dev/null; then
  timedatectl set-timezone Etc/UTC
fi
ln -sf /usr/share/zoneinfo/Etc/UTC /etc/localtime
echo "Etc/UTC" > /etc/timezone
echo "OK: $(date '+%Z %H:%M')"

step "SSH: con llave o contraseña, sin root"
# Un archivo propio: sshd toma el primer valor que encuentra y este va antes que el de cloud-init
# (50-cloud-init.conf).
conf=/etc/ssh/sshd_config.d/10-radev-hardening.conf
cat > "$conf" <<'SSHD'
# RAdev Social (infra/server/harden.sh): llave o contraseña (ADR 0019), sin root.
PubkeyAuthentication yes
PasswordAuthentication yes
KbdInteractiveAuthentication no
PermitEmptyPasswords no
PermitRootLogin no
X11Forwarding no
MaxAuthTries 3
SSHD
chmod 644 "$conf"
mkdir -p /run/sshd
sshd -t || { echo "ERROR: la config de SSH no es válida; se deshace."; rm -f "$conf"; exit 1; }
if has_systemd; then
  systemctl reload ssh 2>/dev/null || systemctl restart ssh
else
  echo "(sin systemd: sshd toma la config al arrancar)"
fi
passwd -l root >/dev/null
echo "OK: $(sshd -T 2>/dev/null | grep -E '^(passwordauthentication|permitrootlogin) ' | tr '\n' ' ')"
if ! passwd -S "$ADMIN_USER" 2>/dev/null | awk '{ exit !($2 == "P") }'; then
  echo "AVISO: ${ADMIN_USER} todavía no tiene contraseña: ssh -t radev-oracle sudo passwd ${ADMIN_USER}"
fi

step "fail2ban: bloquea IPs que fallan el login de SSH"
# 5 intentos fallidos en 10 minutos → esa IP queda bloqueada 1 hora.
cat > /etc/fail2ban/jail.d/10-radev.conf <<'F2B'
# RAdev Social (infra/server/harden.sh, ADR 0019).
[sshd]
enabled = true
backend = systemd
maxretry = 5
findtime = 10m
bantime = 1h
F2B
if has_systemd; then
  systemctl enable fail2ban >/dev/null 2>&1 || true
  systemctl restart fail2ban
  sleep 2
  fail2ban-client status sshd >/dev/null && echo "OK: jail sshd activa." \
    || { echo "ERROR: fail2ban no levantó la jail sshd."; exit 1; }
else
  echo "(sin systemd: fail2ban arranca con el servidor)"
fi

step "Firewall de Ubuntu (iptables): 22, 80 y 443"
# La imagen de Oracle trae reglas propias: acepta el 22 y rechaza el resto con un REJECT al final
# de INPUT. Los puertos nuevos van antes de ese REJECT, en vivo y en el archivo que se carga al
# arrancar. No se usa `iptables-save` a propósito: con Docker andando guardaría también sus
# cadenas, y al reiniciar chocarían con las que Docker vuelve a crear.
for port in "${OPEN_PORTS[@]}"; do
  rule=(-p tcp -m state --state NEW -m tcp --dport "$port" -j ACCEPT)
  if iptables -C INPUT "${rule[@]}" 2>/dev/null; then
    echo "OK: ${port} ya estaba abierto (en vivo)."
  else
    reject=$(iptables -L INPUT --line-numbers -n | awk '$2 == "REJECT" { print $1; exit }')
    if [ -n "$reject" ]; then iptables -I INPUT "$reject" "${rule[@]}"; else iptables -A INPUT "${rule[@]}"; fi
    echo "Abierto: ${port} (en vivo)."
  fi
done
if [ -f "$RULES_V4" ]; then
  # Al revés: cada uno va justo después del 22, así quedan en orden (22, 80, 443).
  for ((i = ${#OPEN_PORTS[@]} - 1; i >= 0; i--)); do
    port=${OPEN_PORTS[$i]}
    line="-A INPUT -p tcp -m state --state NEW -m tcp --dport ${port} -j ACCEPT"
    if grep -qxF -- "$line" "$RULES_V4"; then
      echo "OK: ${port} ya estaba en ${RULES_V4}."
    else
      # Después de la regla del 22; si no está, antes del primer REJECT de INPUT.
      awk -v add="$line" '
        !done && /^-A INPUT .*--dport 22 .*-j ACCEPT/ { print; print add; done = 1; next }
        !done && /^-A INPUT .*-j REJECT/ { print add; print; done = 1; next }
        { print }
        END { if (!done) exit 1 }
      ' "$RULES_V4" > "${RULES_V4}.new" && mv "${RULES_V4}.new" "$RULES_V4" \
        || { rm -f "${RULES_V4}.new"; echo "ERROR: no encontré dónde agregar el ${port} en ${RULES_V4}."; exit 1; }
      echo "Agregado: ${port} en ${RULES_V4}."
    fi
  done
else
  echo "AVISO: no existe ${RULES_V4} (¿no es la imagen de Oracle?). Solo quedó en vivo."
fi
if has_systemd; then systemctl enable netfilter-persistent >/dev/null 2>&1 || true; fi

step "Actualizaciones de seguridad automáticas"
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'APT'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
APT
cat > /etc/apt/apt.conf.d/52radev-unattended-upgrades <<APT
// RAdev Social (infra/server/harden.sh). Los orígenes (solo seguridad) son los de Ubuntu,
// en 50unattended-upgrades.
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "${REBOOT_TIME_UTC}";
Unattended-Upgrade::Remove-Unused-Kernel-Packages "true";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
APT
if has_systemd; then systemctl enable --now unattended-upgrades >/dev/null 2>&1 || true; fi
echo "OK: reinicio si hace falta a las ${REBOOT_TIME_UTC} UTC."

step "Servicios que no usamos"
# rpcbind (puerto 111) viene en la imagen de Oracle y solo sirve para NFS.
if has_systemd && systemctl list-unit-files rpcbind.service >/dev/null 2>&1; then
  systemctl disable --now rpcbind.socket rpcbind.service >/dev/null 2>&1 || true
  echo "OK: rpcbind apagado y desactivado."
else
  echo "OK: no hay rpcbind."
fi

step "Listo"
echo "Verificá con: ssh radev-oracle 'sudo bash -s' < infra/server/check.sh"
