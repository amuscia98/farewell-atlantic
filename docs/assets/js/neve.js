// ---------------------------------------------------------------------------
// Neve leggera dietro al contenuto.
//
// Un canvas fisso, sotto a tutto (z-index -1) e trasparente ai clic: i fiocchi
// si vedono nel fondo e fra le caselle, mai sopra al testo. Pochi fiocchi,
// disegnati come cerchietti: costa pochissimo anche sui telefoni, e il browser
// la mette in pausa da solo quando la scheda non è visibile.
//
// Chi ha chiesto al sistema di ridurre le animazioni non la vede affatto.
// Il colore dei fiocchi è la variabile --snow di theme.css (cambia col tema).
// ---------------------------------------------------------------------------

const MAX_FIOCCHI = 70;
const MIN_FIOCCHI = 18;
const AREA_PER_FIOCCO = 16000; // px² di schermo per ogni fiocco

export function avviaNeve() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const canvas = document.createElement('canvas');
  canvas.className = 'neve';
  canvas.setAttribute('aria-hidden', 'true');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  document.body.prepend(canvas);

  let larghezza = 0;
  let altezza = 0;
  let colore = '';
  const fiocchi = [];

  const nuovoFiocco = (inCima) => ({
    x: Math.random() * larghezza,
    y: inCima ? -4 - Math.random() * 40 : Math.random() * altezza,
    raggio: 0.8 + Math.random() ** 2 * 2.2, // tanti piccoli, pochi grandi
    velocita: 14 + Math.random() * 26, // px al secondo
    fase: Math.random() * Math.PI * 2,
    oscillazione: 6 + Math.random() * 16, // ampiezza del dondolio, in px
    frequenza: 0.2 + Math.random() * 0.35, // dondolii al secondo
    alfa: 0.35 + Math.random() * 0.6,
  });

  function leggiColore() {
    colore =
      getComputedStyle(document.documentElement).getPropertyValue('--snow').trim() ||
      'rgba(255, 255, 255, 0.85)';
  }

  function ridimensiona() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    larghezza = window.innerWidth;
    altezza = window.innerHeight;
    canvas.width = Math.round(larghezza * dpr);
    canvas.height = Math.round(altezza * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const quanti = Math.round(
      Math.min(MAX_FIOCCHI, Math.max(MIN_FIOCCHI, (larghezza * altezza) / AREA_PER_FIOCCO)),
    );
    while (fiocchi.length < quanti) fiocchi.push(nuovoFiocco(false));
    fiocchi.length = quanti;
    for (const f of fiocchi) if (f.x > larghezza) f.x = Math.random() * larghezza;
  }

  let precedente = performance.now();
  function disegna(adesso) {
    // dopo una pausa (scheda in background) non si fanno salti
    const dt = Math.min((adesso - precedente) / 1000, 0.05);
    precedente = adesso;
    const t = adesso / 1000;

    ctx.clearRect(0, 0, larghezza, altezza);
    ctx.fillStyle = colore;
    for (const f of fiocchi) {
      f.y += f.velocita * dt;
      if (f.y - f.raggio > altezza) Object.assign(f, nuovoFiocco(true));
      const x = f.x + Math.sin(t * f.frequenza * Math.PI * 2 + f.fase) * f.oscillazione;
      ctx.globalAlpha = f.alfa;
      ctx.beginPath();
      ctx.arc(x, f.y, f.raggio, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(disegna);
  }

  let inAttesa = false;
  window.addEventListener('resize', () => {
    if (inAttesa) return;
    inAttesa = true;
    requestAnimationFrame(() => {
      inAttesa = false;
      ridimensiona();
    });
  });

  // Il colore segue il tema: interruttore della pagina o preferenza di sistema.
  new MutationObserver(leggiColore).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });
  window.matchMedia('(prefers-color-scheme: light)').addEventListener?.('change', leggiColore);

  leggiColore();
  ridimensiona();
  requestAnimationFrame(disegna);
}
