#!/usr/bin/env bash
# Abre el directo del robot. Descarta el popup de permisos, espera la lista, y
# navega por volcado de UI (uiautomator). Vuelca los textos de cada pantalla a
# /tmp/nav.log (exfiltrado) para diagnóstico. Éxito = liblvmedia.so cargada.
S=127.0.0.1:5555
A(){ timeout 25 adb -s $S "$@"; }
NAV=/tmp/nav.log; : > "$NAV"
log(){ echo "$@"; echo "$@" >> "$NAV"; }
shot(){ A exec-out screencap -p > /tmp/screen_$1.png 2>/dev/null; log "shot $1"; }
loaded(){ local P; P=$(A shell pidof com.dreame.smartlife 2>/dev/null|tr -d '\r'); A shell cat /proc/$P/maps 2>/dev/null | grep -c liblvmedia; }
dump(){ A shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1; A shell cat /sdcard/ui.xml 2>/dev/null; }
texts(){ printf '%s' "$1" | tr '>' '\n' | grep -oE '(text|content-desc)="[^"]+"' | sort -u; }
tapmatch(){ # $1=xml $2=regex -> tap centro del 1er nodo que matchee en text/content-desc
  local l b; l=$(printf '%s' "$1" | tr '>' '\n' | grep -iE "(text|content-desc)=\"[^\"]*($2)" | head -1)
  [ -z "$l" ] && return 1
  b=$(printf '%s' "$l" | grep -oE 'bounds="\[[0-9]+,[0-9]+\]\[[0-9]+,[0-9]+\]"' | grep -oE '[0-9]+'); [ -z "$b" ] && return 1
  set -- $b; local x=$((($1+$3)/2)) y=$((($2+$4)/2)); log "TAP '$2' @ $x,$y"; A shell input tap $x $y >/dev/null 2>&1; return 0
}
sleep 3; shot 8
X=$(dump); log "=== HOME(popup) ==="; texts "$X" >> "$NAV"
tapmatch "$X" 'Later|Más tarde|Mas tarde|Ahora no|Not now|稍后' || { log "no 'Later' por texto -> tap 360,1067"; A shell input tap 360 1067 >/dev/null 2>&1; }
sleep 12; shot 9
X=$(dump); log "=== HOME(lista) ==="; texts "$X" >> "$NAV"
tapmatch "$X" 'L40|r2579|Dreame|[Rr]obot|Aspir|[Vv]acuum|扫地' || { log "no card por texto -> tap 360,360"; A shell input tap 360 360 >/dev/null 2>&1; }
sleep 10; shot 10
for n in 1 2 3 4 5; do
  L=$(loaded); log "iter=$n liblvmedia=$L"
  [ "${L:-0}" -gt 0 ] && { log "VIDEO ARRANCADO"; sleep 24; shot 9$n; break; }
  X=$(dump); log "=== PANTALLA iter=$n ==="; texts "$X" >> "$NAV"
  tapmatch "$X" '[Cc]ámara|[Cc]amera|[Vv][íi]deo|[Dd]irecto|[Ll]ive|[Mm]onitor|[Vv]igilan|[Vv]er en|监控|视频|查看|直播|摄像' || log "sin control video iter=$n"
  sleep 9; shot 1$n
done
log "nav done liblvmedia=$(loaded)"
