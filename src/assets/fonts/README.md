# Fonts

Self-hosted variable fonts, Latin subsets, taken unmodified from the
`@fontsource-variable/*` packages (version 5.3). All are licensed under the
SIL Open Font License 1.1, which permits bundling and serving them with the
site. Each family's licence, with its copyright notice, is in `licenses/`.

| File | Family | Used for |
| --- | --- | --- |
| `newsreader-latin-wght-normal.woff2` | Newsreader (Production Type) | The passage, headings, numerals |
| `newsreader-latin-wght-italic.woff2` | Newsreader Italic | Book titles |
| `newsreader-latin-ext-wght-normal.woff2` | Newsreader, Latin Extended | Custom text in other Latin-script languages |
| `hanken-grotesk-latin-wght-normal.woff2` | Hanken Grotesk (Hanken Design Co.) | Controls and labels |
| `literata-latin-wght-normal.woff2` | Literata (TypeTogether) | Optional typing font |
| `atkinson-hyperlegible-next-latin-wght-normal.woff2` | Atkinson Hyperlegible Next (Braille Institute) | Optional typing font |
| `jetbrains-mono-latin-wght-normal.woff2` | JetBrains Mono (JetBrains) | Optional typing font |

Only Newsreader and Hanken Grotesk load on a normal visit. The optional
typing fonts are declared in `src/styles/tokens.css` and fetched by the
browser only when one is chosen in Settings.
