// Experiencia de desplazamiento del inicio: el equipo queda fijo en pantalla mientras la página baja y, capítulo a
// capítulo, gira, se acerca y cambia de lado (a la manera de las páginas de producto con un objeto protagonista).
// - three.js se descarga solo cuando la sección se acerca a la pantalla (import dinámico de ./escena).
// - Mientras carga, o sin WebGL, se anima el equipo en 2D con la misma coreografía.
// - Con "reducir movimiento" activado, los capítulos se muestran como secciones normales sin animación.
// Todo el DOM que se anima se actualiza por referencias dentro de requestAnimationFrame (sin renders de React por cuadro).
import { useEffect, useRef, useState } from 'react';
import { INSIGNIA } from '../contenido/insignia';
import { CLAVES_ESCRITORIO, CLAVES_MOVIL, VENTANAS, avanceEn, capituloEn, centroDe, poseEn, presencia, type Pose } from './coreografia';
import { EquipoPoster } from './EquipoPoster';
import type { Escena } from './escena';
import type { ProductoDetalle } from '../lib/tipos';
import { CompraInsignia } from './CompraInsignia';

const CAPS = INSIGNIA.capitulos;
const ACABADOS = INSIGNIA.acabados;
const ALTO_VISIBLE = 2 * 5.6 * Math.tan((28 * Math.PI) / 360); // mismo cálculo que la cámara 3D

