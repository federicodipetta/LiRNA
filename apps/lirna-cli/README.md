# LiRNA CLI

The CLI consumes the shared `@lirna/parser` package and does not depend on
React, Vite, Tauri, or browser APIs.

```bash
npm run build --workspace @lirna/cli
node apps/lirna-cli/dist/index.js --sequence AUAU --pairs "(0,1)" --formula "<>(l up)"
```

An `.aas` file can be parsed with:

```bash
node apps/lirna-cli/dist/index.js --input structure.aas
```
