// ---------------------------------------------------------------------------
// Lettore del front-matter di day.md.
//
// Niente dipendenze YAML: serve un sottoinsieme piccolo e prevedibile.
//
//   ---
//   titolo: Il primo giorno
//   indovinello: |
//     Due righe
//     di indovinello
//   risposta: caffè della mattina
//   suggerimento: Si beve
//   video:
//     - https://youtu.be/XXXXXXXXXXX
//   ---
// ---------------------------------------------------------------------------

export function parseFrontMatter(testo) {
  const normalizzato = testo.replace(/^﻿/, '').replace(/\r\n?/g, '\n');

  if (!normalizzato.startsWith('---')) {
    return { dati: {}, corpo: normalizzato.trim() };
  }

  const fine = normalizzato.indexOf('\n---', 3);
  if (fine === -1) {
    throw new Error('front-matter aperto con --- ma mai chiuso');
  }

  const testa = normalizzato.slice(normalizzato.indexOf('\n') + 1, fine);
  const corpo = normalizzato.slice(normalizzato.indexOf('\n', fine + 1) + 1);

  return { dati: parseBlocco(testa), corpo: corpo.trim() };
}

function parseBlocco(testa) {
  const righe = testa.split('\n');
  const dati = {};
  let i = 0;

  while (i < righe.length) {
    const riga = righe[i];

    if (!riga.trim() || riga.trimStart().startsWith('#')) {
      i += 1;
      continue;
    }

    const match = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(riga);
    if (!match) {
      throw new Error(`riga di front-matter non capita: "${riga}"`);
    }

    const chiave = match[1].toLowerCase();
    const valore = match[2].trim();

    // Blocco di testo su più righe: "chiave: |" oppure "chiave: >"
    if (valore === '|' || valore === '>') {
      const blocco = [];
      i += 1;
      while (i < righe.length && (righe[i].startsWith('  ') || !righe[i].trim())) {
        blocco.push(righe[i].replace(/^ {2}/, ''));
        i += 1;
      }
      while (blocco.length && !blocco.at(-1).trim()) blocco.pop();
      dati[chiave] = valore === '|' ? blocco.join('\n') : blocco.join(' ').replace(/\s+/g, ' ').trim();
      continue;
    }

    // Elenco: "chiave:" seguita da righe "  - voce"
    if (valore === '') {
      const elenco = [];
      i += 1;
      while (i < righe.length && /^\s*-\s+/.test(righe[i])) {
        elenco.push(spoglia(righe[i].replace(/^\s*-\s+/, '').trim()));
        i += 1;
      }
      dati[chiave] = elenco;
      continue;
    }

    dati[chiave] = spoglia(valore);
    i += 1;
  }

  return dati;
}

function spoglia(valore) {
  if (
    (valore.startsWith('"') && valore.endsWith('"') && valore.length > 1) ||
    (valore.startsWith("'") && valore.endsWith("'") && valore.length > 1)
  ) {
    return valore.slice(1, -1);
  }
  return valore;
}
