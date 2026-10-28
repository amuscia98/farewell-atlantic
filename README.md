# farewell-atlantic

Un calendario dell'avvento come tributo agli anni in **Atlantic Technologies**:
25 caselle, una per giorno, e dietro ogni casella una dedica. Per aprirne una
bisogna rispondere a un indovinello: la risposta è la password.

Il sito è statico e si pubblica con GitHub Pages. Il repository è pubblico,
quindi **il contenuto dei giorni viene cifrato in fase di build**: in `docs/`
finiscono solo HTML, CSS, JavaScript e, per ogni giorno, un file con salt, IV e
testo cifrato. Testi e immagini in chiaro restano in `content/`, che è in
`.gitignore` e non viene mai committata.

---

## Come funziona

```
content/          →   npm run build   →   docs/
(in chiaro,                               (cifrato,
 mai committata)                           pubblicato)
```

- la risposta all'indovinello viene **normalizzata** (minuscole, via accenti,
  spazi e punteggiatura), quindi `Natale `, `natale` e `NATALE!` sono la stessa
  risposta;
- da quella risposta si deriva una chiave con **PBKDF2-SHA256**, 310.000
  iterazioni e un **salt casuale diverso per ogni giorno**;
- il contenuto del giorno (testo in HTML, immagini incorporate come data URL,
  link ai video) viene compresso e cifrato con **AES-GCM**;
- nel browser la stessa risposta deriva la stessa chiave e decifra tutto con la
  Web Crypto API. Niente server, niente chiavi nel codice.

