/**
 * ILLUSTRAZIONI  ·  disegni a tratto in SVG.
 * I pittogrammi dei pezzi (#p-costine, #p-pollo, ...) sono definiti nello
 * sprite di index.html: qui si compongono soltanto.
 */

/** Lo spiedo dell'intestazione: asta, pezzi e salvia in ordine di spiedatura. */
export const HERO_SPIEDO = `
<svg viewBox="0 0 340 120" role="img" aria-label="Uno spiedo con costine, coppe e pollo alternati a foglie di salvia">
  <!-- asta e manovella -->
  <line class="asta" x1="14" y1="70" x2="330" y2="70"/>
  <circle class="tratto" cx="10" cy="70" r="7" style="fill:var(--lime);color:var(--inchiostro)"/>
  <!-- pezzi, in ordine: costina, coppa, pollo, coppa, costina.
       Ogni pezzo sta in un gruppo posizionato (translate): la rotazione dell'animazione parte dal centro del pezzo. -->
  <g transform="translate(20 42)"><use class="tratto pezzo" href="#p-costine" width="56" height="56" style="--n:0;color:var(--inchiostro);--pf:var(--lime)"/></g>
  <g transform="translate(74 55)"><use class="tratto pezzo" href="#p-foglia" width="28" height="28" style="--n:1"/></g>
  <g transform="translate(100 42)"><use class="tratto pezzo" href="#p-coppe" width="56" height="56" style="--n:2;--pf:var(--oliva)"/></g>
  <g transform="translate(154 55)"><use class="tratto pezzo" href="#p-foglia" width="28" height="28" style="--n:3"/></g>
  <g transform="translate(180 42)"><use class="tratto pezzo" href="#p-pollo" width="56" height="56" style="--n:4;color:var(--inchiostro);--pf:var(--lime)"/></g>
  <g transform="translate(234 55)"><use class="tratto pezzo" href="#p-foglia" width="28" height="28" style="--n:5"/></g>
  <g transform="translate(260 42)"><use class="tratto pezzo" href="#p-costine" width="56" height="56" style="--n:6;color:var(--inchiostro);--pf:var(--lime)"/></g>
  <!-- freccia: lo spiedo gira -->
  <path class="tratto" d="M236 24c18-12 46-10 62 4"/>
  <path class="tratto" d="M290 21l9 7-12 3"/>
</svg>`;

/** Fiamma per le schermate vuote. */
export const FIAMMA = `
<svg class="illu" viewBox="0 0 120 110" aria-hidden="true">
  <path d="M60 8c3 19 29 31 29 58a29 29 0 0 1-58 0c0-13 5-21 13-27 1 11 5 16 11 18 1-18-7-30 5-49z" style="fill:var(--lime)"/>
  <path d="M60 52c1 9 12 15 12 27a12 12 0 0 1-24 0c0-6 3-9 6-12 1 5 3 7 5 7 0-7-2-12 1-22z" style="fill:var(--carta)"/>
  <path d="M8 100h104"/>
  <path d="M30 100l-4 8M90 100l4 8"/>
</svg>`;

/** Pittogramma di un pezzo a dimensione piena (usato nelle liste). */
export const pittogramma = (id) => `<svg aria-hidden="true"><use href="#p-${id}"/></svg>`;
