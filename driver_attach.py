import frida, sys, time

dev = frida.get_device_manager().add_remote_device('127.0.0.1:27042')
out = open('/tmp/capture.txt', 'a', encoding='utf-8')

def onmsg(m, d):
    if m.get('type') == 'send':
        p = m.get('payload')
        if isinstance(p, dict) and p.get('t') == 'cap':
            out.write(str(p.get('cat')) + ': ' + str(p.get('line')) + '\n'); out.flush()
            print('CAP', p.get('cat')); return
    out.write('MSG ' + str(m) + '\n'); out.flush()

PKG = 'com.dreame.smartlife'
s = None
for i in range(40):
    try:
        s = dev.attach(PKG); print('attached (try %d)' % i); break
    except Exception as e:
        print('attach retry', e); time.sleep(2)
if s is None:
    print('ABORT: no se pudo attachear a', PKG, '-> la app no está corriendo')
    out.write('--- attach-fail ---\n'); out.close(); sys.exit(0)

sc = s.create_script(open('hook.js').read()); sc.on('message', onmsg); sc.load()
print('attached+hooked')
time.sleep(float(sys.argv[1]) if len(sys.argv) > 1 else 90)
out.write('--- done ---\n'); out.close()
