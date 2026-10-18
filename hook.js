'use strict';
// Captura la señalización WebRTC P2P del robot EN CLARO (antes del TLS):
//  - TX: lv_cws_send(handle, opcode, data, len)   -> offerSdp/candidate que manda la app
//  - RX: WebsocketClient::OnData(const char*, len) -> answerSdp/candidate del robot
// liblvmedia.so (fork libwebrtc LinkVisual). Responde: ¿el answer real trae ICE?
function sl(c,l){try{send({t:'cap',cat:c,line:''+l});}catch(e){}}
function rd(p,n){try{if(n>0&&n<131072)return p.readUtf8String(n);return p.readCString();}catch(e){return '<e>';}}
var armed=false;
function arm(){
  var mod='liblvmedia.so';
  if(!Process.findModuleByName(mod))return false;
  var M=Process.getModuleByName(mod);
  var tx=Module.findExportByName(mod,'lv_cws_send');
  if(tx){try{Interceptor.attach(tx,{onEnter:function(a){try{var n=a[3].toInt32();sl('wss_tx',rd(a[2],n));}catch(e){}}});sl('log','hooked lv_cws_send');}catch(e){sl('log','tx fail '+e);}}
  else sl('log','lv_cws_send NO export');
  // RX por offset (vaddr del símbolo WebsocketClient::OnData)
  try{Interceptor.attach(M.base.add(0x1fbdc4),{onEnter:function(a){try{var n=a[2].toInt32();sl('wss_rx',rd(a[1],n));}catch(e){}}});sl('log','hooked OnData@1fbdc4');}catch(e){sl('log','rx fail '+e);}
  // Respaldo: lv_cws_send por si el nombre difiere -> tambien hookeamos lv_cws_ping no (ruido)
  sl('log','ARMED liblvmedia'); return true;
}
var iv=setInterval(function(){if(arm()){armed=true;clearInterval(iv);}},300);
['android_dlopen_ext','dlopen'].forEach(function(fn){var p=Module.findExportByName(null,fn);if(p)Interceptor.attach(p,{onEnter:function(a){try{var s=a[0].readCString();if(s&&/liblvmedia|libiotcommon/.test(s))sl('dl',s.split('/').pop());}catch(e){}},onLeave:function(){if(!armed&&Process.findModuleByName('liblvmedia.so')){if(arm())armed=true;}}});});
sl('log','hook armed (lv_cws signaling)');
