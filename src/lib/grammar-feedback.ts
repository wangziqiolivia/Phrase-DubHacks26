export interface GrammarCorrection {
  original: string;
  correction: string;
  explanation: string;
}

export interface GrammarDiffToken {
  prefix: string;
  word: string;
  change: "same" | "added" | "deleted";
}

export function isGrammarCorrection(value: unknown): value is GrammarCorrection {
  if (typeof value !== "object" || value === null) return false;
  const correction = value as Record<string, unknown>;
  return (
    typeof correction.original === "string" &&
    typeof correction.correction === "string" &&
    typeof correction.explanation === "string"
  );
}

export function diffGrammarCorrection(
  original: string,
  correction: string,
  locale = "en-US",
): {
  original: GrammarDiffToken[];
  originalSuffix: string;
  correction: GrammarDiffToken[];
  correctionSuffix: string;
} {
  const tokenize = (text: string) => {
    const words: Array<{ prefix: string; word: string }> = [];
    const segmenter = new Intl.Segmenter(locale, { granularity: "word" });
    let prefix = "";
    for (const segment of segmenter.segment(text)) {
      if (segment.isWordLike) {
        words.push({ prefix, word: segment.segment });
        prefix = "";
      } else {
        prefix += segment.segment;
      }
    }
    return { words, suffix: prefix };
  };

  const originalParts = tokenize(original);
  const correctionParts = tokenize(correction);
  const originalWords = originalParts.words;
  const correctionWords = correctionParts.words;

  if (originalWords.length * correctionWords.length > 40_000) {
    return {
      original: originalWords.map((token) => ({ ...token, change: "same" })),
      originalSuffix: originalParts.suffix,
      correction: correctionWords.map((token) => ({ ...token, change: "same" })),
      correctionSuffix: correctionParts.suffix,
    };
  }

  const key = (token: { word: string }) => token.word.toLocaleLowerCase(locale);
  const lengths = Array.from(
    { length: originalWords.length + 1 },
    () => new Uint16Array(correctionWords.length + 1),
  );

  for (let left = originalWords.length - 1; left >= 0; left -= 1) {
    for (let right = correctionWords.length - 1; right >= 0; right -= 1) {
      lengths[left][right] =
        key(originalWords[left]) === key(correctionWords[right])
          ? lengths[left + 1][right + 1] + 1
          : Math.max(lengths[left + 1][right], lengths[left][right + 1]);
    }
  }

  const originalDiff: GrammarDiffToken[] = [];
  const correctionDiff: GrammarDiffToken[] = [];
  let left = 0;
  let right = 0;

  while (left < originalWords.length || right < correctionWords.length) {
    if (
      left < originalWords.length &&
      right < correctionWords.length &&
      key(originalWords[left]) === key(correctionWords[right])
    ) {
      originalDiff.push({ ...originalWords[left], change: "same" });
      correctionDiff.push({ ...correctionWords[right], change: "same" });
      left += 1;
      right += 1;
    } else if (
      right < correctionWords.length &&
      (left === originalWords.length ||
        lengths[left][right + 1] > lengths[left + 1][right])
    ) {
      correctionDiff.push({ ...correctionWords[right], change: "added" });
      right += 1;
    } else {
      originalDiff.push({ ...originalWords[left], change: "deleted" });
      left += 1;
    }
  }

  return {
    original: originalDiff,
    originalSuffix: originalParts.suffix,
    correction: correctionDiff,
    correctionSuffix: correctionParts.suffix,
  };
}
