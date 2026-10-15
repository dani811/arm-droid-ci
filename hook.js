'use strict';
function sl(c,l){try{send({t:'cap',cat:c,line:''+l});}catch(e){}}
function rdStr(p){try{if(p.isNull())return null;var f=p.readU8();if((f&1)===0)return p.add(1).readUtf8String(f>>1);var l=p.add(8).readU64();return p.add(16).readPointer().readUtf8String(l.toNumber());}catch(e){return '<e>';}}
function bstr(p,n){try{var u=new Uint8Array(p.readByteArray(n));var pr=true;for(var i=0;i<u.length;i++){if(u[i]<9||u[i]>126){pr=false;break;}}var s='';if(pr){for(var i=0;i<u.length;i++)s+=String.fromCharCode(u[i]);return 'ascii:'+s;}for(var i=0;i<u.length;i++)s+=('0'+u[i].toString(16)).slice(-2);return 'hex:'+s;}catch(e){return '<e>';}}
var done=false;
function arm(){var mod='libiotcommon.so';if(!Process.findModuleByName(mod))return false;
  Process.getModuleByName(mod).enumerateExports().forEach(function(e){if(/[sS]et.*App(Key|Secret)|getAppKey/.test(e.name)){try{Interceptor.attach(e.address,{onEnter:function(a){sl('key',e.name+' = '+rdStr(a[1]));}});sl('log','hooked '+e.name);}catch(x){}}});
  ['HMAC','HMAC_Init_ex'].forEach(function(fn){var a=Module.findExportByName(mod,fn);if(a){Interceptor.attach(a,{onEnter:function(args){try{var len=args[2].toInt32();if(len>0&&len<128)sl('hmac',fn+' klen='+len+' k='+bstr(args[1],len));}catch(e){}}});}});
  sl('log','ARMED libiotcommon');return true;}
var iv=setInterval(function(){if(arm()){done=true;clearInterval(iv);}},300);
['android_dlopen_ext','dlopen'].forEach(function(fn){var p=Module.findExportByName(null,fn);if(p)Interceptor.attach(p,{onEnter:function(a){try{var n=a[0].readCString();if(n&&/\.so/.test(n))sl('dl',n.split('/').pop());}catch(e){}},onLeave:function(){if(!done&&Process.findModuleByName('libiotcommon.so')){if(arm())done=true;}}});});
sl('log','hook armed');
