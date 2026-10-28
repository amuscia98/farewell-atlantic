// ---------------------------------------------------------------------------
// Normalizzazione delle risposte agli indovinelli.
//
// Questo file è l'UNICA definizione della regola: viene importato sia dalla
// build (Node) sia dal browser. Se lo modifichi devi rilanciare `npm run build`,
// altrimenti le risposte cifrate e quelle digitate non combaciano più.
//
// "Il Natale!" -> "ilnatale"      "Caffè   della mattina" -> "caffedellamattina"
// ---------------------------------------------------------------------------

// Caratteri che NFD non scompone da solo.
const SPECIALI = [
  [/ß/g, 'ss'],
  [/[øØ]/g, 'o'],
  [/[æÆ]/g, 'ae'],
  [/[œŒ]/g, 'oe'],
  [/[đĐ]/g, 'd'],
  [/[łŁ]/g, 'l'],
];

export function normalizeAnswer(value) {
  let out = String(value ?? '');
  for (const [pattern, replacement] of SPECIALI) out = out.replace(pattern, replacement);
  return out
    .normalize('NFD')               // separa le lettere dai segni diacritici
    .replace(/[̀-ͯ]/g, '') // via gli accenti
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');     // via spazi, punteggiatura e simboli
}

export default normalizeAnswer;
