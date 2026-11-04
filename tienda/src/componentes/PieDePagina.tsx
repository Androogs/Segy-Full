// Pie de página: enlaces del catálogo, servicios, ayuda y legales, y los datos del negocio que se editan en el panel.
import { useNegocio } from '../lib/negocio';
import { Enlace } from '../lib/ruta';
import { enlaceWhatsApp } from '../lib/whatsapp';

export function PieDePagina() {
  const { datos } = useNegocio();
  const n = datos?.negocio;
  const grupos = datos?.grupos.filter((g) => g.total > 0) ?? [];
  const redes = n ? Object.entries(n.redes).filter(([, url]) => !!url) : [];
  const panel = import.meta.env.VITE_PANEL_URL;
  const anio = new Date().getFullYear();
  return (
    <footer className="pie">
      <div className="contenedor">
        <div className="pie__arriba">
          <div className="pie__marca">
            <img src="/marca/logo-segy.webp" alt="SEGY" width="64" height="64" />
            <p>Celulares, accesorios y servicio técnico{n?.ciudad ? ` en ${n.ciudad}` : ''}. Crédito a cuotas y retoma de tu celular.</p>
          </div>
          <div>
            <h2>Comprar</h2>
            <ul>{grupos.map((g) => <li key={g.clave}><Enlace a={`/catalogo/${g.clave}`}>{g.nombre}</Enlace></li>)}<li><Enlace a="/catalogo?ofertas=1">Ofertas</Enlace></li></ul>
          </div>
          <div>
            <h2>Servicios</h2>
            <ul><li><Enlace a="/retoma">Retoma de tu celular</Enlace></li><li><Enlace a="/credito">Crédito SEGY</Enlace></li><li><Enlace a="/servicio-tecnico">Servicio técnico</Enlace></li></ul>
          </div>
          <div>
            <h2>Ayuda</h2>
            <ul>
              <li><Enlace a="/tienda">Visítanos</Enlace></li>
              {n?.whatsapp && <li><a href={enlaceWhatsApp(n.whatsapp, 'Hola SEGY, necesito ayuda con una compra.')} target="_blank" rel="noopener">WhatsApp</a></li>}
              <li><Enlace a="/legal/envios">Envíos y devoluciones</Enlace></li>
              <li><Enlace a="/legal/garantia">Garantía</Enlace></li>
            </ul>
          </div>
          <div>
            <h2>Legal</h2>
            <ul><li><Enlace a="/legal/terminos">Términos y condiciones</Enlace></li><li><Enlace a="/legal/privacidad">Tratamiento de datos</Enlace></li></ul>
            {redes.length > 0 && <><h2 style={{ marginTop: 24 }}>Síguenos</h2><ul>{redes.map(([red, url]) => <li key={red}><a href={url} target="_blank" rel="noopener">{red === 'tiktok' ? 'TikTok' : red[0].toUpperCase() + red.slice(1)}</a></li>)}</ul></>}
          </div>
        </div>
        <div className="pie__abajo">
          <span>© {anio} {n?.nombre || 'SEGY'}{n?.nit ? `, NIT ${n.nit}` : ''}{n?.direccion ? `. ${n.direccion}${n.ciudad ? `, ${n.ciudad}` : ''}` : ''}</span>
          {panel && <a href={panel}>Acceso del equipo</a>}
        </div>
      </div>
    </footer>
  );
}