function prefiereMenosMovimiento(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function Experiencia({ producto }: { producto: ProductoDetalle | null }) {
  const seccion = useRef<HTMLElement>(null);
  const lienzo = useRef<HTMLCanvasElement>(null);
  const poster = useRef<HTMLDivElement>(null);
  const titular = useRef<HTMLDivElement>(null);
  const progreso = useRef<HTMLDivElement>(null);
  const caps = useRef<(HTMLElement | null)[]>([]);
  const fondos = useRef<(HTMLDivElement | null)[]>([]);
  const escena = useRef<Escena | null>(null);
  const fijado = useRef<number | null>(null);
  const [estatica] = useState(prefiereMenosMovimiento);
  const [activo, setActivo] = useState(0);
  const [acabado, setAcabado] = useState(0);
  const [listo3d, setListo3d] = useState(false);

  // Carga diferida de la escena 3D.
  useEffect(() => {
    if (estatica || !seccion.current || !lienzo.current) return;
    let cancelado = false;
    const obs = new IntersectionObserver(async (entradas) => {
      if (!entradas.some((e) => e.isIntersecting) || escena.current) return;
      obs.disconnect();
      try {
        const m = await import('./escena');
        if (cancelado || !lienzo.current || !m.soportaWebGL()) return;
        const e = await m.crearEscena(lienzo.current, { modelo: INSIGNIA.modelo3d });
        if (cancelado) { e.destruir(); return; }
        escena.current = e;
        const a = ACABADOS[fijado.current ?? 0];
        e.acabado(a.marco, a.espalda);
        setListo3d(true);
      } catch (err) {
        console.warn('[SEGY] Experiencia 3D no disponible; se usa el equipo en 2D.', err);
      }
    }, { rootMargin: '400px 0px' });
    obs.observe(seccion.current);
    return () => { cancelado = true; obs.disconnect(); escena.current?.destruir(); escena.current = null; };
  }, [estatica]);

  // Bucle de animación ligado al desplazamiento (solo mientras la sección está visible).
  useEffect(() => {
    if (estatica || !seccion.current) return;
    let actual = 0; let visible = true; let raf = 0; let ultimoCap = -1; let ultimoAcabado = -1; let ultimaPantalla = '';
    const inicio = performance.now();
    const onResize = () => escena.current?.redimensionar();
    window.addEventListener('resize', onResize);
    const obs = new IntersectionObserver((e) => {
      visible = e[0].isIntersecting;
      // Mientras la experiencia ocupa la pantalla, los elementos flotantes se apartan (ver .astro-flotante).
      document.documentElement.toggleAttribute('data-experiencia', visible);
      if (visible) raf = requestAnimationFrame(cuadro);
    }, { rootMargin: '0px 0px -40% 0px' });
    obs.observe(seccion.current);

    function aplicarPoster(pose: Pose) {
      const el = poster.current;
      if (!el) return;
      const px = window.innerHeight / ALTO_VISIBLE;
      const medioAncho = (ALTO_VISIBLE * (window.innerWidth / window.innerHeight)) / 2;
      const x = pose.x * Math.min(1.2, medioAncho * 0.46) * px;
      const y = -pose.y * px;
      el.style.transform = `translate3d(${x}px, ${y}px, 0) rotateX(${pose.rx}rad) rotateZ(${pose.rz}rad) rotateY(${pose.ry}rad) scale(${pose.s})`;
    }

    function cuadro(ahora: number) {
      const sec = seccion.current;
      if (!sec) return;
      const r = sec.getBoundingClientRect();
      const recorrido = Math.max(1, r.height - window.innerHeight);
      const objetivo = Math.min(1, Math.max(0, -r.top / recorrido));
      const dif = objetivo - actual;
      actual = Math.abs(dif) < 0.0004 ? objetivo : actual + dif * 0.11;
      const movil = window.innerWidth < 760;

      for (let i = 0; i < CAPS.length; i++) {
        const v = presencia(actual, i);
        const el = caps.current[i];
        if (el) {
          el.style.opacity = String(v);
          el.style.transform = `translate3d(0, ${(1 - v) * 28}px, 0)`;
          el.style.visibility = v < 0.02 ? 'hidden' : 'visible';
        }
        const f = fondos.current[i];
        if (f) f.style.opacity = String(v);
      }
      if (titular.current) {
        const t = Math.min(1, actual / 0.13);
        titular.current.style.opacity = String(1 - t);
        titular.current.style.transform = `translate3d(0, ${-t * 22}vh, 0) scale(${1 - t * 0.08})`;
      }
      if (progreso.current) progreso.current.style.transform = `scaleX(${actual})`;

      const cap = capituloEn(actual);
      if (cap !== ultimoCap) { ultimoCap = cap; setActivo(cap); }
      // En "Acabados" el color cambia solo con el desplazamiento, salvo que la persona haya elegido uno.
      const idxColores = CAPS.findIndex((c) => c.clave === 'colores');
      let idx = fijado.current ?? 0;
      if (fijado.current === null && idxColores >= 0 && actual >= VENTANAS[idxColores][0] - 0.02) idx = Math.min(ACABADOS.length - 1, Math.floor(avanceEn(actual, idxColores) * ACABADOS.length));
      if (idx !== ultimoAcabado) { ultimoAcabado = idx; setAcabado(idx); escena.current?.acabado(ACABADOS[idx].marco, ACABADOS[idx].espalda); }
      const modo = CAPS[cap].pantalla;
      const tinte = CAPS[cap].clave === 'colores' ? ACABADOS[idx].muestra : null;
      const clavePantalla = `${modo}|${tinte}`;
      if (clavePantalla !== ultimaPantalla || Math.floor(ahora / 1000) % 30 === 0) { ultimaPantalla = clavePantalla; escena.current?.pantalla(modo, tinte); }

      const pose = poseEn(actual, movil ? CLAVES_MOVIL : CLAVES_ESCRITORIO);
      if (escena.current) escena.current.dibujar(pose, (ahora - inicio) / 1000);
      else aplicarPoster(pose);
      if (visible) raf = requestAnimationFrame(cuadro);
    }
    raf = requestAnimationFrame(cuadro);
    return () => { cancelAnimationFrame(raf); obs.disconnect(); window.removeEventListener('resize', onResize); document.documentElement.removeAttribute('data-experiencia'); };
  }, [estatica]);

  const irA = (i: number) => {
    const sec = seccion.current;
    if (!sec) return;
    const top = sec.getBoundingClientRect().top + window.scrollY;
    const recorrido = sec.offsetHeight - window.innerHeight;
    window.scrollTo({ top: top + centroDe(i) * recorrido + (i === 0 ? 0 : 2), behavior: estatica ? 'auto' : 'smooth' });
  };
  const elegirAcabado = (i: number) => { fijado.current = i; setAcabado(i); escena.current?.acabado(ACABADOS[i].marco, ACABADOS[i].espalda); };
  const a = ACABADOS[acabado];

  return (
    <section ref={seccion} className={`exp${estatica ? ' exp--estatica' : ''}${listo3d ? ' exp--3d' : ''}`} style={estatica ? undefined : { height: `${CAPS.length * 100 + 60}vh` }} aria-label={`Conoce el ${INSIGNIA.titular}`}>
      <div className="exp__escenario">
        <div className="exp__fondos" aria-hidden="true">
          {CAPS.map((c, i) => <div key={c.clave} ref={(el) => { fondos.current[i] = el; }} className={`exp__fondo exp__fondo--${c.clave}`} style={{ opacity: i === 0 ? 1 : 0, ...(c.clave === 'colores' ? { ['--tinte' as string]: a.muestra } : {}) }} />)}
        </div>
        <div className="exp__titular" ref={titular} aria-hidden="true">
          {INSIGNIA.titular.split(' ').reduce<string[]>((l, p, i, arr) => { const mitad = Math.ceil(arr.length / 2); if (i < mitad) l[0] = `${l[0] || ''} ${p}`.trim(); else l[1] = `${l[1] || ''} ${p}`.trim(); return l; }, []).map((linea) => <span key={linea}>{linea}</span>)}
        </div>
        <canvas ref={lienzo} className="exp__lienzo" aria-hidden="true" />
        <div className="exp__equipo-2d"><EquipoPoster ref={poster} marco={a.marco} espalda={a.espalda} /></div>
        <div className="exp__progreso" aria-hidden="true"><div ref={progreso} /></div>

        {CAPS.map((c, i) => (
          <article key={c.clave} ref={(el) => { caps.current[i] = el; }} className={`exp__cap exp__cap--${c.lado} exp__cap--${c.clave}`} style={estatica ? undefined : { opacity: i === 0 ? 1 : 0 }} aria-hidden={!estatica && activo !== i}>
            {c.clave === 'apertura' && (
              <div className="exp__apertura">
                <h1 className="sr-only">{INSIGNIA.titular} en SEGY</h1>
                <p className="exp__bajada">{INSIGNIA.bajada}</p>
                <div className="fila">
                  <button type="button" className="boton boton--claro" onClick={() => irA(CAPS.length - 1)} tabIndex={!estatica && activo !== i ? -1 : 0}>Ver precio y cuotas</button>
                  {!estatica && <span className="exp__desliza">Desliza para descubrirlo</span>}
                </div>
              </div>
            )}
            {c.clave !== 'apertura' && c.clave !== 'compra' && (
              <div className="exp__texto">
                <h2 className="titulo-1">{c.titulo}</h2>
                <p className="entrada">{c.texto}</p>
                {c.datos && (
                  <dl className="exp__datos">
                    {c.datos.map((d) => <div key={d.valor}><dt className="display">{d.valor}</dt><dd>{d.detalle}</dd></div>)}
                  </dl>
                )}
                {c.clave === 'colores' && (
                  <>
                    <div className="exp__acabados" role="radiogroup" aria-label="Acabado">
                      {ACABADOS.map((ac, j) => (
                        <button key={ac.nombre} type="button" role="radio" aria-checked={acabado === j} className="exp__muestra" onClick={() => elegirAcabado(j)} tabIndex={!estatica && activo !== i ? -1 : 0}>
                          <i style={{ background: ac.muestra }} /><span>{ac.nombre}</span>
                        </button>
                      ))}
                    </div>
                    <p className="chico secundario">Capacidades: {INSIGNIA.capacidades.join(', ')}.</p>
                  </>
                )}
              </div>
            )}
            {c.clave === 'compra' && <CompraInsignia producto={producto} acabado={a.nombre} oculto={!estatica && activo !== i} />}
            {estatica && c.clave !== 'apertura' && <div className="exp__equipo-estatico"><EquipoPoster marco={a.marco} espalda={a.espalda} /></div>}
          </article>
        ))}

        {!estatica && (
          <nav className="exp__riel" aria-label="Capítulos">
            <ol>
              {CAPS.map((c, i) => (
                <li key={c.clave}>
                  <button type="button" onClick={() => irA(i)} aria-current={activo === i ? 'step' : undefined}>
                    <span className="exp__riel-num">{String(i + 1).padStart(2, '0')}</span><span className="exp__riel-nombre">{c.nombre}</span>
                  </button>
                </li>
              ))}
            </ol>
          </nav>
        )}
      </div>
    </section>
  );
}
