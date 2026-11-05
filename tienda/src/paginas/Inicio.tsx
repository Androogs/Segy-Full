// Inicio: la experiencia del producto insignia y, debajo, la tienda organizada como un distribuidor de tecnología
// (categorías, disponibles hoy, servicios de retoma y crédito, accesorios compatibles, usados certificados y la tienda física).
import { Experiencia } from '../experiencia/Experiencia';
import { useNegocio } from '../lib/negocio';
import { usePagina } from '../lib/seo';
import { Enlace } from '../lib/ruta';
import { cuotaDesde, pesos, plural } from '../lib/formato';
import { TarjetaProducto, RejillaCargando } from '../componentes/TarjetaProducto';
import { VisualProducto } from '../componentes/VisualProducto';
import { Icono } from '../componentes/Icono';
import { ErrorCarga } from '../componentes/Estados';
import { GRADOS } from '../contenido/servicios';
import type { Grupo } from '../lib/tipos';

const MUESTRA: Record<Grupo, { nombre: string; categoria: string; color: string }> = {
  celulares: { nombre: 'Celular', categoria: 'Celulares nuevos', color: 'Azul' },
  usados: { nombre: 'Celular usado', categoria: 'Celulares usados', color: 'Titanio' },
  accesorios: { nombre: 'Audífonos', categoria: 'Audífonos', color: 'Blanco' },
  repuestos: { nombre: 'Pantalla', categoria: 'Repuestos', color: 'Negro' },
};

