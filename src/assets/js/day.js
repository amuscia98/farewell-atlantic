// ---------------------------------------------------------------------------
// Pagina di un giorno: indovinello, decifratura, contenuto.
// ---------------------------------------------------------------------------

import { initTheme } from './theme.js';
import { openDay, RispostaSbagliata } from './crypto.js';
import { normalizeAnswer } from './normalize.js';
import { rispostaSalvata, ricorda } from './store.js';
import { giornoBloccato, dataApertura } from './datelock.js';

const config = window.AVVENTO ?? {};
const day = Number(config.day);

initTheme(document.getElementById('theme-toggle'));

const gate = document.getElementById('gate');
const form = document.getElementById('gate-form');
const input = document.getElementById('answer');
const bottone = document.getElementById('gate-submit');
const messaggio = document.getElementById('gate-msg');
const reveal = document.getElementById('reveal');

const motoRidotto = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// La busta cifrata si scarica subito: quando il visitatore ha finito di
// leggere l'indovinello è già in memoria.
const bustaPromise = fetch(config.dataUrl, { cache: 'no-cache' }).then((r) => {
  if (!r.ok) throw new Error(`non riesco a leggere ${config.dataUrl} (HTTP ${r.status})`);
  return r.json();
});
bustaPromise.catch(() => { /* gestito al momento dell'apertura */ });

// --- Resa del contenuto ----------------------------------------------------

function iframeEmbed(embed) {
  const src =
    embed.provider === 'vimeo'
      ? `https://player.vimeo.com/video/${embed.id}`
      : `https://www.youtube-nocookie.com/embed/${embed.id}?rel=0`;

  const wrapper = document.createElement('div');
  wrapper.className = 'embed';

  const frame = document.createElement('iframe');
  frame.src = src;
  frame.loading = 'lazy';
  frame.title = embed.titolo || 'Video';
  frame.allow = 'accelerometer; clipboard-write; encrypted-media; picture-in-picture; fullscreen';
  frame.setAttribute('allowfullscreen', '');
  frame.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');

  wrapper.append(frame);
  return wrapper;
}

function mostra(contenuto) {
  reveal.replaceChildren();

  if (contenuto.titolo) {
    const h = document.createElement('h2');
    h.className = 'reveal__title';
    h.textContent = contenuto.titolo;
    reveal.append(h);
  }

  const corpo = document.createElement('div');
  corpo.className = 'reveal__body';
  // Il contenuto arriva dalla cartella content/ di chi costruisce il sito,
  // non da estranei: l'HTML è quello generato dalla build dal Markdown.
  corpo.innerHTML = contenuto.html ?? '';
  for (const embed of contenuto.embeds ?? []) corpo.append(iframeEmbed(embed));
  reveal.append(corpo);

  const nav = document.createElement('p');
  nav.className = 'reveal__next';
  nav.innerHTML = config.navHtml ?? '';
  reveal.append(nav);

  reveal.hidden = false;
  document.title = contenuto.titolo
    ? `${contenuto.titolo} — ${config.siteTitle}`
    : document.title;
}

function nascondiGate(conAnimazione) {
  if (!conAnimazione || motoRidotto) {
    gate.hidden = true;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    let fatto = false;
    const fine = () => {
      if (fatto) return;
      fatto = true;
      gate.hidden = true;
      resolve();
    };
    gate.addEventListener('animationend', fine, { once: true });
    setTimeout(fine, 500);
    gate.classList.add('is-leaving');
  });
}

async function apri(risposta, { animazione = true, salva = true } = {}) {
  const busta = await bustaPromise;
  const contenuto = await openDay(busta, risposta);

  if (salva) {
    ricorda(day, normalizeAnswer(risposta));
    try {
      sessionStorage.setItem('farewell-atlantic:appena-aperto', String(day));
    } catch {
      /* niente guizzo sulla home, nulla di grave */
    }
  }

  await nascondiGate(animazione);
  mostra(contenuto);
}

// --- Blocco per data -------------------------------------------------------

const salvata = rispostaSalvata(day);

if (!salvata && giornoBloccato(day, config.dateLock)) {
  form.hidden = true;
  const nota = document.createElement('p');
  nota.className = 'locked-note';
  nota.textContent = `Questa casella si apre il ${dataApertura(day, config.dateLock)}. Torna a trovarmi.`;
  gate.append(nota);
} else if (salvata) {
  // Già risolto in passato: si apre da sé.
  apri(salvata, { animazione: false, salva: false }).catch(() => {
    // La risposta memorizzata non va più bene (contenuto rigenerato con
    // un'altra risposta): si torna a chiedere l'indovinello.
    gate.hidden = false;
  });
}

// --- Invio della risposta --------------------------------------------------

form?.addEventListener('submit', async (evento) => {
  evento.preventDefault();

  const risposta = input.value;
  if (!normalizeAnswer(risposta)) {
    messaggio.textContent = 'Scrivi la tua risposta qui sopra.';
    messaggio.classList.add('is-error');
    input.focus();
    return;
  }

  bottone.disabled = true;
  messaggio.classList.remove('is-error');
  messaggio.textContent = 'Apro…';

  try {
    await apri(risposta);
  } catch (errore) {
    bottone.disabled = false;
    messaggio.classList.add('is-error');

    if (errore instanceof RispostaSbagliata) {
      messaggio.textContent = 'Non è questa. Riprova — il suggerimento è qui sotto.';
      gate.classList.remove('is-wrong');
      void gate.offsetWidth; // riavvia l'animazione
      gate.classList.add('is-wrong');
      input.select();
    } else {
      messaggio.textContent = `Qualcosa non va: ${errore.message}`;
    }
  }
});
