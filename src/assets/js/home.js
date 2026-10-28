// ---------------------------------------------------------------------------
// Home: stato delle 25 caselle.
// La griglia è già nell'HTML generato dalla build; qui si aggiunge solo lo
// stato che dipende dal visitatore (giorni aperti) e dalla data.
// ---------------------------------------------------------------------------

import { initTheme } from './theme.js';
import { giorniAperti, dimenticaTutto } from './store.js';
import { giornoBloccato, dataApertura } from './datelock.js';

const config = window.AVVENTO ?? {};

initTheme(document.getElementById('theme-toggle'));

const aperti = new Set(giorniAperti());
const caselle = Array.from(document.querySelectorAll('[data-day]'));

// Casella appena sbloccata: la segnaliamo con un guizzo al ritorno dalla
// pagina del giorno.
let appenaAperto = null;
try {
  appenaAperto = Number(sessionStorage.getItem('farewell-atlantic:appena-aperto')) || null;
  sessionStorage.removeItem('farewell-atlantic:appena-aperto');
} catch {
  /* sessionStorage non disponibile: pazienza */
}

for (const casella of caselle) {
  const day = Number(casella.dataset.day);
  const etichetta = casella.querySelector('.tile__label');
  const sigillo = casella.querySelector('.tile__seal');

  if (aperti.has(day)) {
    casella.classList.add('is-open');
    if (etichetta) etichetta.textContent = 'aperta';
    if (sigillo) sigillo.textContent = '✦';
    if (day === appenaAperto) casella.classList.add('just-opened');
    continue;
  }

  if (giornoBloccato(day, config.dateLock)) {
    casella.classList.add('is-locked');
    casella.setAttribute('aria-disabled', 'true');
    casella.title = `Si apre il ${dataApertura(day, config.dateLock)}`;
    if (etichetta) etichetta.textContent = 'non ancora';
    if (sigillo) sigillo.textContent = '·';
    casella.addEventListener('click', (evento) => evento.preventDefault());
  }
}

// --- Riga di progresso -----------------------------------------------------

const progresso = document.getElementById('progress');
if (progresso) {
  const totale = caselle.length;
  const n = aperti.size;

  let testo;
  if (n === 0) testo = `Nessuna casella aperta, per ora. ${totale} ti aspettano.`;
  else if (n === totale) testo = `Tutte e ${totale} le caselle sono aperte. Grazie di essere arrivato fino in fondo.`;
  else testo = `${n} ${n === 1 ? 'casella aperta' : 'caselle aperte'} su ${totale}.`;

  progresso.textContent = testo;

  if (n > 0) {
    const azzera = document.createElement('button');
    azzera.type = 'button';
    azzera.textContent = 'ricomincia da zero';
    azzera.addEventListener('click', () => {
      dimenticaTutto();
      window.location.reload();
    });
    progresso.append(' ', azzera);
  }
}