export function Inicio() {
  const { datos, error, reintentar } = useNegocio();
  usePagina('');
  const insignia = datos?.insignia ?? null;
  const credito = datos?.tienda.credito;
  const cuota = insignia && credito?.activo ? cuotaDesde(insignia.precio, credito.planes, credito.cuota_inicial_min_pct) : null;
  const grupos = datos?.grupos.filter((g) => g.total > 0) ?? [];
  const n = datos?.negocio;

  return (
    <>
      <Experiencia producto={insignia} />

      {error && !datos && <ErrorCarga mensaje={error} reintentar={reintentar} />}

      <section className="seccion contenedor" aria-labelledby="t-categorias">
        <div className="seccion__cab">
          <div><h2 id="t-categorias" className="titulo-2">Compra por categoría</h2><p className="entrada">Equipos nuevos, usados revisados punto por punto y todo lo que necesitas para cuidarlos.</p></div>
        </div>
        {datos ? (
          <div className="categorias">
            {grupos.map((g) => (
              <Enlace key={g.clave} a={`/catalogo/${g.clave}`} className="categoria">
                <div><h3>{g.nombre}</h3><p>{g.descripcion}</p></div>
                <VisualProducto producto={{ nombre: MUESTRA[g.clave].nombre, grupo: g.clave, categoria: { id: 0, nombre: MUESTRA[g.clave].categoria }, color: MUESTRA[g.clave].color }} foto={g.foto} />
                <div className="categoria__pie"><span>{plural(g.total, 'producto', 'productos')}</span><span className="categoria__flecha"><Icono nombre="derecha" /></span></div>
              </Enlace>
            ))}
          </div>
        ) : <div className="categorias">{[0, 1, 2, 3].map((i) => <div key={i} className="categoria esqueleto" />)}</div>}
      </section>

      <section className="seccion contenedor" aria-labelledby="t-disponibles">
        <div className="seccion__cab">
          <div><h2 id="t-disponibles" className="titulo-2">Disponible hoy{n?.ciudad ? ` en ${n.ciudad.split(',')[0]}` : ''}</h2><p className="entrada">Precios y existencias reales de nuestra tienda, actualizados durante el día.</p></div>
          <Enlace a="/catalogo" className="boton boton--contorno">Ver todo el catálogo</Enlace>
        </div>
        {datos ? <div className="rejilla-productos">{datos.destacados.map((p) => <TarjetaProducto key={p.id} producto={p} />)}</div> : <RejillaCargando />}
      </section>

      <section className="seccion contenedor" aria-label="Retoma y crédito">
        <div className="servicios">
          <article className="servicio servicio--retoma">
            <h2 className="titulo-2">Tu celular vale como parte de pago</h2>
            <p className="entrada">Lo revisamos en la tienda (pantalla, batería, funcionamiento, estado físico y seguridad) y te damos una oferta clara para tu próximo equipo.</p>
            <div className="fila"><Enlace a="/retoma" className="boton boton--claro">Cotizar mi celular</Enlace></div>
            <img className="servicio__astro" src="/marca/astro.webp" alt="" loading="lazy" />
          </article>
          <article className="servicio">
            <h2 className="titulo-2">Estrénalo a cuotas</h2>
            {cuota && insignia ? (
              <>
                <p className="entrada">{insignia.nombre} con crédito SEGY desde</p>
                <div className="servicio__cuota"><span className="precio">{pesos(cuota.cuota)}</span><span className="secundario">al mes, {cuota.cuotas} cuotas</span></div>
                <p className="chico terciario">Con cuota inicial de {pesos(cuota.inicial)}. Simulación referencial: el plan final lo aprueba SEGY.</p>
              </>
            ) : <p className="entrada">Crédito directo de la tienda, sin trámites eternos. Elige el plan de cuotas que te sirva.</p>}
            <div className="fila"><Enlace a={`/credito${insignia ? `?producto=${insignia.id}` : ''}`} className="boton boton--claro">Simular mi crédito</Enlace></div>
          </article>
        </div>
      </section>

      {insignia && insignia.compatibles.length > 0 && (
        <section className="seccion contenedor" aria-labelledby="t-compatibles">
          <div className="seccion__cab">
            <div><h2 id="t-compatibles" className="titulo-2">Protégelo desde el primer día</h2><p className="entrada">Accesorios compatibles con tu {insignia.nombre.replace(/\s*\d+\s*(GB|TB)\b/i, '')}.</p></div>
            <Enlace a="/catalogo/accesorios" className="boton boton--contorno">Todos los accesorios</Enlace>
          </div>
          <div className="carril">{insignia.compatibles.map((p) => <TarjetaProducto key={p.id} producto={p} />)}</div>
        </section>
      )}

      <section className="seccion contenedor" aria-labelledby="t-usados">
        <div className="usados">
          <div className="pila">
            <h2 id="t-usados" className="titulo-2">Usados certificados</h2>
            <p className="entrada">Cada equipo pasa la misma inspección que hacemos en la retoma y se clasifica por grado.</p>
            <div className="grados">{GRADOS.map((g) => <div key={g.letra} className="grado"><b>{g.letra}</b><h3>{g.nombre}</h3><p>{g.texto}</p></div>)}</div>
          </div>
          <div>
            {datos && datos.usados.length > 0 ? (
              <div className="rejilla-productos" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>{datos.usados.map((p) => <TarjetaProducto key={p.id} producto={p} />)}</div>
            ) : (
              <div className="aviso">Hoy no hay usados publicados. Llegan seguido: <Enlace a="/catalogo/usados" className="enlace">revisa el catálogo</Enlace> o pídenos que te avisemos por WhatsApp.</div>
            )}
          </div>
        </div>
      </section>

      <section className="seccion contenedor" aria-labelledby="t-visita">
        <div className="franja">
          <div className="pila">
            <h2 id="t-visita" className="titulo-2">Ven, pruébalo y llévatelo</h2>
            <p className="entrada">Te mostramos el equipo, pasamos tus datos y lo configuramos contigo. También reparamos pantallas, baterías y pines de carga.</p>
            <div className="fila"><Enlace a="/tienda" className="boton boton--claro"><Icono nombre="ubicacion" />Cómo llegar</Enlace><Enlace a="/servicio-tecnico" className="boton boton--contorno"><Icono nombre="herramienta" />Servicio técnico</Enlace></div>
          </div>
          {n && (
            <dl>
              {n.direccion && <div><dt>Dirección</dt><dd>{n.direccion}{n.ciudad ? `, ${n.ciudad}` : ''}</dd></div>}
              <div><dt>Horario</dt><dd>{n.horario || 'Escríbenos para confirmar el horario de hoy'}</dd></div>
              {n.telefono && <div><dt>Teléfono y WhatsApp</dt><dd>{n.telefono}</dd></div>}
            </dl>
          )}
        </div>
      </section>
    </>
  );
}
