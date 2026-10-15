#!/usr/bin/env bash
S=127.0.0.1:5555
shot(){ adb -s $S exec-out screencap -p > /tmp/screen_$1.png; echo "shot $1"; }
tap(){ adb -s $S shell input tap $1 $2; echo "tap $1 $2"; sleep "${3:-2}"; }
hidekb(){ adb -s $S shell input keyevent 4; sleep 1; }
iot(){ PID=$(adb -s $S shell pidof com.dreame.smartlife | tr -d '\r'); echo "IOTC_$1=$(adb -s $S shell cat /proc/$PID/maps 2>/dev/null | grep -c iotcommon)"; }
# --- login (probado) ---
shot 0; tap 360 907 5
tap 360 464 2; adb -s $S shell input text "$DH_USER"; sleep 1; hidekb
tap 360 582 2; adb -s $S shell input text "$DH_PASS"; sleep 1; hidekb
tap 67 705 2; tap 360 852 7
# --- diálogos post-login, con settle + capturas ---
sleep 3; shot 5           # notif dialog
tap 360 670 3             # ALLOW
sleep 2; shot 6
tap 617 255 3             # X popup "Dreamehome App"
sleep 2; shot 7
iot afterpopups
# --- home / Device ---
tap 90 1118 4             # pestaña Device
sleep 3; shot 8; iot devtab
sleep 8; shot 9; iot wait1
