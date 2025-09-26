# Zen Typer v1.1

A minimalist typing experience with two modes: free-flow Zen typing and structured Quote practice. Built for focus, flow, and mindful practice.

## Features

### Two Distinct Modes

**Zen Mode**: Free-flow typing where words drift upward like thoughts

- Words spawn as floating tokens with physics simulation
- Gentle horizontal sway and upward drift
- Automatic token lifecycle management
- Real-time stats tracking
- Session markers for progress tracking
- Ghost text recovery for interrupted sessions

**Quote Mode**: Type curated Zen quotes with precision

- Character-by-character accuracy tracking
- WPM (Words Per Minute) calculation
- Visual feedback for errors
- Progress milestones with accessibility announcements
- Session completion with detailed statistics
- Export functionality for sharing results

### Beautiful Design

- Rosé Pine color scheme optimized for OLED displays
- Glass morphism UI with backdrop blur effects
- Smooth animations with reduced motion support
- High contrast mode for accessibility
- Ambient scene themes (Void, Forest, Ocean, Cosmic)
- Responsive design that works on all devices

### Performance Optimized

- Built with Astro 5.x for optimal performance and SEO
- React 19 for modern component architecture
- TypeScript for type safety and developer experience
- Core Web Vitals monitoring and optimization
- Manual code splitting for optimal bundle sizes
- Performance mode for low-power devices

### Accessibility First

- Full keyboard navigation support
- Screen reader compatibility with proper ARIA labels
- Skip links for efficient navigation
- High contrast mode support
- Reduced motion preferences respected
- Focus management and indicators

### Developer Experience

- Comprehensive testing suite with Vitest + React Testing Library
- ESLint configuration with accessibility and React rules
- Error boundaries for graceful error handling
- Hot reload development server
- Bundle analysis tools

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- Modern web browser

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd zen-type

# Install dependencies
npm install

# Start development server
npm run dev
```

### Build for Production

To create an optimized bundle:

```bash
npm run build
npm run preview
```

## Testing

Run the test suite:

```bash
npm run test:run        # Run tests once
npm run test           # Run tests in watch mode
npm run test:coverage  # Run tests with coverage
```

## Performance Monitoring

The application includes Core Web Vitals monitoring that tracks:

- LCP (Largest Contentful Paint): Loading performance
- FID (First Input Delay): Interactivity
- CLS (Cumulative Layout Shift): Visual stability

Performance metrics are logged to the console in development and can be configured to report to analytics services in production.

## Keyboard Shortcuts

### Global

- Tab - Switch between Zen and Quote modes

### Zen Mode

- Space - Commit word and spawn token
- Enter - Force commit current word
- Punctuation (. , ! ? ; :) - Auto-commits word

### Quote Mode

- Backspace - Correct previous character
- Type naturally to progress through the quote

## Configuration

### Settings

Access the settings panel through the pause menu to customize:

- Theme: Void, Forest, Ocean, or Cosmic
- Profiles: Minimal, Practice, or Meditative
- Animation Speed: Fade duration and drift amplitude
- Accessibility: Reduced motion and high contrast options
- Performance: Performance mode for low-power devices
- Quote Mode: Auto-advance settings

### Storage

All settings and progress are stored locally in your browser:

- Settings persist across sessions
- Statistics are tracked and displayed
- Archive of Zen mode sessions
- Streaks and achievements

## Architecture

### Tech Stack

- Framework: Astro 5.x with React 19
- Language: TypeScript
- Styling: Tailwind CSS with custom design system
- Testing: Vitest + React Testing Library
- Linting: ESLint with accessibility and React rules
- Performance: Core Web Vitals monitoring

### Project Structure

```text
src/
├── components/          # React components
│   ├── ErrorBoundary.tsx
│   ├── SettingsPanel.tsx
│   ├── AboutPanel.tsx
│   └── ...
├── pages/              # Astro pages
│   ├── zen.astro
│   └── quote.astro
├── utils/              # Utility functions
│   ├── storage.ts      # Local storage management
│   ├── quotes.ts       # Quote loading and management
│   └── webvitals.ts    # Performance monitoring
├── styles/             # Global styles
└── test/               # Test setup and utilities
```

### Component Architecture

- Error Boundaries: Graceful error handling with user-friendly fallbacks
- Performance Monitoring: Real-time Core Web Vitals tracking
- Accessibility: ARIA labels, keyboard navigation, and screen reader support
- Responsive Design: Mobile-first approach with fluid layouts

## Design System

### Colors (Rosé Pine Palette)

- Base: #191724 - Primary background
- Surface: #1f1d2e - Secondary background
- Overlay: #26233a - Tertiary background
- Text: #e0def4 - Primary text
- Foam: #9ccfd8 - Accent color (calm)
- Iris: #c4a7e7 - Accent color (focus)
- Gold: #f6c177 - Accent color (warmth)
- Rose: #ea9a97 - Accent color (energy)
- Love: #eb6f92 - Accent color (error)

### Typography

- Headings: Inter font family
- Monospace: JetBrains Mono for code and stats
- Responsive sizing: Fluid typography with clamp()

### Spacing

- Consistent spacing scale using Tailwind's spacing system
- Glass morphism effects with backdrop blur
- Subtle shadows and borders for depth

## Security

- No external API calls that could leak sensitive data
- All data stored locally in browser storage
- XSS protection through proper input sanitization
- Content Security Policy ready

## Features in Detail

### Zen Mode Details

- Free-form typing with floating word tokens
- Configurable fade speed and drift patterns
- Session markers for progress tracking
- Ghost text recovery for interrupted sessions
- Archive system for saving meaningful text

### Quote Mode Details

- Curated collection of inspiring quotes
- Real-time accuracy and WPM tracking
- Visual pacing cues and progress indicators
- Session completion with detailed statistics
- Export functionality for sharing results

### Analytics & Tracking

- Local statistics storage (no external tracking)
- Performance metrics (Core Web Vitals)
- Session history and progress tracking
- Streak counting and achievements

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run the test suite
6. Submit a pull request

### Development Guidelines

- Follow TypeScript best practices
- Include proper error handling
- Add accessibility features
- Write comprehensive tests
- Update documentation as needed

## License

MIT

## Acknowledgments

- Rosé Pine: Beautiful color palette by Emilia
- Astro: Modern web framework
- React: Component library
- TypeScript: Type safety
- Tailwind CSS: Utility-first CSS framework

---

Built with love for mindful typing and focused flow.
