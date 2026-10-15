#!/usr/bin/env bash
S=127.0.0.1:5555
A(){ timeout 25 adb -s $S "$@"; }
shot(){ A exec-out screencap -p > /tmp/screen_$1.png 2>/dev/null; echo "shot $1"; }
iot(){ P=$(A shell pidof com.dreame.smartlife 2>/dev/null|tr -d '\r'); echo "IOTC_$1=$(A shell cat /proc/$P/maps 2>/dev/null|grep -c iotcommon)"; }
shot 8; iot home
A shell input tap 90 1118 >/dev/null 2>&1; sleep 5; shot 9; iot devtab
sleep 10; shot 10; iot t1
sleep 10; shot 11; iot t2
