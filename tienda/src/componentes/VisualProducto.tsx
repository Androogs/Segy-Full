// Imagen del producto: la foto que el equipo sube en el panel (Inventario › producto › Fotos) o, si aún no tiene,
// una ilustración propia según el tipo de producto, en el color del producto. Así el catálogo nunca muestra huecos.
import { urlMedia } from '../lib/api';
import type { ProductoResumen } from '../lib/tipos';

type Tipo = 'telefono' | 'estuche' | 'vidrio' | 'cargador' | 'cable' | 'audifonos' | 'bateria' | 'soporte' | 'pantalla' | 'repuesto' | 'sim';

const COLORES: [RegExp, string][] = [
  [/negro|black|grafito|medianoche/i, '#1f2023'], [/blanco|white|crema/i, '#e7e5e1'], [/azul|blue/i, '#2f4b7c'], [/verde|green|menta/i, '#3e6b52'],
  [/gris|gray|plata|silver/i, '#7a7d83'], [/titanio|titanium|natural/i, '#8c8679'], [/rojo|red/i, '#a5161c'], [/rosa|pink/i, '#d99aa6'],
  [/morado|lila|purple|violeta/i, '#5d4a8a'], [/dorado|oro|gold/i, '#c8a96a'], [/naranja|orange/i, '#d06a33'], [/amarillo|yellow/i, '#e2c14a'],
];
export const colorDe = (texto: string | null | undefined, defecto = '#3a3d44'): string => {
  if (!texto) return defecto;
  const c = COLORES.find(([re]) => re.test(texto));
  return c ? c[1] : defecto;
};

export function tipoDe(p: Pick<ProductoResumen, 'nombre' | 'grupo' | 'categoria'>): Tipo {
  const t = `${p.nombre} ${p.categoria?.nombre || ''}`.toLowerCase();
  if (/pantalla|display|lcd/.test(t) && p.grupo === 'repuestos') return 'pantalla';
  if (/bater/.test(t) && p.grupo === 'repuestos') return 'repuesto';
  if (p.grupo === 'repuestos') return 'repuesto';
  if (p.grupo === 'celulares' || p.grupo === 'usados') return 'telefono';
  if (/estuche|funda|case|forro/.test(t)) return 'estuche';
  if (/vidrio|templado|protector/.test(t)) return 'vidrio';
  if (/power ?bank|bater/.test(t)) return 'bateria';
  if (/cable/.test(t)) return 'cable';
  if (/cargador|adaptador de corriente/.test(t)) return 'cargador';
  if (/aud[ií]fono|airpods|manos libres|parlante|buds/.test(t)) return 'audifonos';
  if (/soporte|popsocket|anillo|holder/.test(t)) return 'soporte';
  if (/sim/.test(t)) return 'sim';
  return 'cargador';
}

