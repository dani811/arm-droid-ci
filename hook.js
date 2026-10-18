'use strict';
// Captura EN CLARO el hilo de señalización WebRTC P2P (wss) de la app Dreamehome,
// antes del TLS, por símbolos nativos EXPORTADOS de liblvmedia.so (robusto frente al
// strip y al packer NetEase: no toca Java/ART). Verificado contra el binario 2.1.8.8:
//
//   TX (app -> robot):  WebsocketClient::SendMsg(std::string)  @ _ZN15WebsocketClient7SendMsgE...
//                       -> el mensaje JSON serializado que sale por la wss
//                       (offerSdp, candidate, startStreaming y CUALQUIER registro previo).
//   RX (robot -> app):  Ali_peerConn_handleSignalMsg(char*)    @ _Z28Ali_peerConn_handleSignalMsgPc
//                       -> el JSON entrante crudo (answerSdp/candidate REALES del robot).
//   RX respaldo:        WebsocketClient::OnData(const char*, size_t) @ _ZN15WebsocketClient6OnDataEPKcm
//   TX respaldo (cJSON): webrtcDevUnit::sendMessage                  (solo marca de paso)
//
// Objetivo: ver qué manda la app en su PRIMER intercambio y qué answer REAL (con ICE)
// recibe, para compararlo con nuestra sonda (que recibe un stub sin ICE).
//
// Emite por send({t:'cap',cat,line}) -> driver.py lo escribe a /tmp/capture.txt.

function now() { return Date.now(); }
function sl(cat, line) { try { send({ t: 'cap', cat: cat, ts: now(), line: '' + line }); } catch (e) {} }

var MOD = 'liblvmedia.so';
var MANGLED = {
    tx_sendmsg: '_ZN15WebsocketClient7SendMsgENSt6__ndk112basic_stringIcNS0_11char_traitsIcEENS0_9allocatorIcEEEE',
    rx_handle:  '_Z28Ali_peerConn_handleSignalMsgPc',
    rx_ondata:  '_ZN15WebsocketClient6OnDataEPKcm',
    tx_devunit: '_ZN13webrtcDevUnit11sendMessageEP5cJSONRK15_ConductMsgInfo',
    onsignal:   '_Z12OnSignalDataPciS_l'
};

// Lee un std::string de libc++ (Android __ndk1) desde un puntero. Maneja SSO (short)
// y heap (long). Little-endian, __short_mask = 1.
function readStdStr(p) {
    if (!p || p.isNull()) return null;
    try {
        var b0 = p.readU8();
        if ((b0 & 1) === 0) {            // short string
            var n = b0 >>> 1;
            if (n > 0 && n < 256) return p.add(1).readUtf8String(n);
            return '';
        }
        var n2 = p.add(8).readU64().toNumber();   // long: size
        var d = p.add(16).readPointer();          // long: data ptr
        if (n2 > 0 && n2 < 262144) return d.readUtf8String(n2);
        return '';
    } catch (e) { return '<stdstr-err>'; }
}
function readCStr(p, n) {
    if (!p || p.isNull()) return null;
    try { if (n && n > 0 && n < 262144) return p.readUtf8String(n); return p.readCString(); }
    catch (e) { return '<cstr-err>'; }
}

var armed = false;
function sym(name) { try { return Module.findExportByName(MOD, name); } catch (e) { return null; } }

function arm() {
    if (!Process.findModuleByName(MOD)) return false;

    // --- TX: WebsocketClient::SendMsg(std::string) ---
    var tx = sym(MANGLED.tx_sendmsg);
    if (tx) {
        Interceptor.attach(tx, { onEnter: function (a) { sl('wss_tx', readStdStr(a[1])); } });
        sl('log', 'hooked SendMsg(TX)');
    } else { sl('log', 'SendMsg NO export'); }

    // --- RX: Ali_peerConn_handleSignalMsg(char*) ---
    var rx = sym(MANGLED.rx_handle);
    if (rx) {
        Interceptor.attach(rx, { onEnter: function (a) { sl('wss_rx', readCStr(a[0], 0)); } });
        sl('log', 'hooked handleSignalMsg(RX)');
    } else { sl('log', 'handleSignalMsg NO export'); }

    // --- RX respaldo: WebsocketClient::OnData(char*, size_t) ---
    var od = sym(MANGLED.rx_ondata);
    if (od) {
        Interceptor.attach(od, { onEnter: function (a) { sl('wss_rx2', readCStr(a[1], a[2].toInt32())); } });
        sl('log', 'hooked OnData(RX2)');
    }

    // --- TX respaldo (saliente a publicar): OnSignalData(char*,int,char*,long) ---
    var os = sym(MANGLED.onsignal);
    if (os) {
        Interceptor.attach(os, { onEnter: function (a) {
            sl('wss_tx2.a0', readCStr(a[0], a[1].toInt32()));
            sl('wss_tx2.a2', readCStr(a[2], 0));
        } });
        sl('log', 'hooked OnSignalData(TX2)');
    }

    sl('log', 'ARMED liblvmedia (wss TX/RX por símbolo)');
    return true;
}

var iv = setInterval(function () { if (arm()) { armed = true; clearInterval(iv); } }, 300);

// Re-armar cuando se cargue liblvmedia / libiotcommon (carga perezosa al abrir cámara).
['android_dlopen_ext', 'dlopen'].forEach(function (fn) {
    var p = Module.findExportByName(null, fn);
    if (p) Interceptor.attach(p, {
        onEnter: function (a) { try { var s = a[0].readCString(); if (s && /lvmedia|iotcommon/.test(s)) sl('dl', s.split('/').pop()); } catch (e) {} },
        onLeave: function () { if (!armed && Process.findModuleByName(MOD)) { if (arm()) armed = true; } }
    });
});
sl('log', 'hook cargado (wss signaling, símbolos verificados 2.1.8.8)');
