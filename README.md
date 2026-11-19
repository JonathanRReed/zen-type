# Zen Typer

A typing app with the pressure taken out. [Try it](https://zentype.jonathanrreed.com).

Quote Mode tests short passages. Zen Mode lets finished words drift off the screen while your draft stays saved. No account or application backend is required; typed content stays in the browser.

Built by [Jonathan R. Reed](https://jonathanrreed.com/).

## Modes and progress

Quote Mode has 322 passages from 21 writers and a few proverbs, each shown with its book, translator, and year. The clock starts on the first keystroke and stops on the final character. Backspace returns to the earliest uncorrected mistake, and Enter brings the next quote once one is finished. Results show WPM, accuracy, time, and mistakes sorted into wrong keys, early spaces, and missed spaces.

Filter quotes by length or subject, paste your own passage (line breaks and typographic quotes are converted to what a keyboard can type), set a target pace, or save a PNG of the result. Quote Mode handles on-screen keyboards and composed input.

Zen Mode saves drafts that you can reopen, rename, copy, or export as Markdown. Space and Enter finish a word; Backspace edits the current one. An optional timer of 3, 5, or 10 minutes ends with a summary, and a chime if sound is on. Zen Mode is desktop-first.

Progress tracks practice days, streaks, best WPM, average accuracy, and the last 500 sessions. Streaks count calendar days, not rolling 24-hour periods.

## Type, sound, themes, and storage

The site ships its own fonts (see `src/assets/fonts/`): Newsreader for the passage, headings, and numerals, and Hanken Grotesk for controls. The typing font can be switched to Literata, Hanken Grotesk, Atkinson Hyperlegible, JetBrains Mono, or the system font; a font file is fetched only when its family is used.

Sound starts off, and the synthesizer is not downloaded until it is turned on. Six keyboard profiles and four ambient sounds use Web Audio rather than audio files.

Nine themes have cursor- and typing-responsive WebGL2 backgrounds: eight dark scenes built on the Rosé Pine palette, and Washi, a light one (ink on paper). Reduced motion freezes the scene; low-power mode stops it.

Settings and statistics use `localStorage`; drafts use IndexedDB. Export everything to JSON before clearing browser storage or moving devices. Settings also provides restore, reset-statistics, and delete-everything controls.

## Shortcuts

| Key | Action |
| --- | --- |
| `Tab` | Switch mode from the typing area |
| `Shift + Tab` | Move back to the header |
| `Esc` | Open the menu: settings, drafts, progress, shortcuts, about |
| `Enter` | Next quote, once one is finished |
| `Ctrl / Cmd + D` | Drafts |
| `Ctrl / Cmd + M` | Toggle sound |
| `Ctrl / Cmd + P` | Progress |
| `Ctrl + H` | Help |

## Develop and verify

```bash
bun install
bun run dev
```

The server uses port 4321. `bun run build` writes static output to `dist/`.

```bash
bunx playwright install chromium
bun run verify
```

Verification runs type checks, lint, unit tests, and browser tests. Playwright builds and serves `dist/` through a small Bun server, then tests desktop and Pixel 7 projects. Individual steps are `check`, `lint`, `test:run`, and `test:e2e` through `bun run`.

Set `E2E_SKIP_BUILD=1` only to test an existing `dist/`. `bun run health` adds dependency audits, Knip, oxlint, and React Doctor.

The Verify GitHub Actions workflow runs full and production dependency audits plus these checks on pull requests and pushes to `main`, using pinned Node and Bun versions. Run verification before pushing too; pushes to `main` deploy.

## Code guide

Astro 7 renders static pages; React 19 islands use separate `client:only` roots and communicate through window events. Shared settings in `src/utils/storage.ts` use `useSyncExternalStore`.

Quote Mode's reducer (`src/utils/typingEngine.ts`) applies each keystroke to the latest state, including key repeats and composed input. The passage is rendered as a few text runs rather than one element per character, and the caret is a single element moved with a transform. Ambient scenes share `src/lib/ambient/shader.ts` and a capped, reduced-resolution renderer in `src/lib/ambient/renderer.ts`.

Styles are plain CSS in `src/styles/`, layered over Tailwind 4: `tokens.css` (fonts, palette, the ink scale), `themes.css`, `app.css` (the typing stage and dialogs), `controls.css` (native selects, switches, and sliders, restyled), `zen.css`, `pages.css`, and `drafts.css`. Every color is a CSS variable, so a theme is a block of variables plus a scene in the shader.

Components, hooks, layouts, pages, and styles live in their matching `src/` directories. `src/layouts/AppLayout.astro` is the shell for the three app routes and `PageLayout.astro` is the reading pages. `src/lib/` also holds the Dexie draft store; `src/utils/` holds quotes, audio, backup, sharing, and statistics helpers. Browser tests are in `e2e/`.

## Quote sources

`scripts/quotes/build_quotes.py` generates `public/quotes.json` from a hand-picked list. `scripts/quotes/extract.py` gathers candidates from Project Gutenberg editions. Preserve each quote's author and source when editing the catalog.

Suggest additions through the [contact page](https://zentype.jonathanrreed.com/contact/) with the exact quote, author, and edition.

## Social image

`public/og-image.png` is rendered from `scripts/og/og.html` with `bun scripts/og/render.ts`.

## License

[MIT](LICENSE). Palette by [Rosé Pine](https://rosepinetheme.com/). Fonts are under the SIL Open Font License; their notices are in `src/assets/fonts/licenses/`.
