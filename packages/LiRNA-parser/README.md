# @lirna/parser

Reusable LiRNA formula, RNA structure, and satisfiability parser.

## Usage

```ts
import {
  parseLtlFormula,
  parseWorkbenchInput,
  type LtlFormula,
} from "@lirna/parser";

const parsedStructure = parseWorkbenchInput("AUAUA", "(0,1);(1,4)", "<>(l up)");
const parsedFormula = parseLtlFormula("<>(l up)");
```

The package has no dependency on React, Vite, Tauri, or browser APIs, so it can
be used by both the application and a Node.js CLI.
