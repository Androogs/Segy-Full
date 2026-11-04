// Equipo en 2D (dos caras en CSS 3D). Se muestra mientras carga la escena 3D y como respaldo si el navegador no
// tiene WebGL o la persona prefiere menos movimiento. Mismo diseño genérico de SEGY que el modelo 3D.
import { forwardRef, useId } from 'react';

interface Props { espalda: string; marco: string }

export const EquipoPoster = forwardRef<HTMLDivElement, Props>(function EquipoPoster({ espalda, marco }, ref) {
  // Identificadores únicos: puede haber varios equipos en la página (versión sin animación) y algunos ocultos.
  const id = useId().replace(/:/g, '');
  const fondo = `${id}f`; const brillo = `${id}b`; const recorte = `${id}r`;
  return (
    <div className="poster" ref={ref} aria-hidden="true">
      <svg className="poster__cara" viewBox="0 0 390 815">
        <defs>
          <linearGradient id={fondo} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#140202" /><stop offset="0.55" stopColor="#0a0a0a" /><stop offset="1" stopColor="#2a0000" />
          </linearGradient>
          <radialGradient id={brillo} cx="0.5" cy="0.95" r="0.75">
            <stop offset="0" stopColor="#ff0808" stopOpacity="0.8" /><stop offset="1" stopColor="#ff0808" stopOpacity="0" />
          </radialGradient>
          <clipPath id={recorte}><rect x="13" y="13" width="364" height="789" rx="44" /></clipPath>
        </defs>
        <rect x="0" y="0" width="390" height="815" rx="56" fill={marco} />
        <rect x="5" y="5" width="380" height="805" rx="51" fill="#030303" />
        <g clipPath={`url(#${recorte})`}>
          <rect x="13" y="13" width="364" height="789" fill={`url(#${fondo})`} />
          <rect x="13" y="13" width="364" height="789" fill={`url(#${brillo})`} />
          {/* Solo la copa de la palmera del logo (mismo recorte que la pantalla 3D). */}
          <svg x="-40" y="400" width="470" height="168" viewBox="350 262 1480 528" preserveAspectRatio="xMidYMid slice"><image href="/marca/logo-segy.webp" width="2000" height="2000" /></svg>
        </g>
        <circle cx="195" cy="38" r="9" fill="#000" />
        <text x="195" y="150" textAnchor="middle" fill="#fff" fontFamily="'Archivo Variable', system-ui, sans-serif" fontWeight="800" fontSize="104">10:08</text>
        <rect x="135" y="788" width="120" height="5" rx="3" fill="#fff" opacity="0.85" />
      </svg>
      <svg className="poster__cara poster__cara--atras" viewBox="0 0 390 815">
        <rect x="0" y="0" width="390" height="815" rx="56" fill={marco} />
        <rect x="5" y="5" width="380" height="805" rx="51" fill={espalda} />
        <rect x="244" y="36" width="86" height="220" rx="43" fill={espalda} stroke="rgba(255,255,255,0.18)" strokeWidth="2" />
        {[78, 146, 214].map((y) => (
          <g key={y}><circle cx="287" cy={y} r="29" fill="#141416" /><circle cx="287" cy={y} r="21" fill="#05070d" /><circle cx="281" cy={y - 6} r="5" fill="#fff" opacity="0.35" /></g>
        ))}
        <circle cx="219" cy="64" r="9" fill="#f1e6c8" />
        <image href="/marca/logo-segy.webp" x="95" y="390" width="200" height="200" opacity="0.5" style={{ mixBlendMode: 'luminosity' }} />
      </svg>
    </div>
  );
});
