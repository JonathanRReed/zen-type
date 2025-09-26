# Zen Type

Zen Type is a typing app built with Astro 5 and React 19, themed with the Rosé Pine palette. It includes an open-ended Zen mode and a quote practice mode, sharing a consistent UI styled with Tailwind CSS.

## Overview

- **Framework**: Astro 5 with islands powered by React 19 components in `src/components/`
- **Runtime**: Bun-first workflow for development, builds, and testing
- **Styling**: Tailwind CSS layered over a custom Rosé Pine design system in `src/styles/globals.css`
- **Routing**: Two primary surfaces, `src/pages/zen.astro` and `src/pages/quote.astro`, backed by shared stateful React hooks
- **Storage**: Local persistence via `src/utils/storage.ts` so sessions, streaks, and preferences stay with the device

## Key Experiences

### Zen Mode

- `ZenCanvas.tsx` renders floating word tokens and session overlays
- Session markers, ghost text recovery, and local analytics keep longer sessions consistent
- Theme presets (Void, Forest, Ocean, Cosmic) adjust gradients while keeping Rosé Pine core colors

### Quote Mode

- `QuoteTyper.tsx` tracks accuracy and WPM for curated quotes
- Live region announcements surface progress for screen reader users
- Export helpers in `src/utils/export.ts` create shareable session summaries

## Rosé Pine Design Language

- **Base** `#191724` and **Overlay** `#26233a` drive the dark surfaces and glassmorphism
- **Text** `#e0def4` provides primary legibility across backgrounds
- Accents **Foam** `#9ccfd8`, **Iris** `#c4a7e7`, and **Gold** `#f6c177` are used for focus rings, metrics, and highlights
- High contrast and reduced motion toggles reuse the same palette to meet accessibility preferences
- CSS custom properties in `src/styles/globals.css` map directly to Rosé Pine reference values

## Architecture

- **Astro islands** host React components such as `AboutPanel.tsx`, `StatsBar.tsx`, and `SettingsPanel.tsx`
- **State Management** leverages hooks in `src/hooks/`, including motion preference detection and session state machines
- **Utilities** in `src/utils/` handle Dexie-backed archives, quote hydration, web vitals logging, and preference schemas
- **Testing** sits alongside components using Vitest and Testing Library for realistic interaction checks

## Getting Started

### Prerequisites

- Bun v1.0+
- Node.js 18+ (only required for ecosystem tooling)
- Modern browser with hardware acceleration enabled

### Installation & Dev Server

```bash
git clone <your-repo-url>
cd zen-type

bun install
bun run dev
```

### Production Build & Preview

```bash
bun run build
bun run preview
```

The build step emits an optimized static bundle with on-demand React islands, manual Rollup chunks, and image service support.

## Scripts

- `bun run dev` – Astro dev server with HMR and Bun runtime
- `bun run build` – Production bundle targeting static output
- `bun run preview` – Serve the built site locally for smoke testing
- `bun run lint` – ESLint with Astro, React, and accessibility presets
- `bun run check` – `astro check` type-safety and content validation
- `bun run test` / `bun run test:run` / `bun run test:coverage` – Vitest suites for components and utilities

## Project Structure

```text
src/
├── components/      # React islands (Overlays, StatsBar, SettingsPanel, etc.)
├── hooks/           # Motion preference, session logic, and timers
├── pages/           # Astro surfaces: zen.astro, quote.astro, and supporting routes
├── styles/          # globals.css contains Rosé Pine tokens and Tailwind layers
├── types/           # Ambient type declarations (e.g., Astro font modules)
└── utils/           # Storage, quotes, export, and performance helpers
```

## Accessibility

- **Keyboard first**: full tab navigation, skip links, and visible focus states
- **Screen reader friendly**: live regions and ARIA descriptors cover both typing modes
- **Motion sensitivity**: `useMotionPreference()` disables non-essential animations when reduced motion is requested
- **High contrast**: a high contrast toggle raises color contrast using the Rosé Pine Love and Foam values

## Contribution Guide

1. Fork and branch from `main`
2. `bun run lint` and `bun run test:run` before opening a PR
3. Keep Rosé Pine theming consistent by reusing CSS custom properties
4. Document new keyboard shortcuts or overlays directly in this README

## License

This project is licensed under the MIT License. See `LICENSE` for details.

## Acknowledgements

- **Rosé Pine** for the color palette
- **Astro** for the application framework
- **React** for island interactivity
- **Tailwind CSS** for utility styling
- **Bun** for the development runtime

---

Maintained by the Zen Type team.
