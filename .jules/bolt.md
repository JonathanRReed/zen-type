## 2025-05-18 - Pre-compile RegExp for passive voice check in grammar tool
**Learning:** `checkGrammar` in `src/lib/grammar.ts` was repeatedly dynamically compiling a complex `RegExp` constructed from dozens of string indicators on every run during editor updates.
**Action:** Pre-compile `RegExp` instances at module load time outside hot path functions, taking care to reset `lastIndex = 0` before match loops when using global (`/g`) matching.
