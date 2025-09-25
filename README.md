# Zen Typer v1.1

A minimalist typing experience with two modes: free-flow Zen typing and structured Quote practice. Built for focus, flow, and mindful practice.

## Features

### Two Distinct Modes

**Zen Mode**: Free-flow typing where words drift upward like thoughts

- Words spawn as floating tokens with physics simulation
- Gentle horizontal sway and upward drift
- Automatic token lifecycle management
- Real-time stats tracking

**Quote Mode**: Type curated Zen quotes with precision

- Character-by-character accuracy tracking
- WPM (Words Per Minute) calculation
- Visual feedback for errors
- Progress milestones with accessibility announcements

### Design

- **Rosé Pine** color scheme optimized for OLED displays
- Glass morphism UI with backdrop blur effects
- Smooth animations with reduced motion support
- High contrast mode for accessibility
- Ambient scene themes (Plain, Forest, Ocean, Cosmic)

## Tech Stack

- **Bun** - JavaScript runtime and package manager
- **Astro** - Static site generator with island architecture
- **React** - Interactive components
- **TypeScript** - Type safety
- **Tailwind CSS** - Utility-first styling

## Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd zen-type

# Install dependencies with Bun
bun install

# Start development server
bun run dev
```

## Commands

| Command | Action |
|---------|--------|
| `bun install` | Install dependencies |
| `bun run dev` | Start dev server at `localhost:4321` |
| `bun run build` | Build for production to `./dist/` |
| `bun run preview` | Preview production build |

## Keyboard Shortcuts

### Global

- `Tab` - Switch between Zen and Quote modes
- `Esc` - Open pause menu
- `F` - Toggle fullscreen
- `T` - Toggle stats bar
- `?` - Show help menu

### Zen Mode

- `Space` - Commit word and spawn token
- `Enter` - Force commit current word
- Punctuation (`.` `,` `!` `?` `;` `:`) - Auto-commits word

### Quote Mode  

- `Backspace` - Correct previous character
- Type naturally to progress through the quote

## Storage & Settings

### Local Storage

- Settings persistence (theme, reduced motion, high contrast)
- Cumulative statistics tracking
- Daily streak counter
- Session history

### Accessibility

- Keyboard-only navigation
- Visible focus indicators
- `prefers-reduced-motion` support
- High contrast toggle
- ARIA live regions for progress announcements
- Screen reader friendly

### Performance

- Input-to-paint latency <16ms
- RAF-based animation loop
- Automatic pause when tab is hidden
- Token pooling with 160 token limit
- Optimized canvas rendering

## Configuration

Settings are stored in localStorage under these keys:

- `zt.settings` - User preferences
- `zt.stats` - Cumulative statistics  
- `zt.streak` - Daily streak counter
- `zt.lastSession` - Most recent session data

## Development

The project structure:

```text
/src
  /components   # React components (ZenCanvas, QuoteTyper, etc.)
  /pages        # Astro pages (index, zen, quote)
  /styles       # Global CSS with design tokens
  /utils        # TypeScript utilities (storage, quotes)
/public
  quotes.json   # Quote database
```

## License

MIT
