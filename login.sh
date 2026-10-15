#!/usr/bin/env bash
S=127.0.0.1:5555
shot(){ adb -s $S exec-out screencap -p > /tmp/screen_$1.png; echo "shot $1"; }
tap(){ adb -s $S shell input tap $1 $2; echo "tap $1 $2"; sleep "${3:-2}"; }
hidekb(){ adb -s $S shell input keyevent 4; sleep 1; }
shot 0
tap 360 907 5        # Agree and continue
shot 1               # login screen
tap 360 464 2        # email field
adb -s $S shell input text "$DH_USER"; sleep 1
hidekb; shot 2       # email puesto, teclado oculto
tap 360 582 2        # password field (ya visible)
adb -s $S shell input text "$DH_PASS"; sleep 1
hidekb; shot 3       # password puesto
tap 67 705 2         # checkbox acuerdo
shot 4               # verificar check + boton habilitado
tap 360 852 5        # Log In
shot 5
sleep 12; shot 6     # post-login
sleep 8; shot 7
