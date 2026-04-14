import { useMemo, useState } from "react";
import { parseWorkbenchInput } from "../services/parser";
//                              1
//                    01234567890
const sequenceSeed = "AUAUAUAUAUA";
const pairsSeed = "(0,1);(2,3);(4,8)";
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
