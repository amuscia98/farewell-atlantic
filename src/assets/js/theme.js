// ---------------------------------------------------------------------------
// Interruttore chiaro / notturno.
// Senza scelta esplicita si segue il sistema (prefers-color-scheme).
// ---------------------------------------------------------------------------

const CHIAVE = 'farewell-atlantic:tema';

function salvato() {
  try {
    const v = localStorage.getItem(CHIAVE);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null;
  }
}

function applica(tema) {
  if (tema) document.documentElement.dataset.theme = tema;
  else delete document.documentElement.dataset.theme;
}

function effettivo() {
  const scelto = document.documentElement.dataset.theme;
  if (scelto === 'light' || scelto === 'dark') return scelto;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function initTheme(bottone) {
  applica(salvato());

  if (!bottone) return;

  const aggiorna = () => {
    const prossimo = effettivo() === 'dark' ? 'light' : 'dark';
    // Icona e testo separati: sui telefoni, nelle pagine dei giorni, il testo
    // si nasconde e resta solo l'icona (vedi .theme-toggle__testo in base.css).
    const icona = document.createElement('span');
    icona.setAttribute('aria-hidden', 'true');
    icona.textContent = prossimo === 'light' ? '☀' : '☾';
    const testo = document.createElement('span');
    testo.className = 'theme-toggle__testo';
    testo.textContent = prossimo === 'light' ? 'Tema chiaro' : 'Tema notturno';
    bottone.replaceChildren(icona, testo);
    const azione = `Passa al ${prossimo === 'light' ? 'tema chiaro' : 'tema notturno'}`;
    bottone.setAttribute('aria-label', azione);
    bottone.title = azione;
  };

  bottone.hidden = false;
  aggiorna();

  bottone.addEventListener('click', () => {
    const prossimo = effettivo() === 'dark' ? 'light' : 'dark';
    applica(prossimo);
    try {
      localStorage.setItem(CHIAVE, prossimo);
    } catch {
      /* niente da fare: il tema vale solo per questa visita */
    }
    aggiorna();
  });

  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', aggiorna);
}
