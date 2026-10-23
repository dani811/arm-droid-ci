'use strict';
// Variante GADGET-SCRIPT del hook de loot itls. El gadget (modo "script") carga este JS
// DENTRO de cada proceso de la app automaticamente (sin attach, sin socket -> evita la
// deteccion anti-frida por puerto). Solo actua en el proceso que tiene libitls.so.
// Escribe el CONNECT capturado a un FICHERO de la app (secreto -> nunca a logcat).
// Diagnostico no-sensible por console.log (va a logcat): solo nombres, nunca valores.

var MOD = 'libitls.so';
var OUTFILE = '/data/data/com.dreame.smartlife/files/triple.txt';

function writeLine(line) {
    try { var f = new File(OUTFILE, 'a'); f.write(line + '\n'); f.flush(); f.close(); } catch (e) {}
}
function emit(k, v) { writeLine(k + '=' + (v == null ? '' : '' + v)); console.log('[LOOT] GOT ' + k); }
function note(m) { console.log('[LOOT] NOTE ' + m); }

function toHex(p, n) {
    try { var b = new Uint8Array(p.readByteArray(n)); var s = ''; for (var i = 0; i < b.length; i++) { var x = b[i].toString(16); s += (x.length < 2 ? '0' : '') + x; } return s; } catch (e) { return ''; }
}
function parseConnect(p) {
    try {
        if ((p.readU8() & 0xf0) !== 0x10) return null;
        var off = 1, mult = 1, b; do { b = p.add(off).readU8(); off++; mult *= 128; } while ((b & 0x80) && off < 5);
        var pnlen = (p.add(off).readU8() << 8) | p.add(off + 1).readU8(); off += 2 + pnlen + 1;
        var flags = p.add(off).readU8(); off += 1 + 2;
        function rd() { var l = (p.add(off).readU8() << 8) | p.add(off + 1).readU8(); off += 2; var s = p.add(off).readUtf8String(l); off += l; return s; }
        var o = {}; o.clientId = rd();
        if (flags & 0x04) { rd(); rd(); }
        if (flags & 0x80) o.username = rd();
        if (flags & 0x40) o.password = rd();
        return o;
    } catch (e) { return null; }
}

var wN = 0, rN = 0, gotC = false, armed = false;
function arm() {
    if (!Process.findModuleByName(MOD)) return false;
    var w = Module.findExportByName(MOD, 'hal_itls_write');
    if (w) {
        Interceptor.attach(w, { onEnter: function (a) {
            if (wN++ > 6) return;
            var buf = a[1], len = a[2].toInt32(); if (len <= 0 || len > 65536) return;
            var c = parseConnect(buf);
            if (c && !gotC) { gotC = true;
                if (c.clientId) emit('mqtt_clientId', c.clientId);
                if (c.username) emit('mqtt_username', c.username);
                if (c.password) emit('mqtt_password', c.password);
                note('CONNECT itls capturado');
            } else emit('itls_w_hex', toHex(buf, Math.min(len, 512)));
        } });
    }
    var r = Module.findExportByName(MOD, 'hal_itls_read');
    if (r) Interceptor.attach(r, { onEnter: function (a) { this.b = a[1]; }, onLeave: function (ret) { if (rN++ > 6) return; var n = ret.toInt32(); if (n > 0 && n <= 65536 && this.b) emit('itls_r_hex', toHex(this.b, Math.min(n, 512))); } });
    note('ARMED libitls (pid=' + Process.id + ')');
    return true;
}
var iv = setInterval(function () { if (!armed && arm()) { armed = true; clearInterval(iv); } }, 300);
var dl = Module.findExportByName(null, 'android_dlopen_ext');
if (dl) Interceptor.attach(dl, { onLeave: function () { if (!armed && Process.findModuleByName(MOD)) { if (arm()) armed = true; } } });
console.log('[LOOT] hook_gadget cargado pid=' + Process.id);
