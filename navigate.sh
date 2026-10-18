#!/usr/bin/env bash
# Abre el directo del robot en la app Dreamehome para disparar la señalización wss.
# Navega por volcado de UI (uiautomator). Vuelca CADA pantalla (texto + screenshot) a
# /tmp/nav.log para diagnóstico y ajuste fino (ciclo iterativo). Señal de éxito =
# liblvmedia.so cargada (el player P2P arrancó) + idealmente tráfico wss en capture.txt.
S=127.0.0.1:5555
PKG=com.dreame.smartlife
A(){ timeout 25 adb -s $S "$@"; }
NAV=/tmp/nav.log; : > "$NAV"
log(){ echo "$@"; echo "$@" >> "$NAV"; }
shot(){ A exec-out screencap -p > /tmp/screen_$1.png 2>/dev/null; log "shot $1"; }
loaded(){ local P; P=$(A shell pidof $PKG 2>/dev/null|tr -d '\r'); [ -z "$P" ] && { echo 0; return; }; A shell cat /proc/$P/maps 2>/dev/null | grep -c liblvmedia; }
dump(){ A shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1; A shell cat /sdcard/ui.xml 2>/dev/null; }
texts(){ printf '%s' "$1" | tr '>' '\n' | grep -oE '(text|content-desc)="[^"]+"' | sort -u; }
# tap centro del 1er nodo cuyo text/content-desc matchee el regex $2
tapmatch(){
  local l b; l=$(printf '%s' "$1" | tr '>' '\n' | grep -iE "(text|content-desc)=\"[^\"]*($2)" | head -1)
  [ -z "$l" ] && return 1
  b=$(printf '%s' "$l" | grep -oE 'bounds="\[[0-9]+,[0-9]+\]\[[0-9]+,[0-9]+\]"' | grep -oE '[0-9]+'); [ -z "$b" ] && return 1
  set -- $b; local x=$((($1+$3)/2)) y=$((($2+$4)/2)); log "TAP '$2' @ $x,$y"; A shell input tap $x $y >/dev/null 2>&1; return 0
}
scrn(){ # vuelca pantalla n: screenshot + textos + liblvmedia
  local n="$1"; shot "$n"; local X; X=$(dump)
  log "=== PANTALLA $n (liblvmedia=$(loaded)) ==="; texts "$X" >> "$NAV"
  printf '%s' "$X"  # devuelve el xml por stdout para tapmatch
}

PAT_POPUP='Later|Más tarde|Mas tarde|Ahora no|Not now|Skip|Omitir|Cancelar|Cancel|稍后|跳过|Got it|Entendido|Aceptar|Agree|De acuerdo|Allow|Permitir|OK'
PAT_ROBOT='L40|r2579|Dreame|[Rr]obot|Aspir|[Vv]acuum|扫地|Ultra'
PAT_CAM='[Cc]ámara|[Cc]amera|[Vv][íi]deo|[Vv]ideo|[Dd]irecto|[Ll]ive|[Mm]onitor|[Vv]igilan|[Vv]er (la casa|en casa|cámara)|[Ww]atch|监控|视频|查看|直播|摄像|看家|远程查看'

sleep 4; log "== navigate inicio =="
# 0) Descartar hasta 3 popups iniciales
for i in 1 2 3; do
  X=$(scrn "p$i")
  tapmatch "$X" "$PAT_POPUP" || { log "no popup #$i"; break; }
  sleep 5
done

# 1) Abrir el robot (card en la lista de dispositivos)
X=$(scrn 9)
tapmatch "$X" "$PAT_ROBOT" || { log "no card robot por texto -> tap centro 360,360"; A shell input tap 360 360 >/dev/null 2>&1; }
sleep 10

# 2) Buscar y abrir el control de cámara/vídeo; iterar descartando popups y volcando UI
for n in 1 2 3 4 5 6 7 8; do
  L=$(loaded); log "iter=$n liblvmedia=$L"
  if [ "${L:-0}" -gt 0 ]; then log ">>> VIDEO/PLAYER ARRANCADO (liblvmedia cargada)"; sleep 28; shot "live_$n"; break; fi
  X=$(scrn "$n")
  # primero intenta el control de cámara; si no, descarta popup; si no, reintenta card
  if tapmatch "$X" "$PAT_CAM"; then :
  elif tapmatch "$X" "$PAT_POPUP"; then log "popup en iter=$n"
  else log "sin control cámara ni popup en iter=$n"; fi
  sleep 9
done

log "== navigate fin: liblvmedia=$(loaded) =="
