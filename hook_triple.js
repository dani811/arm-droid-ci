'use strict';
// LOOT del credencial itls por la via CORRECTA (docs: finisher B): hook NATIVO de
// libitls.so. hal_itls_write/read son los bytes MQTT EN CLARO justo antes/despues del
// TLS de iTLS (mbedtls). El primer hal_itls_write es el paquete CONNECT, que lleva en
// claro clientId + username(dn&pk) + password(HMAC-SHA1 con el productSecret, que el
// packer libnesec descifra en runtime). Capturamos el CONNECT -> credencial REUTILIZABLE
// (clientId fijo, #291) sin recuperar el productSecret. Simbolos EXPORTADOS -> el
// anti-frida del packer NO para el hook nativo (docs p2p-resume §166).
//
// Firma mbedtls-style:  int hal_itls_write(void* ctx, const uint8_t* buf, size_t len)
//                       int hal_itls_read (void* ctx,       uint8_t* buf, size_t len)
// (read: los bytes utiles estan onLeave, len = retorno).
//
// Emite send({t:'itls'|'note', ...}); el driver escribe a fichero. NUNCA imprime valores.

var MOD = 'libitls.so';

function emit(k, v) { try { send({ t: 'itls', k: k, v: (v == null ? '' : '' + v) }); } catch (e) {} }
function note(m) { try { send({ t: 'note', m: '' + m }); } catch (e) {} }

function toHex(p, n) {
    try {
        var b = new Uint8Array(p.readByteArray(n));
        var s = '';
        for (var i = 0; i < b.length; i++) { var x = b[i].toString(16); s += (x.length < 2 ? '0' : '') + x; }
        return s;
    } catch (e) { return ''; }
}

// Parse de un paquete MQTT 3.1.1 CONNECT -> {clientId, username, password}. null si no es CONNECT.
function parseConnect(p, total) {
    try {
        if ((p.readU8() & 0xf0) !== 0x10) return null;    // 0x10 = CONNECT
        var off = 1;
        // remaining length (varint, hasta 4 bytes)
        var mult = 1, rl = 0, b;
        do { b = p.add(off).readU8(); off++; rl += (b & 0x7f) * mult; mult *= 128; } while ((b & 0x80) && off < 5);
        // variable header: protocolo
        var pnlen = (p.add(off).readU8() << 8) | p.add(off + 1).readU8(); off += 2;
        off += pnlen;                 // "MQTT"
        off += 1;                     // protocol level
        var flags = p.add(off).readU8(); off += 1;
        off += 2;                     // keepalive
        function rdStr() { var l = (p.add(off).readU8() << 8) | p.add(off + 1).readU8(); off += 2; var s = p.add(off).readUtf8String(l); off += l; return s; }
        var out = {};
        out.clientId = rdStr();
        if (flags & 0x04) { rdStr(); rdStr(); }          // will topic + msg
        if (flags & 0x80) out.username = rdStr();         // username present
        if (flags & 0x40) out.password = rdStr();         // password present
        return out;
    } catch (e) { return null; }
}

var wCount = 0, rCount = 0, gotConnect = false;

function arm() {
    var m = Process.findModuleByName(MOD);
    if (!m) return false;

    var w = Module.findExportByName(MOD, 'hal_itls_write');
    if (w) {
        Interceptor.attach(w, { onEnter: function (a) {
            if (wCount++ > 6) return;                      // CONNECT + primeros frames (bind)
            var buf = a[1], len = a[2].toInt32();
            if (len <= 0 || len > 65536) return;
            var c = parseConnect(buf, len);
            if (c && !gotConnect) {
                gotConnect = true;
                if (c.clientId) emit('mqtt_clientId', c.clientId);
                if (c.username) emit('mqtt_username', c.username);     // = deviceName&productKey
                if (c.password) emit('mqtt_password', c.password);     // = HMAC(...) reutilizable
                note('CONNECT itls capturado -> credencial emitida');
            } else {
                emit('itls_w_hex', toHex(buf, Math.min(len, 512)));    // frames siguientes (bind/pub)
            }
        } });
        note('hal_itls_write hookeado');
    } else { note('hal_itls_write NO export'); }

    var r = Module.findExportByName(MOD, 'hal_itls_read');
    if (r) {
        Interceptor.attach(r, {
            onEnter: function (a) { this.buf = a[1]; },
            onLeave: function (ret) {
                if (rCount++ > 6) return;
                var n = ret.toInt32();
                if (n > 0 && n <= 65536 && this.buf) emit('itls_r_hex', toHex(this.buf, Math.min(n, 512)));
            }
        });
        note('hal_itls_read hookeado');
    }
    note('ARMED libitls (hal_itls_write/read)');
    return true;
}

var iv = setInterval(function () { if (arm()) clearInterval(iv); }, 300);
// re-armar si libitls carga perezosa
var dl = Module.findExportByName(null, 'android_dlopen_ext');
if (dl) Interceptor.attach(dl, { onLeave: function () { if (Process.findModuleByName(MOD)) arm(); } });
note('hook_triple nativo cargado (libitls)');
