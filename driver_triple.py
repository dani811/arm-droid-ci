import frida, sys, time

# Driver de LOOT del triple. Escribe valores SOLO a /tmp/triple_raw.txt (se cifra y
# exfila). En stdout imprime SOLO nombres de campo + diagnostico de attach, nunca valores.
# argv: [capture_secs] [target_pid]  -> si hay pid, attachea por PID (robusto al packer).

dev = frida.get_device_manager().add_remote_device('127.0.0.1:27042')
out = open('/tmp/triple_raw.txt', 'a', encoding='utf-8')

def onmsg(m, d):
    if m.get('type') == 'send':
        p = m.get('payload')
        if isinstance(p, dict) and p.get('t') in ('triple', 'itls'):
            v = str(p.get('v'))
            out.write(str(p.get('k')) + '=' + v + '\n'); out.flush()
            print('GOT', p.get('k'), '(len=%d)' % len(v)); return   # nombre + longitud, NO el valor
        if isinstance(p, dict) and p.get('t') == 'note':
            print('NOTE', p.get('m')); return
    print('MSG', str(m)[:200])

PKG = 'com.dreame.smartlife'
secs = float(sys.argv[1]) if len(sys.argv) > 1 else 120.0
pid = int(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2].isdigit() else None

# diagnostico: listar procesos que ve frida-server
try:
    procs = dev.enumerate_processes()
    print('frida ve %d procesos' % len(procs))
    for pr in procs:
        if 'dreame' in (pr.name or '').lower():
            print('  cand:', pr.pid, pr.name)
except Exception as e:
    print('enumerate_processes FALLO (frida-server caido?):', str(e)[:120])

s = None
for i in range(40):
    try:
        tgt = pid if pid else PKG
        s = dev.attach(tgt); print('attached a', tgt, '(try %d)' % i); break
    except Exception as e:
        print('attach retry', i, '->', str(e)[:120]); time.sleep(2)
if s is None:
    print('ABORT: no se pudo attachear (pid=%s)' % pid)
    out.write('--- attach-fail ---\n'); out.close(); sys.exit(0)

sc = s.create_script(open('hook_triple.js').read()); sc.on('message', onmsg); sc.load()
print('attached+hooked (triple loot)')
time.sleep(secs)
out.write('--- done ---\n'); out.close()
