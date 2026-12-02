// ---------------------------------------------------------------------------
// Un saluto nella console per chi apre gli strumenti per sviluppatori.
// ---------------------------------------------------------------------------

export function salutaCuriosi() {
  const titolo = 'font: 600 18px/1.5 Georgia, serif; color: #e2bc7c;';
  const testo = 'font: 13px/1.6 system-ui, sans-serif; color: #9aa4b8;';
  console.log(
    '%cCuriosone! 👀🎄\n' +
      "%cGli indovinelli si risolvono con la testa, non con l'ispettore.\n" +
      'Le risposte sono cifrate (AES-GCM e 310.000 giri di PBKDF2): buona fortuna 😉\n' +
      "E no, spostare in avanti la data del computer non serve: chi bara trova il carbone 🪨",
    titolo,
    testo,
  );
}
