# Servidor de producción

Scripts para dejar seguro el servidor (fase 4, T10): Ubuntu 24.04 ARM en Oracle Cloud Always Free, instancia `radev-social` en `sa-santiago-1` (ver `docs/PROGRESS.md`, T9). Se corren **desde la máquina del operador** por SSH; no hace falta copiar nada al servidor.

## Entrar

La llave es `~/.ssh/id_ed25519_radev_oracle` y el usuario, `ubuntu` (el de la imagen de Oracle: no es root, entra solo con llave y usa `sudo`). En `~/.ssh/config` de la máquina del operador (la IP **no** va al repo):

```
Host radev-oracle
  HostName <IP pública>
  User ubuntu
  IdentityFile ~/.ssh/id_ed25519_radev_oracle
  IdentitiesOnly yes
```

Con eso: `ssh radev-oracle`.

## Asegurar (`harden.sh`)

```
ssh radev-oracle 'sudo bash -s' < infra/server/harden.sh
```

Se puede correr las veces que haga falta: lo que ya está hecho no se repite. Qué hace:

- **SSH solo con llave**: sin contraseña, sin root (`/etc/ssh/sshd_config.d/10-radev-hardening.conf`). Antes de aplicarlo verifica la config con `sshd -t`, y si `ubuntu` no tiene una llave cargada **no toca nada** (para no quedar afuera). La sesión abierta no se corta.
- **Firewall de Ubuntu**: la imagen de Oracle trae `iptables` que aceptan el 22 y rechazan el resto. Suma 80 y 443 antes del rechazo, en vivo y en `/etc/iptables/rules.v4` (lo que se carga al arrancar). No usa `ufw` (Oracle desaconseja mezclarlo con esas reglas) ni `iptables-save` (con Docker andando guardaría sus cadenas y chocarían al reiniciar).
- **Actualizaciones automáticas** (`unattended-upgrades`): parches de seguridad todos los días. Si uno pide reiniciar, reinicia a las **11:00 UTC = 08:00 de Argentina**: después de la ventana de generación (02–07) y lejos de la hora de publicar.
- **Zona horaria UTC** (las fechas se guardan en UTC; CLAUDE.md, regla 11).

## Verificar (`check.sh`)

```
ssh radev-oracle 'sudo bash -s' < infra/server/check.sh
```

Solo lee. Dice `OK` o `FALTA` para cada punto (SSH, puertos en vivo y al reiniciar, que nada más escuche hacia afuera, actualizaciones, zona horaria) y sale con error si falta algo.

## El otro firewall: la red de Oracle

Oracle filtra también antes de llegar al servidor, con la **Security List** de la subred (`Default Security List for radev-vcn`, de `public subnet-radev-vcn`). Tiene que dejar entrar TCP 22, 80 y 443 desde `0.0.0.0/0` (y ping). Se ve en la consola: Networking → Virtual cloud networks → `radev-vcn` → Security Lists.

## Probar sin servidor

Los scripts se probaron en un contenedor `ubuntu:24.04` con las reglas de `iptables` de la imagen de Oracle (dos pasadas, `check.sh` y el caso sin llaves). Así se repite:

```
docker run --rm --cap-add NET_ADMIN -v "$PWD/infra/server:/infra:ro" ubuntu:24.04 bash -c '
  apt-get update -qq && apt-get install -y -qq iptables >/dev/null
  mkdir -p /home/ubuntu/.ssh && echo "ssh-ed25519 AAAAtest test" > /home/ubuntu/.ssh/authorized_keys
  bash /infra/harden.sh && bash /infra/check.sh'
```

(Sin `/etc/iptables/rules.v4` el firewall queda solo en vivo y lo avisa.)
