#!/usr/bin/env bash
# Verifica lo que deja harden.sh (fase 4, T10). Solo lee. Sale con error si falta algo:
#   ssh radev-oracle 'sudo bash -s' < infra/server/check.sh
set -uo pipefail

ADMIN_USER="${ADMIN_USER:-ubuntu}"
REBOOT_TIME_UTC="${REBOOT_TIME_UTC:-11:00}"
RULES_V4=/etc/iptables/rules.v4
fails=0

ok() { printf 'OK     %s\n' "$*"; }
bad() { printf 'FALTA  %s\n' "$*"; fails=$((fails + 1)); }
check() { local what=$1; shift; if "$@" >/dev/null 2>&1; then ok "$what"; else bad "$what"; fi; }

[ "$(id -u)" -eq 0 ] || { echo "Correlo como root (con sudo)."; exit 1; }

sshd_value() { sshd -T 2>/dev/null | awk -v k="$1" '$1 == k { print $2 }'; }

check "${ADMIN_USER} tiene llaves SSH" grep -qE '^(ssh-|ecdsa-)' "/home/${ADMIN_USER}/.ssh/authorized_keys"
# Contraseña permitida a propósito (ADR 0019), siempre con fail2ban.
[ "$(sshd_value passwordauthentication)" = "yes" ] && ok "SSH con contraseña" || bad "SSH con contraseña"
passwd -S "$ADMIN_USER" 2>/dev/null | awk '{ exit !($2 == "P") }' && ok "${ADMIN_USER} tiene contraseña" \
  || bad "${ADMIN_USER} tiene contraseña (sudo passwd ${ADMIN_USER})"
check "fail2ban protege SSH" fail2ban-client status sshd
[ "$(sshd_value permitrootlogin)" = "no" ] && ok "SSH sin root" || bad "SSH sin root"
[ "$(sshd_value pubkeyauthentication)" = "yes" ] && ok "SSH con llave" || bad "SSH con llave"
passwd -S root 2>/dev/null | awk '{ exit !($2 == "L") }' && ok "root sin contraseña" || bad "root sin contraseña"

for port in 22 80 443; do
  check "puerto ${port} abierto (en vivo)" \
    iptables -C INPUT -p tcp -m state --state NEW -m tcp --dport "$port" -j ACCEPT
done
for port in 80 443; do
  check "puerto ${port} abierto al reiniciar" \
    grep -qxF -- "-A INPUT -p tcp -m state --state NEW -m tcp --dport ${port} -j ACCEPT" "$RULES_V4"
done
# Nada más escucha afuera: Postgres y la web no se publican (solo Caddy en 80/443).
extra=$(ss -Hltn 2>/dev/null | awk '{ print $4 }' | grep -vE '^(127\.|\[::1\]|localhost)' \
  | sed -E 's/.*:([0-9]+)$/\1/' | grep -vxE '22|80|443' | sort -un | tr '\n' ' ')
[ -z "$extra" ] && ok "no escucha nada más hacia afuera" || bad "escuchan otros puertos: ${extra}"

check "actualizaciones automáticas activas" \
  grep -q 'APT::Periodic::Unattended-Upgrade "1"' /etc/apt/apt.conf.d/20auto-upgrades
check "reinicio automático a las ${REBOOT_TIME_UTC} UTC" \
  grep -q "Automatic-Reboot-Time \"${REBOOT_TIME_UTC}\"" /etc/apt/apt.conf.d/52radev-unattended-upgrades
[ "$(date +%Z)" = "UTC" ] && ok "zona horaria UTC" || bad "zona horaria UTC (es $(date +%Z))"
[ -f /var/run/reboot-required ] && echo "AVISO  hay un reinicio pendiente por actualizaciones"

echo
if [ "$fails" -eq 0 ]; then echo "Todo en orden."; else echo "Faltan ${fails} cosas."; exit 1; fi
