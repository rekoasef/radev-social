# 0019 — SSH con contraseña además de llave, con fail2ban

**Estado:** aceptada · 2026-10-01 · cambia la T10 de la Fase 4 (hardening)

**Contexto.** `harden.sh` dejaba SSH solo con llave. La llave vive en la notebook del operador; desde la compu de su casa no podía entrar al servidor. El operador prefiere entrar con contraseña desde cualquier máquina, aun sabiendo que es menos seguro.

**Decisión.**
- `PasswordAuthentication yes` para el usuario `ubuntu`, que tiene contraseña propia (la pone el operador con `sudo passwd ubuntu`; nunca pasa por el chat ni el repo). La llave sigue funcionando; root sigue sin poder entrar.
- **fail2ban** con la jail `sshd` (lee el journal): 5 intentos fallidos en 10 minutos bloquean esa IP 1 hora. `MaxAuthTries 3` se mantiene.
- `check.sh` exige contraseña habilitada, que `ubuntu` tenga contraseña y que fail2ban proteja SSH.

**Alternativas.** Una llave por máquina (lo más seguro, pero hay que configurar cada compu nueva). Tailscale u otra VPN (sin puerto 22 abierto, pero otro servicio más que mantener).

**Consecuencias.** El puerto 22 recibe intentos de bots todo el tiempo; la protección depende de que la contraseña sea larga y única (20+ caracteres) y de fail2ban. Como `ubuntu` usa `sudo` sin contraseña, quien la adivine controla el servidor entero: si alguna vez se sospecha una filtración, cambiarla (`sudo passwd ubuntu`) y volver a solo llave es poner `PasswordAuthentication no` en `harden.sh` y correrlo.
