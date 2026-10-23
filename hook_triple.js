'use strict';
// LOOT del TRIPLE itls (deviceName/productKey/deviceSecret) de la IDENTIDAD-COMPAÑERO
// de la app Dreamehome, a prueba del packer NetEase y de la ofuscación de nombres.
//
// Clave del método (engram §11 doc ESQUEMA): el deviceSecret se provisiona en el 1er
// arranque y está PROTEGIDO -> no sale en volcados pasivos. PERO se usa en claro en el
// connect itls para firmar el password MQTT:
//     password = HMAC-SHA1("clientId{dn&pk}deviceName{dn}productKey{pk}", deviceSecret)
// Por tanto, hookeando javax.crypto.Mac capturamos, de golpe y sin depender de nombres
// de clase ofuscados:
//   - init(Key)      -> SecretKeySpec.getEncoded() = *** deviceSecret ***  (la clave HMAC)
//   - update/doFinal -> el signContent, que contiene dn y pk en claro.
// El par (clave, contenido) se correlaciona: si el contenido empieza por "clientId" y
// trae "deviceName"/"productKey", la clave de ese mismo Mac ES el deviceSecret.
//
// Hook secundario (corroboración + password ya hecho): parámetros del connect MQTT
// (clientId/username/password) por Paho y por el wrapper Aliyun, sea cual sea su nombre.
//
// NO toca el directo ni startMonitor -> la presencia/connect itls ocurre al LOGUEAR,
// no despierta el robot.
//
// Emite send({t:'triple',k,v}); el driver lo escribe a fichero. NUNCA imprime valores.

function emit(k, v) { try { send({ t: 'triple', k: k, v: (v == null ? '' : '' + v) }); } catch (e) {} }
function note(m) { try { send({ t: 'note', m: '' + m }); } catch (e) {} }

function bytesToHex(b) {
    if (!b) return '';
    var s = '';
    for (var i = 0; i < b.length; i++) { var x = (b[i] & 0xff).toString(16); s += (x.length < 2 ? '0' : '') + x; }
    return s;
}
function bytesToStr(b) {
    if (!b) return '';
    try { return Java.use('java.lang.String').$new(b); } catch (e) { return '<bytes:' + b.length + '>'; }
}
function looksLikeSignContent(s) {
    return typeof s === 'string' && s.indexOf('clientId') === 0 && s.indexOf('deviceName') >= 0 && s.indexOf('productKey') >= 0;
}
function parseDnPk(sign) {
    // "clientId{dn&pk}deviceName{dn}productKey{pk}"  (sin separadores fijos: parse por anclas)
    try {
        var dn = sign.split('deviceName')[1].split('productKey')[0];
        var pk = sign.split('productKey')[1];
        return { dn: dn, pk: pk };
    } catch (e) { return null; }
}

Java.perform(function () {
    note('hook_triple cargado');

    // ---- PRIMARIO: javax.crypto.Mac (deviceSecret = clave HMAC-SHA1 del connect itls) ----
    try {
        var Mac = Java.use('javax.crypto.Mac');
        var pendingKeyHex = null;

        var initKey = Mac.init.overload('java.security.Key');
        initKey.implementation = function (key) {
            try {
                var enc = Java.cast(key, Java.use('java.security.Key')).getEncoded();
                if (enc && enc.length >= 8 && enc.length <= 64) pendingKeyHex = bytesToHex(enc);
            } catch (e) {}
            return initKey.call(this, key);
        };
        try {
            var initKeyParams = Mac.init.overload('java.security.Key', 'java.security.spec.AlgorithmParameterSpec');
            initKeyParams.implementation = function (key, spec) {
                try {
                    var enc = Java.cast(key, Java.use('java.security.Key')).getEncoded();
                    if (enc && enc.length >= 8 && enc.length <= 64) pendingKeyHex = bytesToHex(enc);
                } catch (e) {}
                return initKeyParams.call(this, key, spec);
            };
        } catch (e) {}

        function onContent(contentStr) {
            if (!looksLikeSignContent(contentStr)) return;
            var dp = parseDnPk(contentStr);
            if (dp) { emit('deviceName', dp.dn); emit('productKey', dp.pk); }
            if (pendingKeyHex) emit('deviceSecret_hex', pendingKeyHex); // bytes del secret, en hex
            emit('signContent', contentStr);
            note('MAC: signContent itls capturado -> triple emitido');
        }

        var doFinalB = Mac.doFinal.overload('[B');
        doFinalB.implementation = function (data) {
            try { onContent(bytesToStr(data)); } catch (e) {}
            return doFinalB.call(this, data);
        };
        try {
            var updateB = Mac.update.overload('[B');
            updateB.implementation = function (data) {
                try { onContent(bytesToStr(data)); } catch (e) {}
                return updateB.call(this, data);
            };
        } catch (e) {}
        note('MAC hookeado (init/update/doFinal)');
    } catch (e) { note('MAC hook fallo: ' + e); }

    // ---- SECUNDARIO: parámetros del connect MQTT (Paho) ----
    try {
        var OPT = Java.use('org.eclipse.paho.client.mqttv3.MqttConnectOptions');
        var setU = OPT.setUserName.overload('java.lang.String');
        setU.implementation = function (u) { try { emit('mqtt_username', u); } catch (e) {} return setU.call(this, u); };
        var setP = OPT.setPassword.overload('[C');
        setP.implementation = function (p) {
            try { emit('mqtt_password', p ? Java.use('java.lang.String').$new(p) : ''); } catch (e) {}
            return setP.call(this, p);
        };
        note('Paho MqttConnectOptions hookeado');
    } catch (e) { note('Paho opts no presente: ' + e); }

    // clientId del constructor de MqttAsyncClient / MqttClient
    ['org.eclipse.paho.client.mqttv3.MqttAsyncClient', 'org.eclipse.paho.client.mqttv3.MqttClient'].forEach(function (cn) {
        try {
            var C = Java.use(cn);
            C.$init.overloads.forEach(function (ov) {
                if (ov.argumentTypes.length >= 2 &&
                    ov.argumentTypes[0].className === 'java.lang.String' &&
                    ov.argumentTypes[1].className === 'java.lang.String') {
                    ov.implementation = function () {
                        try { emit('mqtt_serverURI', arguments[0]); emit('mqtt_clientId', arguments[1]); } catch (e) {}
                        return ov.apply(this, arguments);
                    };
                }
            });
            note(cn + ' ctor hookeado');
        } catch (e) {}
    });
});
