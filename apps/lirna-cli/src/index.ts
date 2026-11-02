#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import {
  parseAasContent,
  parseLtlFormula,
  parseWorkbenchInput,
} from "@lirna/parser";

interface CliOptions {
  sequence?: string;
  pairs?: string;
  formula?: string;
  input?: string;
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {};

  for (let index = 0; index < args.length; index += 1) {
    const option = args[index];
    const value = args[index + 1];

    if (!value) {
      throw new Error(`Missing value for ${option}.`);
    }

    switch (option) {
      case "--sequence":
      case "-s":
        options.sequence = value;
        break;
      case "--pairs":
      case "-p":
        options.pairs = value;
        break;
      case "--formula":
      case "-f":
        options.formula = value;
        break;
      case "--input":
      case "-i":
        options.input = value;
        break;
      default:
        throw new Error(`Unknown option: ${option}`);
    }

    index += 1;
  }

  return options;
}

async function run(options: CliOptions): Promise<void> {
  let sequence = options.sequence ?? "";
  let pairs = options.pairs ?? "";

  if (options.input) {
    const content = await readFile(options.input, "utf8");
    const imported = parseAasContent(content);
    if (imported.issue) {
      throw new Error(imported.issue);
    }
    sequence = imported.sequence;
    pairs = imported.pairsInput;
  }

  const structure = parseWorkbenchInput(sequence, pairs, options.formula ?? "");
  const formula = options.formula ? parseLtlFormula(options.formula) : undefined;

  const result = {
    structure,
    formula,
  };

  if (structure.issues.length > 0 || formula?.error) {
    console.error(JSON.stringify(result, null, 2));
    process.exitCode = 1;
    return;
  }

  console.log(JSON.stringify(result, null, 2));
}

try {
  await run(parseArgs(process.argv.slice(2)));
} catch (error) {
  console.error(error instanceof Error ? error.message : "Unknown CLI error.");
  console.error(
    "Usage: lirna --sequence AUAU --pairs \"(0,1)\" --formula \"<>(l up)\"",
  );
  process.exitCode = 1;
}
