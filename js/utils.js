/**
 * UTILS  ·  piccole funzioni di formattazione e arrotondamento.
 * Nessuna dipendenza dal DOM: si possono testare da Node.
 */

export const pad = (n) => String(n).padStart(2, '0');

/** "07:30" da un timestamp in millisecondi. */
export function oraHM(ms) {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "dom 11 ott" */
export function dataBreve(ms) {
  return new Date(ms).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
}

/** "5 h 30", "6 h", "45 min" da minuti. */
export function durataTesto(min) {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${pad(m)}`;
}

/** Cronometro "H:MM:SS" da millisecondi (mai negativo). */
export function cronometro(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}:${pad(m)}:${pad(s % 60)}`;
}

/** Offset rispetto alla partenza: "+1:30" oppure "-0:45". */
export function offsetTesto(min) {
  const segno = min < 0 ? '-' : '+';
  const a = Math.abs(min);
  return `${segno}${Math.floor(a / 60)}:${pad(a % 60)}`;
}

/** Grammi leggibili: "780 g" oppure "1,25 kg". */
export function grammi(g) {
  if (g >= 1000) {
    return `${(g / 1000).toLocaleString('it-IT', { maximumFractionDigits: 2 })} kg`;
  }
  return `${Math.round(g)} g`;
}

/** Numero con virgola italiana. */
export function numIt(n, decimali = 0) {
  return n.toLocaleString('it-IT', { maximumFractionDigits: decimali });
}

export const arrotondaSu = (n, passo) => Math.ceil(n / passo - 1e-9) * passo;
export const arrotonda = (n, passo) => Math.round(n / passo) * passo;

/** Valore per <input type="datetime-local"> in ora locale. */
export function perDatetimeLocal(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Da valore datetime-local a millisecondi (ora locale). null se vuoto o non valido. */
export function daDatetimeLocal(valore) {
  if (!valore) return null;
  const t = new Date(valore).getTime();
  return Number.isNaN(t) ? null : t;
}

/** Valore per <input type="time">. */
export function perTime(ms) {
  return oraHM(ms);
}

/** Limita n tra min e max. */
export const limita = (n, min, max) => Math.min(max, Math.max(min, n));
