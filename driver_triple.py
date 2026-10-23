import frida, sys, time

# Driver de LOOT. Soporta frida-server (attach por PID) Y gadget embebido (listen):
# en modo gadget, enumerate_processes() devuelve UN solo proceso (el propio gadget) y
# hay que attachear a ESE (attach a un pid "externo" da "unable to act on other
# processes when embedded"). Escribe valores SOLO a fichero; stdout = nombres + len.

dev = frida.get_device_manager().add_remote_device('127.0.0.1:27042')
out = open('/tmp/triple_raw.txt', 'a', encoding='utf-8')

def onmsg(m, d):
    if m.get('type') == 'send':
        p = m.get('payload')
        if isinstance(p, dict) and p.get('t') in ('triple', 'itls'):
            v = str(p.get('v')); out.write(str(p.get('k')) + '=' + v + '\n'); out.flush()
            print('GOT', p.get('k'), '(len=%d)' % len(v)); return
        if isinstance(p, dict) and p.get('t') == 'note':
            print('NOTE', p.get('m')); return
    print('MSG', str(m)[:200])

PKG = 'com.dreame.smartlife'
secs = float(sys.argv[1]) if len(sys.argv) > 1 else 120.0
pid_hint = int(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2].isdigit() else None

def pick_target():
    try:
        procs = dev.enumerate_processes()
    except Exception as e:
        print('enumerate FALLO:', str(e)[:100]); return [pid_hint] if pid_hint else []
    print('frida ve %d procesos' % len(procs))
    for pr in procs:
        if 'dreame' in (pr.name or '').lower() or 'Gadget' in (pr.name or ''):
            print('  cand:', pr.pid, pr.name)
    # Modo gadget: 1 solo proceso -> attachear a ESE. Si no, preferir el que matchea.
    cands = []
    if len(procs) == 1:
        cands = [procs[0].pid]
    else:
        cands = [pr.pid for pr in procs if 'dreame' in (pr.name or '').lower()]
    if pid_hint and pid_hint not in cands:
        cands.append(pid_hint)
    return cands or [pr.pid for pr in procs]

s = None
for i in range(40):
    for tgt in pick_target():
        try:
            s = dev.attach(tgt); print('attached a', tgt, '(try %d)' % i); break
        except Exception as e:
            print('attach retry', i, 'tgt', tgt, '->', str(e)[:80])
    if s is not None:
        break
    time.sleep(2)
if s is None:
    print('ABORT: no se pudo attachear'); out.write('--- attach-fail ---\n'); out.close(); sys.exit(0)

sc = s.create_script(open('hook_triple.js').read()); sc.on('message', onmsg); sc.load()
print('attached+hooked (triple loot)')
time.sleep(secs)
out.write('--- done ---\n'); out.close()
