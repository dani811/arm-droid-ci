#!/usr/bin/env bash
S=127.0.0.1:5555
shot(){ adb -s $S exec-out screencap -p > /tmp/screen_$1.png; echo "shot $1"; }
tap(){ adb -s $S shell input tap $1 $2; echo "tap $1 $2"; sleep "${3:-3}"; }
sleep 10; shot 0
tap 360 907 5      # Agree and continue
shot 1
