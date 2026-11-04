// Simulador de crédito SEGY con la misma fórmula del módulo Créditos del panel. Los planes y la cuota inicial mínima
// se configuran en el panel (Tienda web › Ajustes).
import { useEffect, useState } from 'react';
import { pesos, simular } from '../lib/formato';
import type { Credito } from '../lib/tipos';

export function SimuladorCuotas({ precio, credito, titulo = 'Calcula tus cuotas', alCambiar }: { precio: number; credito: Credito; titulo?: string; alCambiar?: (cuotas: number) => void }) {
  const planes = [...credito.planes].sort((a, b) => a.cuotas - b.cuotas);
  const [plan, setPlan] = useState(planes[planes.length - 1]?.cuotas ?? 1);
  const [inicialPct, setInicialPct] = useState(credito.cuota_inicial_min_pct);
  useEffect(() => { alCambiar?.(plan); }, [plan, alCambiar]);
  const elegido = planes.find((p) => p.cuotas === plan) || planes[0];
  if (!elegido || precio <= 0) return null;
  const s = simular(precio, elegido, inicialPct);
  return (
    <div className="simulador">
      <div className="fila" style={{ justifyContent: 'space-between' }}>
        <h3 className="titulo-3">{titulo}</h3>
        <span className="chico terciario">Simulación referencial</span>
      </div>
      <div className="simulador__planes" role="radiogroup" aria-label="Número de cuotas">
        {planes.map((p) => (
          <button key={p.cuotas} type="button" role="radio" aria-checked={p.cuotas === plan} className={`ficha${p.cuotas === plan ? ' activa' : ''}`} onClick={() => setPlan(p.cuotas)}>{p.cuotas} cuotas</button>
        ))}
      </div>
      <label className="campo">
        <span>Cuota inicial: {inicialPct} % ({pesos(s.inicial)})</span>
        <input type="range" min={credito.cuota_inicial_min_pct} max={80} step={5} value={inicialPct} onChange={(e) => setInicialPct(Number(e.target.value))} />
      </label>
      <div className="simulador__cuota"><span className="precio">{pesos(s.cuota)}</span><span className="secundario">al mes, {s.cuotas} cuotas</span></div>
      <dl className="simulador__resultado">
        <dt>Valor del producto</dt><dd>{pesos(precio)}</dd>
        <dt>Cuota inicial</dt><dd>{pesos(s.inicial)}</dd>
        <dt>Saldo a financiar</dt><dd>{pesos(precio - s.inicial)}</dd>
        {s.interes_pct > 0 && <><dt>Interés del plan</dt><dd>{s.interes_pct} %</dd></>}
        <dt>Total financiado</dt><dd>{pesos(s.financiado)}</dd>
      </dl>
      <p className="chico terciario">{s.interes_pct > 0 ? 'El plan final lo aprueba SEGY con tu estudio de crédito.' : 'Valor sin intereses. Un asesor te confirma la tasa y el plan aprobado con tu estudio de crédito.'}</p>
    </div>
  );
}