function Ilustracion({ tipo, color }: { tipo: Tipo; color: string }) {
  const id = `g${tipo}`;
  const brillo = <linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff" stopOpacity="0.22" /><stop offset="0.5" stopColor="#fff" stopOpacity="0" /></linearGradient>;
  switch (tipo) {
    case 'telefono':
      return (
        <svg viewBox="0 0 200 200" aria-hidden="true">
          <defs>{brillo}<linearGradient id="gpant" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1a0505" /><stop offset="1" stopColor="#5a0606" /></linearGradient></defs>
          <g transform="rotate(-8 100 100)">
            <rect x="76" y="22" width="66" height="140" rx="13" fill={color} />
            <rect x="80" y="26" width="58" height="132" rx="10" fill="#d9dadd" opacity="0.08" />
            <rect x="122" y="32" width="14" height="36" rx="7" fill="#0c0c0e" opacity="0.65" />
            {[40, 50, 60].map((y) => <circle key={y} cx="129" cy={y} r="4.2" fill="#05070d" stroke="#2a2a2e" strokeWidth="1.5" />)}
          </g>
          <g transform="rotate(6 100 100)">
            <rect x="52" y="38" width="70" height="146" rx="14" fill={color} />
            <rect x="55.5" y="41.5" width="63" height="139" rx="11" fill="#060606" />
            <rect x="58" y="44" width="58" height="134" rx="9" fill="url(#gpant)" />
            <path d="M87 120c-8-14-20-18-30-14 9-1 18 5 22 13-6-6-15-7-22-3 9 0 16 4 20 10l3 4c2-6 9-13 18-14-8-2-14 1-18 4 3-7 10-11 18-11-10-3-17 2-20 8 0-7 4-13 11-16-11 1-16 9-14 19Z" fill="#ff0808" opacity="0.9" />
            <circle cx="87" cy="50" r="2.4" fill="#000" />
            <rect x="52" y="38" width="70" height="146" rx="14" fill={`url(#${id})`} />
          </g>
        </svg>
      );
    case 'estuche':
      return (
        <svg viewBox="0 0 200 200" aria-hidden="true"><defs>{brillo}</defs>
          <rect x="62" y="24" width="76" height="152" rx="17" fill={color} opacity="0.35" stroke="#fff" strokeOpacity="0.35" strokeWidth="2" />
          <rect x="70" y="32" width="60" height="136" rx="11" fill="none" stroke="#fff" strokeOpacity="0.18" strokeWidth="1.5" />
          <rect x="108" y="34" width="20" height="46" rx="9" fill="#000" opacity="0.5" />
          <path d="M62 50v10M62 72v18" stroke="#fff" strokeOpacity="0.45" strokeWidth="5" strokeLinecap="round" />
          <rect x="62" y="24" width="76" height="152" rx="17" fill={`url(#${id})`} />
        </svg>
      );
    case 'vidrio':
      return (
        <svg viewBox="0 0 200 200" aria-hidden="true"><defs>{brillo}</defs>
          <rect x="72" y="30" width="70" height="146" rx="13" fill="#9fb4c8" opacity="0.12" stroke="#cfe0ef" strokeOpacity="0.5" strokeWidth="1.5" transform="rotate(10 107 103)" />
          <rect x="58" y="24" width="70" height="146" rx="13" fill="#9fb4c8" opacity="0.18" stroke="#e3eef7" strokeOpacity="0.7" strokeWidth="1.5" />
          <path d="M70 60 104 26M66 92l58-58M78 120l50-50" stroke="#fff" strokeOpacity="0.35" strokeWidth="3" strokeLinecap="round" />
          <circle cx="93" cy="34" r="3" fill="none" stroke="#fff" strokeOpacity="0.5" />
        </svg>
      );
    case 'cargador':
      return (
        <svg viewBox="0 0 200 200" aria-hidden="true"><defs>{brillo}</defs>
          <rect x="64" y="70" width="72" height="84" rx="14" fill={color === '#3a3d44' ? '#e9e9ea' : color} />
          <rect x="88" y="100" width="24" height="9" rx="4.5" fill="#1a1a1a" />
          <rect x="82" y="40" width="7" height="32" rx="2" fill="#c9c9c9" /><rect x="111" y="40" width="7" height="32" rx="2" fill="#c9c9c9" />
          <rect x="64" y="70" width="72" height="84" rx="14" fill={`url(#${id})`} />
        </svg>
      );
    case 'cable':
      return (
        <svg viewBox="0 0 200 200" aria-hidden="true">
          <path d="M60 150c-26-20-14-62 24-62s56 34 30 52-60-6-42-34 74-30 70 18" fill="none" stroke="#ececec" strokeWidth="7" strokeLinecap="round" />
          <rect x="132" y="138" width="16" height="34" rx="5" fill="#ececec" transform="rotate(-10 140 155)" /><rect x="136" y="166" width="8" height="12" rx="2" fill="#9a9a9a" transform="rotate(-10 140 155)" />
          <rect x="50" y="140" width="16" height="30" rx="5" fill="#ececec" transform="rotate(25 58 155)" />
        </svg>
      );
    case 'audifonos':
      return (
        <svg viewBox="0 0 200 200" aria-hidden="true"><defs>{brillo}</defs>
          <rect x="50" y="100" width="100" height="68" rx="28" fill="#f2f2f2" /><path d="M50 128h100" stroke="#cfcfcf" strokeWidth="2" />
          <circle cx="100" cy="150" r="3" fill="#8bd48b" />
          <g transform="rotate(-24 70 70)"><ellipse cx="70" cy="70" rx="21" ry="15" fill="#f2f2f2" /><ellipse cx="55" cy="70" rx="9" ry="8" fill="#c9ccd1" /><ellipse cx="78" cy="66" rx="6" ry="3" fill="#d9d9d9" /></g>
          <g transform="rotate(28 134 74)"><ellipse cx="134" cy="74" rx="21" ry="15" fill="#f2f2f2" /><ellipse cx="149" cy="74" rx="9" ry="8" fill="#c9ccd1" /><ellipse cx="126" cy="70" rx="6" ry="3" fill="#d9d9d9" /></g>
          <rect x="50" y="100" width="100" height="68" rx="28" fill={`url(#${id})`} />
        </svg>
      );
    case 'bateria':
      return (
        <svg viewBox="0 0 200 200" aria-hidden="true"><defs>{brillo}</defs>
          <rect x="66" y="34" width="68" height="132" rx="16" fill={color === '#3a3d44' ? '#2a2c31' : color} />
          {[0, 1, 2, 3].map((i) => <circle key={i} cx={86 + i * 9.5} cy="146" r="3" fill={i < 3 ? '#4ade80' : '#555'} />)}
          <rect x="90" y="40" width="20" height="5" rx="2.5" fill="#111" />
          <rect x="66" y="34" width="68" height="132" rx="16" fill={`url(#${id})`} />
        </svg>
      );
    case 'soporte':
      return (
        <svg viewBox="0 0 200 200" aria-hidden="true">
          <circle cx="100" cy="86" r="42" fill="#26282d" stroke="#3b3e45" strokeWidth="3" /><circle cx="100" cy="86" r="28" fill="none" stroke="#ff0808" strokeWidth="3" strokeOpacity="0.8" />
          <rect x="93" y="128" width="14" height="24" rx="4" fill="#3b3e45" /><rect x="76" y="150" width="48" height="12" rx="6" fill="#2a2c31" />
        </svg>
      );
    case 'pantalla':
      return (
        <svg viewBox="0 0 200 200" aria-hidden="true">
          <rect x="62" y="24" width="76" height="152" rx="14" fill="#0b0b0b" stroke="#3a3a3a" strokeWidth="2" />
          <rect x="68" y="30" width="64" height="140" rx="9" fill="#141a26" />
          <path d="M68 140 132 70" stroke="#fff" strokeOpacity="0.15" strokeWidth="10" />
          <rect x="88" y="168" width="24" height="18" rx="3" fill="#c88a2a" />
        </svg>
      );
    case 'repuesto':
      return (
        <svg viewBox="0 0 200 200" aria-hidden="true">
          <rect x="70" y="36" width="60" height="128" rx="8" fill="#232529" stroke="#3b3e45" strokeWidth="2" />
          <rect x="78" y="48" width="44" height="40" rx="4" fill="#ff0808" opacity="0.85" />
          <path d="M84 102h32M84 114h24M84 126h28" stroke="#6b6e75" strokeWidth="4" strokeLinecap="round" />
          <rect x="88" y="156" width="24" height="16" rx="3" fill="#c88a2a" />
        </svg>
      );
    case 'sim':
      return (
        <svg viewBox="0 0 200 200" aria-hidden="true">
          <path d="M70 46h44l20 20v88a6 6 0 0 1-6 6H70a6 6 0 0 1-6-6V52a6 6 0 0 1 6-6Z" fill="#d6b45a" />
          <rect x="80" y="84" width="40" height="46" rx="5" fill="#b38f36" />
          <path d="M140 40l-34 34" stroke="#c9c9c9" strokeWidth="5" strokeLinecap="round" /><circle cx="145" cy="35" r="7" fill="none" stroke="#c9c9c9" strokeWidth="4" />
        </svg>
      );
  }
}

export function VisualProducto({ producto, foto, className = '' }: { producto: Pick<ProductoResumen, 'nombre' | 'grupo' | 'categoria' | 'color'>; foto?: string | null; className?: string }) {
  const src = urlMedia(foto);
  return (
    <div className={`visual ${className}`}>
      {src ? <img className="foto" src={src} alt={producto.nombre} loading="lazy" decoding="async" /> : <Ilustracion tipo={tipoDe(producto)} color={colorDe(producto.color)} />}
    </div>
  );
}
