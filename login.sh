#!/usr/bin/env bash
S=127.0.0.1:5555
shot(){ adb -s $S exec-out screencap -p > /tmp/screen_$1.png; echo "shot $1"; }
tap(){ adb -s $S shell input tap $1 $2; echo "tap $1 $2"; sleep "${3:-2}"; }
hidekb(){ adb -s $S shell input keyevent 4; sleep 1; }
iot(){ PID=$(adb -s $S shell pidof com.dreame.smartlife | tr -d '\r'); echo "iotcommon@$1: $(adb -s $S shell cat /proc/$PID/maps 2>/dev/null | grep -c iotcommon)"; }
shot 0
tap 360 907 5        # Agree
tap 360 464 2; adb -s $S shell input text "$DH_USER"; sleep 1; hidekb
tap 360 582 2; adb -s $S shell input text "$DH_PASS"; sleep 1; hidekb
tap 67 705 2         # check
tap 360 852 6        # Log In
shot 5               # notif dialog
tap 360 790 2        # DON'T ALLOW
shot 6
tap 617 255 2        # cerrar posible popup (X)
shot 7
iot postlogin
tap 90 1118 4        # pestaña Device
shot 8; iot device
sleep 12; shot 9; iot t1
# abrir primer dispositivo de la lista (centro-arriba)
tap 360 400 6
shot 10; iot opened
sleep 12; shot 11; iot t2
