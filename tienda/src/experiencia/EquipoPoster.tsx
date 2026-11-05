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
        <rect x="120" y="24" width="150" height="27" rx="14" fill="#000" />
        <circle cx="240" cy="37" r="7" fill="#11141a" />
        <text x="195" y="150" textAnchor="middle" fill="#fff" fontFamily="'Archivo Variable', system-ui, sans-serif" fontWeight="800" fontSize="104">10:08</text>
        <rect x="135" y="788" width="120" height="5" rx="3" fill="#fff" opacity="0.85" />
      </svg>
      <svg className="poster__cara poster__cara--atras" viewBox="0 0 390 815">
        <rect x="0" y="0" width="390" height="815" rx="56" fill={marco} />
        <rect x="5" y="5" width="380" height="805" rx="51" fill={espalda} />
        <rect x="16" y="26" width="358" height="150" rx="40" fill={espalda} stroke="rgba(255,255,255,0.2)" strokeWidth="2" />
        {[[290, 68], [290, 138], [212, 103]].map(([cx, cy]) => (
          <g key={`${cx}-${cy}`}><circle cx={cx} cy={cy} r="30" fill="#141416" /><circle cx={cx} cy={cy} r="22" fill="#05070d" /><circle cx={cx - 6} cy={cy - 7} r="5" fill="#fff" opacity="0.35" /></g>
        ))}
        <circle cx="72" cy="60" r="11" fill="#f1e6c8" />
        <circle cx="72" cy="98" r="4.5" fill="#0c0c0e" />
        <circle cx="72" cy="140" r="17" fill="#0a0c12" stroke="rgba(255,255,255,0.15)" strokeWidth="2" />
        <rect x="42" y="216" width="306" height="552" rx="34" fill={espalda} />
        <rect x="42" y="216" width="306" height="552" rx="34" fill="#fff" opacity="0.16" />
        <image href="/marca/logo-segy.webp" x="112" y="410" width="166" height="166" opacity="0.5" style={{ mixBlendMode: 'luminosity' }} />
      </svg>
    </div>
  );
});
