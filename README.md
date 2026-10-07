# spiEDO

Calcolatore e timer per lo spiedo alla bresciana. Web app installabile (PWA) per Android e iPhone:
nessun server, nessun account, nessuna scadenza. Si ospita gratis su GitHub Pages.

Versione di prova 0.1 · ricetta di partenza: Valle Sabbia (da tarare con la tua esperienza).

## Struttura

| File | Cosa contiene |
|---|---|
| `js/ricetta.js` | **Tutta la ricetta**: dosi per persona, tempi, temperature, testi. È il file da modificare. |
| `js/calcoli.js` | Calcolo di dosi e timeline (nessun testo di ricetta qui dentro). |
| `js/calendario.js` | Creazione del file `.ics` per i promemoria. |
| `js/app.js` | Interfaccia: schermate Imposta, Dosi, Cottura. |
| `js/stato.js` | Cosa l'app ricorda sul telefono (localStorage). |
| `js/utils.js`, `js/illustrazioni.js` | Formattazione e disegni. |
| `css/style.css` | Stile. Colori, spaziature e raggi sono variabili in cima al file. |
| `sw.js`, `manifest.webmanifest` | Funzionamento offline e installazione. |
| `test/logica.test.js` | Test di dosi, timeline, calendario e pacchetto. |
| `tools/og.html` | Sorgente dell'immagine di anteprima (`icons/og.png`). |
| `.github/workflows/` | Test e pubblicazione automatica. |

## Modificare la ricetta

Apri `js/ricetta.js`. È commentato in ogni sezione.

- **Dosi**: i pezzi di riferimento sono in `INGREDIENTI.carni[...].pezziBase` (quelli della tua nota, spiedo piccolo). Lo spiedo di riferimento (15 persone, 6 raspe da 65 cm, 350 g di burro, 190 g di sale) è in `GENERALI.riferimento`, le patate (3 kg) in `INGREDIENTI.patate`. Con più o meno persone l'app scala in proporzione.
- **Quanto posto occupa una presa** (`CM_PER_PRESA`): non si imposta, si ricava dallo spiedo di riferimento, che era pieno (120 prese su 6 x 65 cm = 3,25 cm). Con un altro spiedo l'app dice se ci sta e fino a quante persone regge.
- **Pesi dei pezzi** (`grammiPezzo`): sono stime, non sono nei tuoi appunti. Servono solo ai totali in grammi.
- **Durata e fasi**: costanti in cima alla sezione 3 (`DURATA_ELETTRICO_MIN` = 4 h 30 dagli appunti, `DURATA_BRACE_MIN` per brace e fuoco, `ASCIUGA_PRIMA_MIN`...). Gli orari "dal via" si stirano in proporzione alla durata (funzione `tempi`). Gli appunti sono la fonte, le **ASSUNZIONI** sono segnate nei commenti.
- **Azioni**: le `azioni` di ogni modalità. Ogni azione ha `quando` (`inizio`, `fine` o `frazione`) oppure `ripeti` (con `salta` per le finestre senza burro attorno alle salature).
- **Temperature**: il `profilo` di ogni modalità. Per l'elettrico sono gradi (dagli appunti), per brace e fuoco una descrizione.
- **Testi**: i segnaposto `{burro}`, `{saleTotale}`, `{saleMeta}` vengono sostituiti con le quantità calcolate.

Dopo ogni modifica esegui i test: `npm test`.

## Pubblicare su GitHub Pages (gratis, senza manutenzione)

La pubblicazione è automatica: a ogni modifica su `main` GitHub lancia i test e, se passano, aggiorna il sito.

1. Crea un repository pubblico su GitHub, per esempio `spiedo`, e carica tutti i file di questa cartella (anche `.github`).
2. Su GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions** (non "Deploy from a branch").
3. Fai un commit su `main` oppure, da **Actions**, lancia a mano "Test e pubblicazione".
4. Dopo circa un minuto l'app è su `https://TUO-NOME.github.io/spiedo/`. Quello è il link da mandare agli amici.

Cosa fa il workflow (`.github/workflows/pubblica.yml`): esegue `npm test`, copia nel sito solo i file dell'app e scrive l'indirizzo vero al posto di `__BASE_URL__` nelle anteprime di condivisione. Non serve toccare niente a mano.

**Se il repository si chiama `TUO-NOME.github.io`** l'indirizzo del sito è `https://TUO-NOME.github.io/` senza il nome del repository: in quel caso correggi la riga `BASE=` nel workflow.

## Anteprima quando condividi il link

WhatsApp, Telegram e iMessage mostrano `icons/og.png` (1200 x 630). Per cambiarla modifica `tools/og.html`, aprila in un browser a 1200 x 630 e salva lo screenshot come `icons/og.png`. Le anteprime vengono salvate dalle app di messaggistica: dopo una modifica possono volerci ore prima che il link mostri quella nuova.

## Movimento

Il hero e la spunta "fatto" hanno piccole animazioni (`css/style.css`, sezione "Movimento"). Si spengono da sole se il telefono ha "Riduci movimento" attivo.

## Installare sul telefono

- **Android (Chrome)**: compare il pulsante "Installa spiEDO" nella schermata Imposta, oppure menu ⋮ → Installa app.
- **iPhone (Safari)**: Condividi → Aggiungi a Home. Va aperta da quell'icona (non da Safari) durante la cottura.

## Limiti da conoscere

- **Notifiche a telefono bloccato**: una web app non può programmarle in modo affidabile (soprattutto su iPhone).
  Per questo ci sono i promemoria in calendario: sono nativi e suonano sempre.
  Con l'app aperta, lo schermo resta acceso e suona un allarme a ogni passaggio.
- **Calendario su iPhone**: il file `.ics` si condivide dal foglio di condivisione (scegli *Calendario*).
  Va provato sul tuo iPhone: è la parte che varia di più tra versioni di iOS.
- I dati (cottura in corso, impostazioni) restano sul telefono: ogni amico ha i suoi.
