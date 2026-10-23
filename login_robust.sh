#!/usr/bin/env bash
# Login robusto de Dreamehome en redroid: NO usa coordenadas fijas. Lee la UI
# (uiautomator), pulsa botones por texto y rellena los EditText por su posicion real.
# Vuelca a /tmp/login.log los resource-id/clase/texto (SIN valores) para diagnostico.
# Credenciales por env DH_USER/DH_PASS. Objetivo: completar login -> la app conecta
# el canal itls -> libitls.so se mapea -> el hook captura el CONNECT.
S=127.0.0.1:5555
A(){ timeout 25 adb -s $S "$@"; }
LOG=/tmp/login.log; : > "$LOG"
log(){ echo "$@"; echo "$@" >> "$LOG"; }
shot(){ A exec-out screencap -p > /tmp/login_$1.png 2>/dev/null; }
dump(){ A shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1; A shell cat /sdcard/ui.xml 2>/dev/null; }
# centro del 1er nodo cuyo text/content-desc matchee $2 (sobre el xml $1)
tapmatch(){
  local l b; l=$(printf '%s' "$1" | tr '>' '\n' | grep -iE "(text|content-desc)=\"[^\"]*($2)" | head -1)
  [ -z "$l" ] && return 1
  b=$(printf '%s' "$l" | grep -oE 'bounds="\[[0-9]+,[0-9]+\]\[[0-9]+,[0-9]+\]"' | grep -oE '[0-9]+'); [ -z "$b" ] && return 1
  set -- $b; local x=$((($1+$3)/2)) y=$((($2+$4)/2)); log "TAP '$2' @ $x,$y"; A shell input tap $x $y >/dev/null 2>&1; return 0
}
# centro del N-esimo (1-indexed) EditText
edittext_xy(){
  printf '%s' "$1" | tr '>' '\n' | grep 'class="android.widget.EditText"' | sed -n "${2}p" \
    | grep -oE 'bounds="\[[0-9]+,[0-9]+\]\[[0-9]+,[0-9]+\]"' | grep -oE '[0-9]+' | tr '\n' ' '
}
tapxy(){ set -- $1; [ -n "$2" ] && { local x=$((($1+$3)/2)) y=$((($2+$4)/2)); A shell input tap $x $y >/dev/null 2>&1; echo "$x,$y"; }; }
hidekb(){ A shell input keyevent 111 >/dev/null 2>&1; sleep 1; }

sleep 4; shot 0
# 1) popups de privacidad / permisos iniciales
for i in 1 2 3; do
  X=$(dump)
  tapmatch "$X" 'Agree|Aceptar|Acepto|De acuerdo|Continuar|Continue|Got it|Entendido|同意|允许|Allow|Permitir' && { sleep 4; continue; }
  break
done
# 2) pantalla de login: volcar diagnostico (resource-id/clase/texto, SIN valores)
X=$(dump)
log "=== LOGIN UI (resource-id | clase | texto) ==="
printf '%s' "$X" | tr '>' '\n' | grep -oE '(resource-id|class|text)="[^"]*"' | paste -d' ' - - - 2>/dev/null | grep -iE 'edittext|button|login|account|password|phone|email|user|iniciar|sign' | head -30 >> "$LOG"
NE=$(printf '%s' "$X" | tr '>' '\n' | grep -c 'class="android.widget.EditText"'); log "EditText encontrados=$NE"
# 3) rellenar usuario (1er EditText) y password (2o)
U=$(edittext_xy "$X" 1); P=$(edittext_xy "$X" 2)
if [ -n "$U" ]; then log "user field @ $(tapxy "$U")"; sleep 1; A shell input text "$DH_USER" >/dev/null 2>&1; hidekb; else log "NO user field"; fi
X=$(dump); P=$(edittext_xy "$X" 2)
if [ -n "$P" ]; then log "pass field @ $(tapxy "$P")"; sleep 1; A shell input text "$DH_PASS" >/dev/null 2>&1; hidekb; else log "NO pass field"; fi
# 4) checkbox de terminos (si hay) + boton de login
X=$(dump)
tapmatch "$X" 'acepto|agree|terms|términos|privacidad' || true; sleep 1
tapmatch "$X" 'Log ?In|Iniciar|Entrar|Sign ?in|Login|登录|Acceder' || log "NO boton login por texto"
sleep 5; shot 5
# 5) permiso de notificaciones post-login
X=$(dump); tapmatch "$X" 'Allow|Permitir|ALLOW|While using|Solo esta vez|Al usar' || true
sleep 2; shot 6
log "login_robust fin"
