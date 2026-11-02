# LiRNA

LiRNA è una repository per l'analisi di strutture di RNA attraverso formule
temporali del linguaggio LiRNA. Il progetto combina:

- una web app React distribuita anche come applicazione desktop tramite Tauri;
- un parser ed evaluatore riutilizzabile in TypeScript;
- una CLI Node.js per usare le stesse funzionalità da terminale;
- package condivisi per il parsing delle formule e delle sequenze RNA.

L'obiettivo è rappresentare una struttura RNA come una sequenza di basi e un
insieme di coppie di indici, quindi verificare proprietà espresse con formule
LiRNA. L'applicazione React offre un'interfaccia interattiva, mentre la CLI e i
package permettono di integrare la stessa logica in altri progetti o
pipeline di analisi.

## Indice

- [Avvio rapido](#avvio-rapido)
- [Formule LiRNA](#formule-lirna)
- [Struttura del progetto](#struttura-del-progetto)
- [Comandi principali](#comandi-principali)
- [CLI](#cli)
- [Package riutilizzabili](#package-riutilizzabili)
- [Test e build](#test-e-build)

## Avvio rapido

Requisiti:

- Node.js 20 o superiore;
- npm;
- Rust e le dipendenze Tauri solo per lo sviluppo dell'app desktop.

Installazione:

```bash
npm ci
```

Avvio dell'app React in modalità sviluppo:

```bash
npm run dev
```

L'app è disponibile normalmente su `http://localhost:5173` per Vite oppure
sulla porta configurata da Tauri quando viene avviata tramite Tauri.

Build completa:

```bash
npm run build
```

La build compila in ordine i package condivisi, la CLI e l'app React. Il
risultato dell'app web viene generato in `apps/react/dist`.

## Formule LiRNA

Le formule LiRNA descrivono proprietà temporali della sequenza e delle coppie
di basi. Gli atomi che rappresentano basi RNA sono:

```text
A   C   G   U
```

È possibile scriverli anche tra apici o virgolette:

```text
'A'
"U"
```

La forma quotata è utile quando si vuole rendere esplicito che il simbolo è
una base della sequenza.

### Costanti e punto corrente

```text
true
false
.
```

- `true` è sempre soddisfatta;
- `false` non è mai soddisfatta;
- `.` rappresenta il punto corrente della valutazione.

### Operatori logici

```text
!formula              negazione
formula & formula     congiunzione
formula && formula    congiunzione
formula | formula     disgiunzione
formula || formula    disgiunzione
```

Sono accettate anche le forme testuali `and` e `or`:

```text
!("A" && "U")
("A" and "C") or "G"
```

Le parentesi possono essere usate per rendere esplicita la precedenza:

```text
!("A" || "G") && <> "U"
```

### Operatori temporali

```text
O formula       prossimo stato (next)
<> formula      prima o poi (eventually)
[] formula      sempre (always)
formula U formula
                fino a quando (until)
```

Esempi:

```text
O "A"
<> "G"
[] !("U")
"A" U "G"
```

Gli operatori `O`, `<>` e `[]` sono unari. L'operatore `U` combina una formula
sinistra e una destra:

```text
("A" || "C") U ("G" && <> "U")
```

### Rho: attraversamento delle coppie

Un'espressione rho seleziona l'inizio o la fine delle coppie di basi. La
sintassi generale è:

```text
label>       estremità iniziale della coppia
label<       estremità finale della coppia
```

Sono disponibili anche le forme testuali `up` e `down`:

```text
l>
l up
l up

l<
l down
l down
```

Esempi:

```text
<>(l>)
<>(l< && "A")
[] !(l down)
```

In queste formule `l` è una variabile associata alle coppie incontrate durante
la valutazione.

### Quantificatori

I quantificatori fissano una variabile rho su un dominio di possibili coppie:

```text
Elabel formula       esiste una coppia label
Alabel formula       per ogni coppia label
```

Esempi:

```text
El <> (l> && "A")
Al [] !(l< && "G")
```

Sono supportate anche etichette più lunghe, composte da lettere, numeri e
underscore:

```text
Epair <> (pair> && "U")
A_selected [] !(selected<)
```

### Operatore `@`

L'operatore `@` valuta una formula in relazione a una specifica etichetta:

```text
formula @ label
```

Esempio:

```text
(<>(l>) && !(<> l<)) @ l
```

### Operatore `|>`

`|>` è una forma abbreviata per esprimere un passaggio verso una coppia
etichettata. La formula:

```text
"A" |> l
```

viene interpretata come:

```text
<>(l< && O("A"))
```

È possibile combinarla con gli altri operatori:

```text
("A" && O("U")) |> pair
```

### Formula completa di esempio

La seguente formula cerca una sequenza che raggiunga una coppia all'inizio,
verifichi una base `U`, e successivamente raggiunga la fine della stessa
struttura:

```text
<>(
  l1> &&
  "U" &&
  O(
    l2> &&
    "A"
  )
) &&
<>(
  l2< &&
  O(l1<)
)
```

Gli spazi e gli a capo sono ignorati dal lexer.

## Struttura del progetto

```text
LiRNA/
├── apps/
│   ├── lirna-cli/               # CLI Node.js
│   │   ├── src/
│   │   └── package.json
│   └── react/                   # App React + Tauri
│       ├── src/
│       ├── public/
│       ├── src-tauri/
│       ├── vite.config.ts
│       └── package.json
├── packages/
│   ├── LiRNA-parser/            # Formule, AST, valutatore e strutture
│   └── LiRNA-sequence/          # Normalizzazione e validazione RNA
├── .github/workflows/
│   └── deploy-pages.yml         # Deploy su GitHub Pages
├── package.json                 # Workspace npm e script root
└── package-lock.json
```

### `@lirna/sequence`

Contiene la logica indipendente per le sequenze:

- rimozione degli spazi;
- normalizzazione in maiuscolo;
- validazione dei caratteri `A`, `C`, `G` e `U`;
- parsing strutturato con messaggi di errore.

### `@lirna/parser`

Contiene:

- lexer delle formule;
- parser e AST LiRNA;
- formattazione delle formule;
- parser di sequenze, coppie e file `.aas`;
- valutatore delle formule;
- algebra delle constraint;
- test del linguaggio e del valutatore.

### `apps/react`

Contiene l'interfaccia grafica e l'integrazione desktop:

- componenti React;
- hook e servizi specifici dell'interfaccia;
- configurazione Vite e Tailwind;
- progetto Rust/Tauri in `src-tauri`.

### `apps/lirna-cli`

È il consumer Node.js del parser. Non dipende da React, Vite o Tauri e può
essere trasformato in un package CLI pubblicabile separatamente.

## Comandi principali

### Sviluppo React

```bash
npm run dev
```

### Build React

```bash
npm run build:react
```

### Preview della build web

```bash
npm run preview
```

### Sviluppo Tauri

```bash
npm run tauri dev
```

La configurazione Tauri si trova in
[`apps/react/src-tauri/tauri.conf.json`](apps/react/src-tauri/tauri.conf.json).
Tauri usa la build generata in `apps/react/dist`.

### Build completa del workspace

```bash
npm run build
```

### Test completi

```bash
npm test
```

Test mirati:

```bash
npm run test --workspace @lirna/sequence
npm run test --workspace @lirna/parser
```

## CLI

Compilazione:

```bash
npm run build --workspace @lirna/cli
```

Parsing di una sequenza, di alcune coppie e di una formula:

```bash
node apps/lirna-cli/dist/index.js \
  --sequence AUAUA \
  --pairs "(0,1);(1,4)" \
  --formula "<>(l up)"
```

Su Windows PowerShell è possibile usare una singola riga:

```powershell
node apps\lirna-cli\dist\index.js --sequence AUAUA --pairs "(0,1);(1,4)" --formula "<>(l up)"
```

Parsing di un file `.aas`:

```bash
node apps/lirna-cli/dist/index.js --input structure.aas
```

Un file `.aas` contiene la sequenza nella prima riga e la lista delle coppie
nella seconda:

```text
AUAUA
(0,1);(1,4)
```

La CLI restituisce JSON su standard output. In caso di errore di parsing
restituisce il JSON diagnostico su standard error e termina con codice diverso
da zero.

## Utilizzo dei package in un altro progetto

Una volta pubblicati su npm:

```bash
npm install @lirna/parser @lirna/sequence
```

Esempio TypeScript:

```ts
import {
  parseLtlFormula,
  parseWorkbenchInput,
} from "@lirna/parser";
import {
  normalizeSequence,
  validateSequence,
} from "@lirna/sequence";

const sequence = normalizeSequence(" aua gu ");
const sequenceError = validateSequence(sequence);
const structure = parseWorkbenchInput(
  sequence,
  "(0,1);(2,5)",
  "<>(l up && \"A\")",
);
const formula = parseLtlFormula("<>(l up && \"A\")");
```

I package non utilizzano API React o browser e sono quindi utilizzabili sia in
un'app Node.js/CLI sia in una web app.

## GitHub Pages

Il workflow [`deploy-pages.yml`](.github/workflows/deploy-pages.yml) viene
eseguito sui push sul branch `release` o manualmente tramite
`workflow_dispatch`.

Il workflow:

1. installa le dipendenze con `npm ci`;
2. compila i package e l'app React;
3. usa il base path `/LiRNA/`;
4. pubblica `apps/react/dist` su GitHub Pages.

## Note di sviluppo

- Gli import interni dei package compilati usano estensioni `.js` per essere
  compatibili con Node.js ESM.
- La logica specifica dell'interfaccia, come l'orchestrazione dei risultati
  batch, resta nell'app React.
- La logica condivisa deve essere aggiunta a `@lirna/parser` o
  `@lirna/sequence`, evitando dipendenze da React o Tauri.
