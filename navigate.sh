#!/usr/bin/env bash
# Navega la app Dreame hasta ABRIR EL DIRECTO del robot, por volcado de UI
# (uiautomator), no por coordenadas fijas. Señal de éxito: liblvmedia.so cargada.
S=127.0.0.1:5555
A(){ timeout 25 adb -s $S "$@"; }
shot(){ A exec-out screencap -p > /tmp/screen_$1.png 2>/dev/null; echo "shot $1"; }
loaded(){ P=$(A shell pidof com.dreame.smartlife 2>/dev/null|tr -d '\r'); A shell cat /proc/$P/maps 2>/dev/null | grep -c liblvmedia; }
dump(){ A shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1; A shell cat /sdcard/ui.xml 2>/dev/null; }
# controles de vídeo en vivo (es/en/zh) en text= o content-desc=
PAT='[Cc]ámara|[Cc]amera|[Vv][íi]deo|[Dd]irecto|[Ll]ive|[Mm]onitor|[Vv]igilan|监控|视频|查看|直播|摄像'
tapnode(){
  local line b a y c d x yy
  line=$(echo "$1" | tr '>' '\n' | grep -oE '(text|content-desc)="[^"]*('"$PAT"')[^"]*"[^>]*bounds="\[[0-9]+,[0-9]+\]\[[0-9]+,[0-9]+\]"' | head -1)
  [ -z "$line" ] && line=$(echo "$1" | tr '>' '\n' | grep -E '(text|content-desc)="[^"]*('"$PAT"')' | grep -oE 'bounds="\[[0-9]+,[0-9]+\]\[[0-9]+,[0-9]+\]"' | head -1)
  b=$(echo "$line" | grep -oE '[0-9]+'); [ -z "$b" ] && return 1
  set -- $b; a=$1;y=$2;c=$3;d=$4; [ -z "$d" ] && return 1
  x=$(((a+c)/2)); yy=$(((y+d)/2)); echo "tap_video $x,$yy"; A shell input tap $x $yy >/dev/null 2>&1; return 0
}
shot 8
A shell input tap 360 520 >/dev/null 2>&1; sleep 8; shot 9   # entrar a la 1a card (robot)
for n in $(seq 1 8); do
  L=$(loaded); echo "iter=$n liblvmedia=$L"
  if [ "${L:-0}" -gt 0 ]; then echo "VIDEO ARRANCADO (liblvmedia)"; sleep 22; shot 90; break; fi
  X=$(dump)
  if tapnode "$X"; then sleep 9; shot "n$n"; else echo "sin nodo video iter=$n"; A shell input tap 360 520 >/dev/null 2>&1; sleep 6; shot "n$n"; fi
done
echo "nav done liblvmedia=$(loaded)"
