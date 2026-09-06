# Zen Typer

A typing app with the pressure taken out. [Try it](https://zentype.jonathanrreed.com).

Quote Mode tests short passages. Zen Mode lets finished words drift off the screen while your draft stays saved. No account or application backend is required; typed content stays in the browser.

Built by [Jonathan R. Reed](https://jonathanrreed.com/).

## Modes and progress

Quote Mode has 322 quotes from 22 writers, each linked to a public-domain edition. The clock starts on the first keystroke and stops on the final character. Backspace returns to the earliest uncorrected mistake. Results show WPM, accuracy, wrong keys, skipped characters, and extras.

Filter quotes by length or tag, paste your own passage, or export a PNG result card. Quote Mode handles on-screen keyboards and composed input.

Zen Mode saves drafts that you can reopen, rename, copy, or export as Markdown. Space and Enter finish a word; Backspace edits the current one. Optional sessions last 5 to 60 minutes and end with a chime and summary. Zen Mode is desktop-first.

Progress tracks practice days, streaks, best WPM, average accuracy, and the last 500 sessions. Streaks count calendar days, not rolling 24-hour periods.

## Sound, themes, and storage

Sound starts off. Six synthesized keyboard profiles and four ambient sounds use Web Audio rather than downloaded audio files.

Eight Rosé Pine-based themes have cursor- and typing-responsive WebGL2 backgrounds. Reduced motion freezes the scene; Performance mode disables it.

Settings and statistics use `localStorage`; drafts use IndexedDB. Export everything to JSON before clearing browser storage or moving devices. Settings also provides restore, reset-statistics, and delete-everything controls.

## Shortcuts

| Key | Action |
| --- | --- |
| `Tab` | Switch mode from the typing area |
| `Shift + Tab` | Move back to the header |
| `Esc` | Open pause, settings, drafts, progress, and about |
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

There is no CI. Run verification before pushing; pushes to `main` deploy.

## Code guide

Astro 7 renders static pages; React 19 islands use separate `client:only` roots and communicate through window events. Shared settings in `src/utils/storage.ts` use `useSyncExternalStore`.

Quote Mode's reducer applies each keystroke to the latest state, including key repeats and composed input. Ambient scenes share `src/lib/ambient/shader.ts` and a capped, reduced-resolution renderer in `src/lib/ambient/renderer.ts`. Tailwind 3 exposes palette values through CSS variables.

Components, hooks, pages, and styles live in their matching `src/` directories. `src/lib/` also holds the Dexie draft store; `src/utils/` holds quotes, audio, backup, sharing, and statistics helpers. Browser tests are in `e2e/`.

## Quote sources

`scripts/quotes/build_quotes.py` generates `public/quotes.json` from a hand-picked list. `scripts/quotes/extract.py` gathers candidates from Project Gutenberg editions. Preserve each quote's author and source when editing the catalog.

Suggest additions through the [contact page](https://zentype.jonathanrreed.com/contact/) with the exact quote, author, and edition.

## License

[MIT](LICENSE). Palette by [Rosé Pine](https://rosepinetheme.com/).
