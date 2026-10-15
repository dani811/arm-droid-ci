#!/usr/bin/env bash
S=127.0.0.1:5555
shot(){ adb -s $S exec-out screencap -p > /tmp/screen_$1.png; echo "shot $1 $(wc -c < /tmp/screen_$1.png)"; }
tap(){ adb -s $S shell input tap $1 $2; echo "tap $1 $2"; sleep "${3:-4}"; }
shot 0                 # acuerdo
tap 360 907 5          # Agree and continue
shot 1                 # siguiente pantalla
sleep 3; shot 2        # por si tarda
