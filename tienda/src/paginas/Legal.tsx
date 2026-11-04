import { useNegocio } from '../lib/negocio';
import { useRuta, Enlace } from '../lib/ruta';
import { usePagina } from '../lib/seo';
import { documentos } from '../contenido/legal';
import { NoEncontrada } from './NoEncontrada';

export function Legal() {
  const { partes } = useRuta();
  const { datos } = useNegocio();
  const docs = documentos(datos?.negocio ?? null);
  const doc = docs[partes[1] || ''];
  usePagina(doc ? doc.titulo : null, doc?.resumen);
  if (!doc) return <NoEncontrada />;
  return (
    <div className="contenedor">
      <article className="legal">
        <h1 className="titulo-2">{doc.titulo}</h1>
        <p className="entrada">{doc.resumen}</p>
        {doc.secciones.map((s) => (
          <section key={s.titulo}><h2>{s.titulo}</h2>{s.parrafos.map((p) => <p key={p.slice(0, 40)}>{p}</p>)}</section>
        ))}
        <p style={{ marginTop: 40 }} className="chico terciario">Otros documentos: {Object.entries(docs).filter(([k]) => k !== partes[1]).map(([k, d], i, arr) => <span key={k}><Enlace a={`/legal/${k}`} className="enlace">{d.titulo}</Enlace>{i < arr.length - 1 ? ', ' : ''}</span>)}</p>
      </article>
    </div>
  );
}
