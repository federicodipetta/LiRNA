# LiRNA

LiRNA is a repository for analyzing RNA structures through temporal formulas
written in the LiRNA language. The project includes:

- a React web application distributed as a Tauri desktop application;
- a reusable TypeScript parser and evaluator;
- a Node.js CLI for terminal-based workflows;
- shared packages for LiRNA formulas and RNA sequence processing.

The project represents an RNA structure as a nucleotide sequence and a list
of base-pair indices. LiRNA formulas can then be used to describe temporal and
structural properties of that RNA.

## Table of contents

- [Quick start](#quick-start)
- [LiRNA formulas](#lirna-formulas)
- [Project structure](#project-structure)
- [Main commands](#main-commands)
- [CLI](#cli)
- [Reusable packages](#reusable-packages)
- [Testing and builds](#testing-and-builds)
- [GitHub Pages](#github-pages)

## Quick start

### Requirements

- Node.js 20 or later;
- npm;
- Rust and the Tauri prerequisites if you want to run the desktop application.

Install the dependencies from the repository root:

```bash
npm ci
```

Start the React application in development mode:

```bash
npm run dev
```

Build all packages, the CLI, and the React application:

```bash
npm run build
```

The React build is generated in `apps/react/dist`.

## LiRNA formulas

LiRNA formulas describe temporal properties of an RNA sequence and its base
pairs.

### Nucleotide atoms

The supported RNA nucleotide atoms are:

```text
A   C   G   U
```

Atoms can also be enclosed in single or double quotes:

```text
'A'
"U"
```

### Constants and current position

```text
true
false
.
```

- `true` is always satisfied;
- `false` is never satisfied;
- `.` represents the current position in the evaluation.

### Logical operators

```text
!formula              negation
formula & formula     conjunction
formula && formula    conjunction
formula | formula     disjunction
formula || formula    disjunction
```

The textual aliases `and` and `or` are also supported:

```text
!("A" && "U")
("A" and "C") or "G"
```

Parentheses can be used to make precedence explicit:

```text
!("A" || "G") && <> "U"
```

### Temporal operators

```text
O formula             next state
<> formula            eventually
[] formula            always
formula U formula     until
```

Examples:

```text
O "A"
<> "G"
[] !("U")
"A" U "G"
```

The operators `O`, `<>`, and `[]` are unary. `U` combines a left-hand and a
right-hand formula:

```text
("A" || "C") U ("G" && <> "U")
```

### Rho expressions

A rho expression selects the start or end of a base pair. The basic syntax is:

```text
label>               pair start
label<               pair end
```

The textual forms `up` and `down` are also supported:

```text
l>
l up

l<
l down
```

Examples:

```text
<>(l>)
<>(l< && "A")
[] !(l down)
```

Here, `l` is a variable associated with the base pairs encountered during
evaluation.

### Quantifiers

Quantifiers bind a rho variable over the possible base pairs:

```text
Elabel formula       exists a pair labelled label
Alabel formula       for every pair labelled label
```

Examples:

```text
El <> (l> && "A")
Al [] !(l< && "G")
```

Labels may contain letters, numbers, and underscores:

```text
Epair <> (pair> && "U")
A_selected [] !(selected<)
```

### The `@` operator

The `@` operator evaluates a formula in relation to a specific label:

```text
formula @ label
```

Example:

```text
(<>(l>) && !(<> l<)) @ l
```

### The `|>` operator

`|>` is a shorthand for expressing a transition toward a labelled pair:

```text
"A" |> l
```

It is interpreted as:

```text
<>(l< && O("A"))
```

It can be combined with the other operators:

```text
("A" && O("U")) |> pair
```

### Complete example

The following formula looks for a structure that reaches one pair start,
contains a `U`, then reaches another pair start and eventually reaches the
corresponding pair ends:

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

Whitespace and line breaks are ignored by the lexer.

## Project structure

```text
LiRNA/
├── apps/
│   ├── lirna-cli/               # Node.js CLI
│   │   ├── src/
│   │   └── package.json
│   └── react/                   # React + Tauri application
│       ├── src/
│       ├── public/
│       ├── src-tauri/
│       ├── vite.config.ts
│       └── package.json
├── packages/
│   ├── LiRNA-parser/            # Formula, AST, evaluator, and structure parser
│   └── LiRNA-sequence/          # RNA normalization and validation
├── .github/workflows/
│   └── deploy-pages.yml         # GitHub Pages deployment
├── package.json                 # npm workspace and root scripts
└── package-lock.json
```

### `@lirna/sequence`

This package contains environment-independent RNA sequence utilities:

- whitespace removal;
- uppercase normalization;
- validation of `A`, `C`, `G`, and `U`;
- structured sequence parsing with validation errors.

### `@lirna/parser`

This package contains:

- the LiRNA lexer;
- the LiRNA parser and AST;
- formula formatting;
- sequence, pair, and `.aas` file parsing;
- formula evaluation;
- constraint algebra;
- parser and evaluator tests.

### `apps/react`

This directory contains the graphical and desktop application:

- React components;
- application-specific hooks and services;
- Vite and Tailwind configuration;
- the Rust/Tauri project in `src-tauri`.

### `apps/lirna-cli`

This is the Node.js CLI consumer of the parser. It does not depend on React,
Vite, or Tauri and can be published independently in the future.

## Main commands

### React development

```bash
npm run dev
```

### React build

```bash
npm run build:react
```

### Preview the web build

```bash
npm run preview
```

### Tauri development

```bash
npm run tauri dev
```

The Tauri configuration is located at
[`apps/react/src-tauri/tauri.conf.json`](apps/react/src-tauri/tauri.conf.json).
Tauri uses the build generated in `apps/react/dist`.

### Full workspace build

```bash
npm run build
```

### Full test suite

```bash
npm test
```

Run tests for a specific package:

```bash
npm run test --workspace @lirna/sequence
npm run test --workspace @lirna/parser
```

## CLI

Build the CLI:

```bash
npm run build --workspace @lirna/cli
```

Parse a sequence, a pair list, and a formula:

```bash
node apps/lirna-cli/dist/index.js \
  --sequence AUAUA \
  --pairs "(0,1);(1,4)" \
  --formula "<>(l up)"
```

On Windows PowerShell:

```powershell
node apps\lirna-cli\dist\index.js --sequence AUAUA --pairs "(0,1);(1,4)" --formula "<>(l up)"
```

Parse an `.aas` file:

```bash
node apps/lirna-cli/dist/index.js --input structure.aas
```

An `.aas` file contains the sequence on the first line and the pair list on
the second line:

```text
AUAUA
(0,1);(1,4)
```

The CLI writes JSON to standard output. If parsing fails, it writes diagnostic
JSON or an error message to standard error and exits with a non-zero status.

## Using the packages in another project

After publishing the packages to npm:

```bash
npm install @lirna/parser @lirna/sequence
```

Example TypeScript usage:

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

The packages do not depend on React or browser APIs and can therefore be used
from both Node.js/CLI applications and web applications.

## GitHub Pages

The [`deploy-pages.yml`](.github/workflows/deploy-pages.yml) workflow runs on
pushes to the `release` branch or manually through `workflow_dispatch`.

The workflow:

1. installs dependencies with `npm ci`;
2. builds the shared packages and the React application;
3. uses `/LiRNA/` as the base path;
4. publishes `apps/react/dist` to GitHub Pages.

## Development notes

- Compiled package imports use `.js` extensions for Node.js ESM compatibility.
- UI-specific logic, such as batch result orchestration, remains in the React
  application.
- Shared functionality should be added to `@lirna/parser` or
  `@lirna/sequence`, without introducing React or Tauri dependencies.
