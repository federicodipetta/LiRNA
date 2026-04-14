import { useMemo, useState } from "react";
import { parseWorkbenchInput } from "../services/parser";

const sequenceSeed = "AUAUAUAUAUA";
const pairsSeed = "(1,2);(3,5);(4,8)";
const lirnaSeed = "<>(l↑)";
export function useParserForm() {
  const [sequenceInput, setSequenceInput] = useState(sequenceSeed);
  const [pairsInput, setPairsInput] = useState(pairsSeed);
  const [thirdInput, setThirdInput] = useState(lirnaSeed);

  const parseResult = useMemo(
    () => parseWorkbenchInput(sequenceInput, pairsInput, thirdInput),
    [sequenceInput, pairsInput, thirdInput],
  );

  return {
    sequenceInput,
    setSequenceInput,
    pairsInput,
    setPairsInput,
    thirdInput,
    setThirdInput,
    parseResult,
  };
}
