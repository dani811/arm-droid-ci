#!/usr/bin/env bash
S=127.0.0.1:5555
shot(){ adb -s $S exec-out screencap -p > /tmp/screen_$1.png; echo "shot $1"; }
tap(){ adb -s $S shell input tap $1 $2; echo "tap $1 $2"; sleep "${3:-2}"; }
txt(){ adb -s $S shell input text "$1"; sleep 1; }   # valor viene por stdin-safe; GitHub enmascara
shot 0
tap 360 907 5        # Agree and continue
shot 1               # login screen
tap 360 464 1        # email field
txt "$DH_USER"
tap 360 582 1        # password field
txt "$DH_PASS"
adb -s $S shell input keyevent 4   # ocultar teclado
sleep 1; shot 2
tap 67 705 1         # checkbox acuerdo
shot 3
tap 360 852 4        # Log In
shot 4
sleep 12; shot 5     # post-login (deberia cargar libiotcommon)
sleep 10; shot 6