In chiaro, nelle pagine pubblicate, restano soltanto: il numero del giorno,
l'indovinello e l'eventuale suggerimento. Fanno eccezione i giorni che decidi
di rendere [pubblici](#giorni-pubblici-senza-password), che non hanno né
indovinello né cifratura.

### Quanto è sicuro davvero

Abbastanza per un regalo, non per un segreto. Il testo cifrato è pubblico:
chiunque può scaricarlo e provare risposte offline, senza limiti di tentativi.
Le 310.000 iterazioni rendono ogni tentativo lento, ma una risposta come
`natale` o `atlantic` cade comunque in poco tempo con un dizionario.

Quindi: **risposte di due o tre parole**, meglio se legate a cose che sanno solo
i destinatari. La build avvisa quando una risposta è troppo corta o troppo
prevedibile. Se un giorno contiene qualcosa che non deve proprio uscire, non
metterlo in un sito pubblico.

---

## Cosa serve

- [Node.js](https://nodejs.org) 18 o successivo (`node -v` per controllare)
- le dipendenze della build: `npm install`

Le dipendenze servono **solo** a costruire il sito: le pagine pubblicate non
usano nessun framework e nessuna libreria esterna.

---

## Partenza rapida

```bash
npm install          # una volta sola
npm run placeholders # crea 25 giorni segnaposto in content/
npm run build        # cifra tutto e genera docs/
npm run preview      # anteprima su http://localhost:8080
```

`npm run dev` fa build e anteprima insieme.

I segnaposto servono per vedere subito come viene: sostituiscili con i tuoi
contenuti, un giorno alla volta. `npm run placeholders` non sovrascrive i giorni
che esistono già (per riscriverli tutti: `node build/make-placeholders.mjs --force`).

> L'anteprima va aperta da `http://localhost`, non facendo doppio clic sui file:
> con `file://` il browser blocca i moduli JavaScript e la Web Crypto API.

---

## Aggiungere il contenuto di un giorno

Ogni giorno è una cartella `content/day-NN/` (da `day-01` a `day-25`) con dentro
un file `day.md`:

```markdown
---
titolo: La pausa di metà mattina
indovinello: |
  Dura tre minuti in piedi
  e risolve più problemi di una riunione da un'ora.
risposta: pausa caffè
suggerimento: Due parole, e ci vuole una tazzina.
video:
  - https://youtu.be/XXXXXXXXXXX
---

Testo della dedica, in **Markdown**: grassetto, *corsivo*, elenchi, citazioni,
titoli, link.

> Una citazione, se ti va.

![Testo alternativo](img/foto.jpg "Questa diventa la didascalia")
```

Il blocco fra `---` è il front-matter:

| campo | obbligatorio | a cosa serve |
|---|---|---|
| `indovinello` | sì | mostrato in chiaro sulla pagina. Usa `\|` per andare a capo |
| `risposta` | sì | la password. Non viene pubblicata, serve a cifrare |
| `titolo` | no | titolo mostrato dopo l'apertura (sta dentro la parte cifrata) |
| `suggerimento` | no | nascosto dietro "Serve un suggerimento?", in chiaro |
| `video` | no | elenco di link YouTube o Vimeo |
| `pubblico` | no | `sì` per un giorno senza indovinello e senza password, vedi sotto |

### Immagini

Mettile in `content/day-NN/img/` e richiamale con il percorso relativo
(`img/foto.jpg`). La build le ruota secondo l'orientamento EXIF, le ridimensiona
a 1400 px di larghezza, le converte in WebP e le incorpora **dentro il pacchetto
cifrato**: non esistono mai come file pubblici.

Il testo fra virgolette dopo il percorso diventa la didascalia.

Occhio al peso: chi apre una casella scarica tutta la busta di quel giorno. Un
paio di MB per giorno è ragionevole; oltre i 4 MB la build avvisa. Per immagini
più leggere abbassa `images.maxWidth` o `images.quality` in `config.json`.

### Video

I video **non vanno messi nel repository**. Caricali su YouTube come
"non in elenco" (unlisted) o su Vimeo, e metti il link:

- nel front-matter, sotto `video:`
- oppure su una riga da sola nel testo, ed è il link stesso a diventare il player

Il link finisce dentro la parte cifrata, quindi chi non risolve l'indovinello non
lo vede nemmeno. Resta però un video raggiungibile da chi ha l'URL: "non in
elenco" vuol dire nascosto, non privato.

### Giorni pubblici (senza password)

Non tutte le caselle devono avere un indovinello. Un giorno con
`pubblico: sì` si apre per tutti, direttamente:

```markdown
---
titolo: Benvenuti nel calendario
pubblico: sì
---

Ciao a tutti! Ecco come funziona il calendario…
```

Nei segnaposto è così il **giorno 1**, pensato per presentare il gioco. Sulla
home la casella ha il bordo tratteggiato e l'etichetta "libera", e non conta
nel progresso ("3 indovinelli risolti su 24").

**Il contenuto di un giorno pubblico finisce in chiaro nel repository**, immagini
comprese: chiunque guardi il codice su GitHub lo può leggere. Mettici solo
quello che va bene così.

Per sicurezza la regola è esplicita:

- un giorno senza `risposta` e senza `pubblico: sì` **blocca la build**: una
  risposta dimenticata non diventa mai una dedica pubblicata in chiaro;
- un giorno con `pubblico: sì` **e** una `risposta` blocca la build: devi
  decidere tu quale delle due;
- su un giorno pubblico `indovinello` e `suggerimento` vengono ignorati.

Il blocco per data vale anche per i giorni pubblici.

### Un giorno alla volta

Non serve avere tutti e 25 i giorni per costruire il sito: quelli senza
`day.md` vengono mostrati come caselle spente, con l'etichetta "in arrivo".

---

## Configurazione

Tutto in `config.json`:

```json
{
  "site": { "title": "...", "eyebrow": "...", "subtitle": "...", "intro": "...", "footer": "..." },
  "days": 25,
  "dateLock": { "enabled": false, "year": 2026, "month": 12 },
  "crypto": { "iterations": 310000, "compress": true },
  "images": { "maxWidth": 1400, "quality": 72, "format": "webp" }
}
```

- **`dateLock.enabled`** — con `true`, una casella non si apre prima del suo
  giorno (ora locale di chi guarda). È solo un effetto scenico: il contenuto è
  cifrato comunque, e chi ha già aperto una casella continua a vederla.
- **`crypto.iterations`** — più alto è, più lento è ogni tentativo (anche quello
  legittimo: 310.000 sono circa due decimi di secondo).
- **`crypto.compress`** — comprime prima di cifrare. Richiede un browser recente
  (Safari 16.4+, Chrome 80+, Firefox 113+); metti `false` se qualcuno usa un
  browser più vecchio.
- **`images.format`** — `webp` (consigliato) o `jpeg`.

Dopo ogni modifica: `npm run build`.

---

## Pubblicare su GitHub Pages

La cartella `docs/` è il sito pronto, ed è l'unica cosa che va committata.

```bash
npm run build
git add docs config.json
git commit -m "Aggiorno il calendario"
git push
```

Poi, una volta sola, su GitHub: **Settings → Pages → Build and deployment**,
*Source*: `Deploy from a branch`, *Branch*: `main` e cartella `/docs`. Salva.

Dopo un minuto il sito è su `https://amuscia98.github.io/farewell-atlantic/`.

Due cose da ricordare:

- `content/` è in `.gitignore`: le risposte e il materiale in chiaro restano sul
  tuo computer. **Fanne una copia di scorta** — se perdi quella cartella, i
  contenuti cifrati non si recuperano in alcun modo.
- le pagine hanno `noindex`: non finiscono sui motori di ricerca, ma chi ha il
  link le apre. Se vuoi che siano indicizzate, togli il meta `robots` dai
  template in `src/templates/`.

---

## Cambiare lo stile

Tutto quello che riguarda l'aspetto sta in **`src/assets/css/theme.css`**: colori,
font, dimensioni del testo, spaziature, raggi, durate delle animazioni. Sono solo
variabili CSS, nessuna regola di layout.

```css
:root {
  --accent: #c59a55;        /* il colore caldo degli accenti */
  --bg: #0b0e14;            /* il fondo */
  --tile-min: 7.5rem;       /* larghezza minima di una casella: decide le colonne */
  --radius-md: 12px;
  --font-display: Georgia, serif;
}
```

Il tema notturno è quello di partenza; più in basso nello stesso file ci sono i
colori del tema chiaro, usati quando il sistema è in chiaro o quando si preme
l'interruttore in alto a destra (la scelta resta memorizzata).

Il layout vero e proprio è in `src/assets/css/base.css`, la struttura delle
pagine in `src/templates/`. Dopo ogni modifica serve `npm run build`, che ricopia
tutto in `docs/`.

---

## Com'è fatto il repository

```
config.json           impostazioni del sito
content/              materiale in chiaro — IN .gitignore, mai committato
  day-01/
    day.md            front-matter (indovinello, risposta… o pubblico) + testo Markdown
    img/              immagini originali
build/
  build.mjs           la build: legge content/, cifra, genera docs/
  make-placeholders.mjs
  serve.mjs           server per l'anteprima locale
  lib/                front-matter, immagini e Markdown, cifratura
src/
  assets/css/theme.css   ← le variabili: colori, font, spaziature
  assets/css/base.css    layout e componenti
  assets/js/            normalize, crypto, store, theme, home, day
  templates/            index.html e day.html
docs/                 il sito generato — questo sì che va committato
```

`src/assets/js/normalize.js` è l'unico punto in cui è definita la
normalizzazione delle risposte, e viene usato sia dalla build sia dal browser:
se lo cambi, rilancia la build, altrimenti le risposte non combaciano più.

---

## Se qualcosa non va

**"la cartella content/ non esiste"** — `npm run placeholders`.

**"manca "risposta:" nel front-matter"** — aggiungi la risposta, oppure scrivi
`pubblico: sì` se quel giorno deve essere visibile a tutti.

**Una build fallita lascia `docs/` a metà** — la build ricrea `docs/` da zero,
quindi se si ferma per un errore non committare: correggi e rilancia.

**Una casella non si apre con la risposta giusta** — hai rilanciato `npm run
build` dopo aver cambiato la risposta? Le buste vecchie contengono la risposta
vecchia.

**"Web Crypto non disponibile"** — stai aprendo i file con `file://`. Usa
`npm run preview`.

**La pagina resta vuota dopo l'apertura** — guarda la console del browser; se
compare un errore su `DecompressionStream`, metti `"compress": false` in
`config.json` e ricostruisci.

**Ho perso la cartella `content/`** — i contenuti cifrati non sono recuperabili.
Per questo vale la pena tenerne una copia di scorta.
