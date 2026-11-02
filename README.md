# BPE Visualizer

An interactive web app that shows how Byte-Pair Encoding (BPE) tokenizes a sentence. Type a sentence and watch its characters merge, one learned rule at a time, into the final tokens.

The app is plain HTML, CSS and JavaScript. It has no dependencies and no build step.

## Running the app

Open `index.html` directly in a browser, or serve the folder with any static server:

```
python3 -m http.server 8000
```

Then visit http://localhost:8000.

## How it works

1. **Training.** The app learns merge rules from a training corpus using the standard BPE algorithm (Sennrich et al., 2016):
   - Text is lowercased and split into words and punctuation marks.
   - Each word becomes a sequence of characters followed by an end-of-word marker, shown as `▁` in the interface.
   - The most frequent adjacent pair of symbols is repeatedly merged into a new symbol. A pair must occur at least twice to be merged.
   - The ordered list of merges is the tokenizer.
2. **Tokenizing.** The input sentence is split into characters, and the learned merges are applied in the order they were learned.
3. **Visualization.** Every merge rule that changes the input becomes one step. You can play, pause and step through them.

The vocabulary is the set of base characters seen in the corpus plus one entry per merged token. Each token is shown with its vocabulary ID. Characters not seen in training stay as single characters and show `unk` as their ID.

## Using the interface

- **Sentence:** the text to tokenize. Results update as you type.
- **Playback controls:** Reset, Prev, Play/Pause, Next and End, plus a step slider and a speed control.
- **Keyboard:** left and right arrow keys step backward and forward, and Space plays or pauses (when focus is not in a text box).
- **Chip colors:**
  - Green outline: tokens created by the current merge.
  - Dashed amber outline: the pair that will merge on the next step.
  - Tinted background: multi-character tokens, colored by their content.
- **Merge rules used:** lists the rules that apply to the current input. The current rule is highlighted, and clicking a rule jumps to that step.
- **Final tokens:** the tokens at the current step with their vocabulary IDs, along with the token count, the initial symbol count and the compression ratio.
- **Training settings:** edit the training corpus and set the number of merges (1 to 300). The tokenizer retrains automatically, so you can see how different data changes the result.

## Project structure

| File | Purpose |
| --- | --- |
| `index.html` | Page structure |
| `style.css` | Styling, including light and dark themes |
| `bpe.js` | BPE training and step-by-step tokenization logic |
| `app.js` | UI state, rendering, playback and event handling |

## Notes and limitations

- The default corpus is small, so the learned merges are tuned to it. Paste a larger corpus in the training settings for more realistic merges.
- Tokenization works on Unicode characters, not bytes, so this is character-level BPE rather than the byte-level variant used by some production tokenizers.
- All input is lowercased before tokenizing.
