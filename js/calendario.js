/**
 * CALENDARIO  ·  genera un file .ics con i promemoria.
 * Funziona su iPhone e Android senza server né account: il file si apre
 * e il telefono propone di aggiungere gli eventi al calendario.
 * Nessun file viene creato finché l'utente non conferma.
 */
import { TAG } from './ricetta.js';

/** Quanti eventi produrrebbe ogni categoria (per mostrare i conteggi prima di confermare). */
export function contaPerCategoria(eventi) {
  const conteggi = {};
  for (const e of eventi) conteggi[e.cat] = (conteggi[e.cat] ?? 0) + 1;
  return conteggi;
}

/** Eventi da esportare in base alle categorie scelte. */
export function eventiSelezionati(eventi, categorie) {
  return eventi.filter((e) => categorie[e.cat]);
}

/* ---- formattazione secondo RFC 5545 ---- */

const p2 = (n) => String(n).padStart(2, '0');

function dataUTC(ms) {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}${p2(d.getUTCMonth() + 1)}${p2(d.getUTCDate())}T${p2(d.getUTCHours())}${p2(d.getUTCMinutes())}${p2(d.getUTCSeconds())}Z`;
}

function escapa(testo) {
  return String(testo).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Righe oltre 75 byte vanno spezzate: la continuazione inizia con uno spazio. */
function piega(riga) {
  const enc = new TextEncoder();
  const out = [];
  let corrente = '';
  let byte = 0;
  for (const ch of riga) {
    const b = enc.encode(ch).length;
    if (byte + b > 73) {
      out.push(corrente);
      corrente = ' ';
      byte = 1;
    }
    corrente += ch;
    byte += b;
  }
  out.push(corrente);
  return out.join('\r\n');
}

/**
 * Crea il testo del file .ics.
 * @param {object} p
 * @param {Array}  p.eventi        eventi già filtrati (vedi eventiSelezionati)
 * @param {number} p.avvio         timestamp di partenza
 * @param {number} p.preavvisoMin  minuti di preavviso dell'allarme (0 = al momento esatto)
 * @param {string} p.riepilogo     riga finale nella descrizione, es. "12 persone · Brace"
 */
export function generaICS({ eventi, avvio, preavvisoMin, riepilogo }) {
  const adesso = dataUTC(Date.now());
  const righe = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//spiEDO//Spiedo alla bresciana//IT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:spiEDO',
  ];

  for (const e of eventi) {
    const inizio = avvio + e.min * 60000;
    const fine = inizio + e.durataMin * 60000;
    const etichetta = TAG[e.tag]?.etichetta ?? '';
    const numero = e.totale > 1 ? ` (${e.numero}/${e.totale})` : '';
    const titolo = `spiEDO · ${e.titolo}${numero}`;
    righe.push(
      'BEGIN:VEVENT',
      `UID:${e.id}-${avvio}@spiedo.app`,
      `DTSTAMP:${adesso}`,
      `DTSTART:${dataUTC(inizio)}`,
      `DTEND:${dataUTC(fine)}`,
      `SUMMARY:${escapa(titolo)}`,
      `DESCRIPTION:${escapa(`${etichetta}\n${e.testo}\n\n${riepilogo}`)}`,
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapa(titolo)}`,
      preavvisoMin > 0 ? `TRIGGER:-PT${preavvisoMin}M` : 'TRIGGER:PT0S',
      'END:VALARM',
      'END:VEVENT'
    );
  }

  righe.push('END:VCALENDAR');
  return righe.map(piega).join('\r\n') + '\r\n';
}

/**
 * Consegna il file all'utente. Su telefono prova il foglio di condivisione
 * (da cui si sceglie "Calendario"); altrimenti scarica il file.
 * @returns {Promise<'condiviso'|'scaricato'|'annullato'>}
 */
export async function consegnaICS(testoICS, nomeFile) {
  const file = new File([testoICS], nomeFile, { type: 'text/calendar' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'spiEDO' });
      return 'condiviso';
    } catch (err) {
      if (err && err.name === 'AbortError') return 'annullato';
      // altro errore: si ripiega sul download
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeFile;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return 'scaricato';
}
