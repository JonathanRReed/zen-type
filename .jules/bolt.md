## 2025-05-18 - Pre-compile RegExp for passive voice check in grammar tool
**Learning:** `checkGrammar` in `src/lib/grammar.ts` was repeatedly dynamically compiling a complex `RegExp` constructed from dozens of string indicators on every run during editor updates.
**Action:** Pre-compile `RegExp` instances at module load time outside hot path functions, taking care to reset `lastIndex = 0` before match loops when using global (`/g`) matching.

## 2025-05-19 - Incremental line tracking in text search loops
**Learning:** `findInText` in `src/lib/textMetrics.ts` was calling `text.substring(0, index).split('\n')` on every query match to calculate line and column numbers. For M matches in a text of length N, this created O(M * N) time complexity and allocated millions of temporary strings for garbage collection.
**Action:** Use single-pass incremental tracking for line count and `lastNewlineIndex` as match indices advance, reducing complexity to O(N) with zero substring array allocations.

## 2025-05-20 - Single-pass text metric calculations
**Learning:** `computeTextMetrics` in `src/lib/textMetrics.ts` was executing `text.trim().split(/\s+/)` and `text.match(/[.!?]+/g)` on every editor update, creating string array allocations for all words and match objects in the document.
**Action:** Replace string split and regex match calls with a single-pass character code iteration (`charCodeAt`) to count words and sentences in O(N) time with zero memory allocations.
