const DEFAULT_CORPUS = `
low lower lowest lowly slow slowly slowest flow flower flowing
new newer newest news renew renewal newly
wide wider widest widely widen width
the tokenizer splits text into tokens and the tokens are used by language models.
a token can be a word, a piece of a word, or a single character.
byte pair encoding starts with characters and repeatedly merges the most frequent pair.
the most frequent pairs become new tokens, so common words become single tokens
while rare words are split into smaller pieces. this is widely used in language models.
the lowest and newest tokens are learned first, then lower and wider pieces follow.
tokenization is the first step of natural language processing. tokenizers are trained on text.
used, using, user, users, useful, useless. widely, wildly, wisely, wise, wiser, wisest.
`.trim();

const $ = (id) => document.getElementById(id);
const el = {
  input: $("input"), corpus: $("corpus"), nmerges: $("nmerges"), nmergesVal: $("nmergesVal"),
  trainStats: $("trainStats"), viz: $("viz"), slider: $("slider"), stepInfo: $("stepInfo"),
  final: $("final"), metrics: $("metrics"), rules: $("rules"), speed: $("speed"),
  play: $("play"), prev: $("prev"), next: $("next"), reset: $("reset"), end: $("end"),
};

let model = { merges: [], vocab: new Map() };
let run = { words: [], steps: [] };
let cur = 0;
let timer = null;

function hue(tok) {
  let h = 0;
  for (const c of tok) h = (h * 31 + c.codePointAt(0)) % 360;
  return h;
}

function display(tok) {
  return tok.endsWith(EOW) ? tok.slice(0, -EOW.length) + "▁" : tok;
}

function train() {
  const n = +el.nmerges.value;
  el.nmergesVal.textContent = n;
  const { merges, uniqueWords, totalWords } = trainBPE(el.corpus.value, n);
  const vocab = buildVocab(el.corpus.value, merges);
  model = { merges, vocab };
  el.trainStats.textContent =
    `${totalWords} words (${uniqueWords} unique) · ${merges.length} merges learned · vocabulary size ${vocab.size}`;
  tokenize();
}

function tokenize() {
  stop();
  run = tokenizeWithSteps(el.input.value, model.merges);
  el.slider.max = run.steps.length - 1;
  show(0);
  renderRules();
}

function show(i) {
  cur = Math.max(0, Math.min(run.steps.length - 1, i));
  el.slider.value = cur;
  render();
}

function chip(tok, cls) {
  const s = document.createElement("span");
  s.className = "chip" + (cls ? " " + cls : "");
  s.textContent = display(tok);
  if ([...tok.replace(EOW, "")].length > 0 && tok !== EOW && tok.length > 1) {
    s.style.setProperty("--h", hue(tok));
    s.classList.add("merged");
  }
  return s;
}

function render() {
  const step = run.steps[cur];
  const upcoming = run.steps[cur + 1];
  el.viz.replaceChildren();

  if (!run.words.length) {
    el.viz.innerHTML = '<p class="hint">Type something above to see it tokenized.</p>';
  }

  step.words.forEach((syms, wi) => {
    const row = document.createElement("div");
    row.className = "row";
    const label = document.createElement("div");
    label.className = "word";
    label.textContent = run.words[wi];
    const toks = document.createElement("div");
    toks.className = "toks";
    const nextPos = upcoming ? pairPositions(syms, upcoming.rule.a, upcoming.rule.b) : new Set();
    syms.forEach((t, i) => {
      const cls = step.created[wi].has(i) ? "new" : nextPos.has(i) ? "next" : "";
      toks.appendChild(chip(t, cls));
    });
    row.append(label, toks);
    el.viz.appendChild(row);
  });

  // step caption
  const total = run.steps.length - 1;
  if (cur === 0) {
    el.stepInfo.innerHTML = `<b>Step 0 / ${total}</b> · Start: every word split into characters plus an end-of-word marker ▁.` +
      (upcoming ? ` Next rule: <code>${display(upcoming.rule.a)} + ${display(upcoming.rule.b)}</code>` : "");
  } else {
    const r = step.rule;
    el.stepInfo.innerHTML = `<b>Step ${cur} / ${total}</b> · Rule #${r.rank + 1}: ` +
      `<code>${display(r.a)} + ${display(r.b)} → ${display(r.a + r.b)}</code> applied ${r.count}×`;
  }

  // buttons
  el.prev.disabled = el.reset.disabled = cur === 0;
  el.next.disabled = el.end.disabled = cur === total;
  if (cur === total && timer) stop();

  renderFinal();
  highlightRules();
}

