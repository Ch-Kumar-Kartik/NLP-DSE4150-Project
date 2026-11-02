// Core BPE logic (Sennrich et al. 2016 style, with an end-of-word marker).
const EOW = "</w>";

// Split text into words and standalone punctuation marks.
function pretokenize(text) {
  return text.toLowerCase().match(/[\p{L}\p{N}_]+|[^\p{L}\p{N}_\s]/gu) || [];
}

function wordToSymbols(word) {
  return [...word, EOW];
}

// Learn `numMerges` merge rules from a corpus. Returns ordered list of [a, b].
function trainBPE(corpus, numMerges) {
  const freq = new Map();
  for (const w of pretokenize(corpus)) freq.set(w, (freq.get(w) || 0) + 1);
  let words = [...freq].map(([w, f]) => ({ syms: wordToSymbols(w), f }));
  const merges = [];

  for (let m = 0; m < numMerges; m++) {
    const counts = new Map();
    for (const { syms, f } of words) {
      for (let i = 0; i < syms.length - 1; i++) {
        const key = syms[i] + "\u0000" + syms[i + 1];
        counts.set(key, (counts.get(key) || 0) + f);
      }
    }
    let best = null, bestN = 1; // require count >= 2 to be worth merging
    for (const [k, n] of counts) if (n > bestN) { best = k; bestN = n; }
    if (!best) break;
    const [a, b] = best.split("\u0000");
    merges.push([a, b, bestN]);
    for (const w of words) w.syms = applyMerge(w.syms, a, b);
  }
  return { merges, uniqueWords: freq.size, totalWords: [...freq.values()].reduce((x, y) => x + y, 0) };
}

function applyMerge(syms, a, b) {
  const out = [];
  for (let i = 0; i < syms.length; i++) {
    if (i < syms.length - 1 && syms[i] === a && syms[i + 1] === b) {
      out.push(a + b);
      i++;
    } else out.push(syms[i]);
  }
  return out;
}

// Build the vocabulary: base characters (from the corpus) then each merged token.
function buildVocab(corpus, merges) {
  const chars = new Set([EOW]);
  for (const w of pretokenize(corpus)) for (const ch of w) chars.add(ch);
  const vocab = new Map();
  for (const c of [...chars].sort()) vocab.set(c, vocab.size);
  for (const [a, b] of merges) if (!vocab.has(a + b)) vocab.set(a + b, vocab.size);
  return vocab;
}

/**
 * Tokenize `text`, recording the state after every merge rule that actually
 * changes something. Returns:
 *   words:  the pre-tokenized words
 *   steps:  [{ rule: null | {rank, a, b, count}, words: string[][], created: Set<"w:i">[] }]
 *           steps[0] is the raw character split.
 */
function tokenizeWithSteps(text, merges) {
  const words = pretokenize(text);
  let state = words.map(wordToSymbols);
  const steps = [{ rule: null, words: state, created: state.map(() => new Set()) }];

  merges.forEach(([a, b], rank) => {
    let count = 0;
    const created = [];
    const next = state.map((syms) => {
      const out = [], mark = new Set();
      for (let i = 0; i < syms.length; i++) {
        if (i < syms.length - 1 && syms[i] === a && syms[i + 1] === b) {
          mark.add(out.length);
          out.push(a + b);
          count++;
          i++;
        } else out.push(syms[i]);
      }
      created.push(mark);
      return out;
    });
    if (count > 0) {
      state = next;
      steps.push({ rule: { rank, a, b, count }, words: next, created });
    }
  });
  return { words, steps };
}

// Positions in `syms` where the pair (a, b) would merge next.
function pairPositions(syms, a, b) {
  const pos = new Set();
  for (let i = 0; i < syms.length - 1; i++) {
    if (syms[i] === a && syms[i + 1] === b) { pos.add(i); pos.add(i + 1); i++; }
  }
  return pos;
}
