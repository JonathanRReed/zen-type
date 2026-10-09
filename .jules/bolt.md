## 2025-05-18 - Pre-compile RegExp for passive voice check in grammar tool
**Learning:** `checkGrammar` in `src/lib/grammar.ts` was repeatedly dynamically compiling a complex `RegExp` constructed from dozens of string indicators on every run during editor updates.
**Action:** Pre-compile `RegExp` instances at module load time outside hot path functions, taking care to reset `lastIndex = 0` before match loops when using global (`/g`) matching.

## 2025-05-19 - Incremental line tracking in text search loops
**Learning:** `findInText` in `src/lib/textMetrics.ts` was calling `text.substring(0, index).split('\n')` on every query match to calculate line and column numbers. For M matches in a text of length N, this created O(M * N) time complexity and allocated millions of temporary strings for garbage collection.
**Action:** Use single-pass incremental tracking for line count and `lastNewlineIndex` as match indices advance, reducing complexity to O(N) with zero substring array allocations.

## 2025-05-20 - Single-pass text metric calculations
**Learning:** `computeTextMetrics` in `src/lib/textMetrics.ts` was executing `text.trim().split(/\s+/)` and `text.match(/[.!?]+/g)` on every editor update, creating string array allocations for all words and match objects in the document.
**Action:** Replace string split and regex match calls with a single-pass character code iteration (`charCodeAt`) to count words and sentences in O(N) time with O(1) auxiliary space, without intermediate split/match arrays. Preserve the full ECMAScript whitespace set rather than treating all character codes <= 32 as whitespace. Check parity against the previous implementation, including every UTF-16 code unit; a speedup is not established by these correctness tests.

## 2025-05-21 - Memoize text analysis on draft body instead of draft object
**Learning:** In `DraftManager.tsx`, `useMemo` hooks for derived calculations (`computeTextMetrics`, `extractOutline`, `checkGrammar`, `getKeywordFrequencies`, `findInText`, `recentLines`) depended on `currentDraft`. Any metadata edit (title input, tags, scratchpad notes, background sync) created a new draft object reference, re-running expensive text calculations and string allocations even when body text was unchanged.
**Action:** Extract `draftBody = currentDraft?.body` and use primitive string dependency in `useMemo` hooks so non-body metadata edits completely skip text analysis routines.

## 2026-10-08 - Gate overlay data derivation on modal visibility and scan backward
**Learning:** `recentLines` in `DraftManager.tsx` was executing `draftBody.split('\n').filter(...).slice(-50)` on every single keystroke in the editor even when `CommandPalette` was closed. Scanning from index 0 created full document line string arrays on every keypress.
**Action:** Gate modal data derivation in `useMemo` on `commandPaletteOpen` so closed modals return early in O(1) time. For line extraction from the end of a document, scan backward with `lastIndexOf('\n')` and stop after N matching lines. The result retains at most N lines, but scanning and temporary slices can cover the whole document when too few lines qualify; worst-case work remains O(document length).

## 2026-10-09 - Single-pass keyword frequency extraction
**Learning:** `getKeywordFrequencies` in `src/lib/textMetrics.ts` was executing `text.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/).filter(...)` on every keystroke when `keywordHighlighter` was enabled. This allocated two full-document lowercased/replaced string copies, a word array for all words in the document, and a filtered array.
**Action:** Replace full-document string lowercasing/replace/split/filter chaining with a single-pass character code loop (`charCodeAt`). Skip candidate words with length <= 2 without allocating string objects, slicing and lowercasing only candidate words > 2 characters directly into the frequency map.
