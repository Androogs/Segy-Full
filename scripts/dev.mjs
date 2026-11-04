// Desarrollo: arranca el backend (API en :3400), el panel (Vite en :5173) y la tienda web (Vite en :5174). Ctrl+C detiene todo.
import { spawn } from 'node:child_process';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const procesos = [
  ['backend ', ['run', 'dev', '-w', 'backend'], '\x1b[36m'],
  ['panel   ', ['run', 'dev', '-w', 'frontend'], '\x1b[35m'],
  ['tienda  ', ['run', 'dev', '-w', 'tienda'], '\x1b[33m'],
].map(([nombre, args, color]) => {
  const p = spawn(npm, args, { stdio: ['inherit', 'pipe', 'pipe'], shell: process.platform === 'win32' });
  const salida = (d) => String(d).split(/\r?\n/).filter(Boolean).forEach((l) => console.log(`${color}[${nombre}]\x1b[0m ${l}`));
  p.stdout.on('data', salida); p.stderr.on('data', salida);
  p.on('exit', (c) => { console.log(`[${nombre}] terminó (${c})`); detener(); });
  return p;
});
console.log('\nSEGY en desarrollo:\n  Panel        http://localhost:5173\n  Tienda web   http://localhost:5174\n  API          http://localhost:3400\n');
let deteniendo = false;
function detener() { if (deteniendo) return; deteniendo = true; procesos.forEach((p) => { try { p.kill(); } catch { /* ya terminó */ } }); process.exit(0); }
process.on('SIGINT', detener); process.on('SIGTERM', detener);
