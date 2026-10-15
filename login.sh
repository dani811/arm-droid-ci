#!/usr/bin/env bash
S=127.0.0.1:5555
A(){ timeout 25 adb -s $S "$@"; }
shot(){ A exec-out screencap -p > /tmp/screen_$1.png 2>/dev/null; echo "shot $1"; }
tap(){ A shell input tap $1 $2 >/dev/null 2>&1; echo "tap $1 $2"; sleep "${3:-2}"; }
hidekb(){ A shell input keyevent 4 >/dev/null 2>&1; sleep 1; }
shot 0; tap 360 907 5                 # Agree
tap 360 464 2; A shell input text "$DH_USER" >/dev/null 2>&1; sleep 1; hidekb
tap 360 582 2; A shell input text "$DH_PASS" >/dev/null 2>&1; sleep 1; hidekb
tap 67 705 2; tap 360 852 7           # check + Log In
sleep 3; shot 5; tap 360 670 3        # notif ALLOW
sleep 2; shot 6; tap 617 255 3        # cerrar popup X
sleep 2; shot 7
