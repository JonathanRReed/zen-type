# Zen Typer

A typing app with the pressure taken out. Live at [zentype.jonathanrreed.com](https://zentype.jonathanrreed.com).

Quote Mode is a typing test on short passages from public-domain books. Zen Mode is a blank canvas where the words you finish drift off the screen and the session keeps its own time. There is no account, no server, and nothing you type leaves the browser.

Built by [Jonathan R. Reed](https://jonathanrreed.com/).

## What it does

**Quote Mode.** 322 quotes from 22 writers, each traced to a public-domain edition. The clock starts on your first keystroke and stops on the last character, so reading the quote first is free. Backspace jumps back to your earliest uncorrected mistake instead of one character at a time. At the end you get WPM, accuracy, and your mistakes sorted into wrong keys, skipped characters, and extras. You can filter the pool by length and by tag (stoic, tao, zen, nature, craft, and so on), paste your own text, and download a PNG card of the result.

**Zen Mode.** Type and keep typing. Each word you finish becomes a particle that drifts up and fades. The stats bar counts words and time. Everything you write is saved as a draft you can reopen, rename, copy, or export as Markdown. A timed flow of 5 to 60 minutes ends with a chime and a summary.

**Progress.** A calendar of the days you practiced, your streak, best WPM, average accuracy, and the last 500 sessions. Streaks count calendar days, so a late night followed by an early morning is two days.

**Sound, off by default.** Six procedurally synthesized switch profiles (thock, cream, holy panda, clicky, typewriter with a bell on Enter, raindrop) and four ambient beds (rain, wind, fire, drone). No audio files ship with the app. Everything comes out of Web Audio nodes at runtime, so it is a few kilobytes of code and it never fails to load.

**Themes.** Eight of them, built on the Rosé Pine palette: Void, Cosmic, Aurora, Ocean, Glacier, Forest, Ember, Sakura. Each has a WebGL2 scene behind the page that reacts to your cursor and your typing. Reduced motion freezes it to a single frame. Performance mode turns it off.

**Your data is yours.** Settings and stats live in localStorage, drafts in IndexedDB. One button exports everything to a JSON file, another restores it on a different machine. Reset stats and delete-everything buttons are in the same place.

**Phones work.** Quote Mode handles on-screen keyboards, composed input, and the keyboard inset. Zen Mode is desktop-first but fits.

## Shortcuts

| Key | Does |
| --- | --- |
| Tab | Switch mode (from the typing surface) |
| Shift + Tab | Step back to the header |
| Esc | Pause menu, with settings, drafts, progress, and about |
| Ctrl / Cmd + D | Drafts |
| Ctrl / Cmd + M | Sound on or off |
| Ctrl / Cmd + P | Progress |
| Ctrl + H | Help |

In Zen Mode, Space and Enter commit a word, and Backspace edits the word in progress.

## Run it

You need [Bun](https://bun.sh/).

```bash
bun install
bun run dev
```

The dev server runs on port 4321. `bun run build` writes a static site to `dist/`.

## Verify it

```bash
bun run verify
```

That runs the type check, the linter, the unit tests, and the browser tests in that order. The browser tests build the site, serve `dist/` from a small Bun static server, and drive it with Playwright in a desktop project and a Pixel 7 project. The first run needs the Chromium build:

```bash
bunx playwright install chromium
```

The individual steps are `bun run check`, `bun run lint`, `bun run test:run`, and `bun run test:e2e`. Set `E2E_SKIP_BUILD=1` to run the browser tests against whatever is already in `dist/`.

`bun run health` is the slower maintenance pass: the dependency audit, knip for dead code and unused packages, oxlint, and react-doctor.

There is no CI. Run `verify` before you push; a push to `main` deploys.

## How it is built

Astro 7 renders the pages as static HTML. The interactive parts are React 19 islands mounted with `client:only`, which means each island is its own React root and they talk to each other through custom events on `window` (`settingsChanged`, `togglePause`, `newQuote`, `resetSession`, and friends). Settings go through one store in `src/utils/storage.ts` that every island reads with `useSyncExternalStore`.

The typing engine in Quote Mode is a reducer. Each keystroke is applied against the latest state, so a burst of key repeats or a word composed on a phone keyboard cannot land on a stale cursor.

The ambient scenes are one fragment shader in `src/lib/ambient/shader.ts` with a scene per theme, rendered by `src/lib/ambient/renderer.ts` at a capped frame rate and reduced resolution.

Tailwind 3 with the palette exposed through CSS variables, so the theme can change at runtime and opacity modifiers like `bg-tint/20` still work.

```text
src/
  components/    React islands and the shadcn-style primitives they use
  hooks/         useSettings, useKeyboardInset, useMotionPreference
  lib/           ambient shader and renderer, the Dexie draft store
  pages/         index, quote, zen, about, privacy, contact, subprocessors, whats-new, 404
  styles/        globals.css: tokens, themes, and the few components that are pure CSS
  utils/         storage, quotes, audio engine, backup, share card, live stats
e2e/             Playwright specs and helpers
scripts/         the static server the browser tests use
public/          quotes.json, fonts, icons, llms.txt
```

## Quotes

`public/quotes.json` is generated by `scripts/quotes/build_quotes.py`, which holds the hand-picked list. The candidates it was picked from came out of `scripts/quotes/extract.py`, which downloads public-domain editions from Project Gutenberg and pulls out sentences that stand on their own. Every entry has an author and a source. If you have a quote to suggest, send the quote, the author, and the edition it comes from through the [contact page](https://zentype.jonathanrreed.com/contact/).

## License

MIT. See [LICENSE](LICENSE).

The palette is [Rosé Pine](https://rosepinetheme.com/).