function renderFinal() {
  const step = run.steps[cur];
  el.final.replaceChildren();
  let count = 0;
  step.words.forEach((syms) => syms.forEach((t) => {
    const box = document.createElement("div");
    box.className = "tok";
    const c = chip(t);
    const id = document.createElement("small");
    id.textContent = model.vocab.has(t) ? model.vocab.get(t) : "unk";
    box.append(c, id);
    el.final.appendChild(box);
    count++;
  }));
  const chars = run.words.reduce((n, w) => n + [...w].length, 0);
  const base = chars + run.words.length; // characters + EOW markers
  el.metrics.innerHTML =
    `<div><b>${count}</b><span>tokens now</span></div>` +
    `<div><b>${base}</b><span>initial symbols</span></div>` +
    `<div><b>${base ? (base / count).toFixed(2) : "–"}×</b><span>compression</span></div>`;
}

function renderRules() {
  el.rules.replaceChildren();
  run.steps.slice(1).forEach((s, i) => {
    const li = document.createElement("li");
    li.dataset.step = i + 1;
    li.innerHTML = `<code>${display(s.rule.a)} + ${display(s.rule.b)}</code><span>→ <b>${display(s.rule.a + s.rule.b)}</b></span><em>${s.rule.count}×</em>`;
    li.onclick = () => { stop(); show(i + 1); };
    el.rules.appendChild(li);
  });
  if (!run.steps.length || run.steps.length === 1) {
    el.rules.innerHTML = '<li class="hint">No learned merge applies to this input.</li>';
  }
}

function highlightRules() {
  let active = null;
  el.rules.querySelectorAll("li[data-step]").forEach((li) => {
    const n = +li.dataset.step;
    li.classList.toggle("done", n <= cur);
    li.classList.toggle("active", n === cur);
    if (n === cur) active = li;
  });
  if (active) active.scrollIntoView({ block: "nearest" });
}

function play() {
  if (cur >= run.steps.length - 1) show(0);
  el.play.textContent = "⏸ Pause";
  const delay = () => 1100 - el.speed.value * 100;
  const tick = () => {
    if (cur >= run.steps.length - 1) return stop();
    show(cur + 1);
    timer = setTimeout(tick, delay());
  };
  timer = setTimeout(tick, 250);
}

function stop() {
  clearTimeout(timer);
  timer = null;
  el.play.textContent = "▶ Play";
}

el.play.onclick = () => (timer ? stop() : play());
el.prev.onclick = () => { stop(); show(cur - 1); };
el.next.onclick = () => { stop(); show(cur + 1); };
el.reset.onclick = () => { stop(); show(0); };
el.end.onclick = () => { stop(); show(run.steps.length - 1); };
el.slider.oninput = () => { stop(); show(+el.slider.value); };
el.input.oninput = tokenize;

let debounce;
const retrain = () => { clearTimeout(debounce); debounce = setTimeout(train, 200); };
el.corpus.oninput = retrain;
el.nmerges.oninput = () => { el.nmergesVal.textContent = el.nmerges.value; retrain(); };

document.addEventListener("keydown", (e) => {
  if ((e.target.tagName === "INPUT" && e.target.type === "text") || e.target.tagName === "TEXTAREA") return;
  if (e.key === "ArrowRight") el.next.click();
  else if (e.key === "ArrowLeft") el.prev.click();
  else if (e.key === " ") { e.preventDefault(); el.play.click(); }
});

el.corpus.value = DEFAULT_CORPUS;
train();
