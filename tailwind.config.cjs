module.exports = {
  content: ["./src/**/*.{astro,tsx,ts,jsx,js}"],
  darkMode: "class",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        // Every palette color is a CSS variable, so plain `var(--x)` values
        // silently drop Tailwind opacity modifiers (`bg-surface/40` compiled
        // to nothing). Routing through color-mix with <alpha-value> makes
        // `/opacity` work while bare classes resolve identically (alpha 1).
        base: "color-mix(in oklab, var(--rp-base) calc(<alpha-value> * 100%), transparent)",
        surface: "color-mix(in oklab, var(--rp-surface) calc(<alpha-value> * 100%), transparent)",
        overlay: "color-mix(in oklab, var(--rp-overlay) calc(<alpha-value> * 100%), transparent)",
        text: "color-mix(in oklab, var(--rp-text) calc(<alpha-value> * 100%), transparent)",
        muted: "color-mix(in oklab, var(--rp-muted) calc(<alpha-value> * 100%), transparent)",
        love: "color-mix(in oklab, var(--rp-love) calc(<alpha-value> * 100%), transparent)",
        gold: "color-mix(in oklab, var(--rp-gold) calc(<alpha-value> * 100%), transparent)",
        rose: "color-mix(in oklab, var(--rp-rose) calc(<alpha-value> * 100%), transparent)",
        pine: "color-mix(in oklab, var(--rp-pine) calc(<alpha-value> * 100%), transparent)",
        foam: "color-mix(in oklab, var(--rp-foam) calc(<alpha-value> * 100%), transparent)",
        iris: "color-mix(in oklab, var(--rp-iris) calc(<alpha-value> * 100%), transparent)",
        // Theme-reactive accents — shift with the active theme so UI never clashes
        tint: "color-mix(in oklab, var(--theme-accent) calc(<alpha-value> * 100%), transparent)",
        tint2: "color-mix(in oklab, var(--theme-accent-2) calc(<alpha-value> * 100%), transparent)",
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        soft: "var(--shadow-soft)"
      },
      backdropBlur: {
        soft: "var(--blur)"
      },
      fontFamily: {
        sans: [
          "var(--ui-font)",
          "Nebula Sans",
          "Inter",
          "Manrope",
          "Space Grotesk",
          "Roboto",
          "system-ui",
          "sans-serif"
        ],
        mono: [
          "var(--typing-font)",
          "JetBrains Mono",
          "Fira Code",
          "IBM Plex Mono",
          "Source Code Pro",
          "ui-monospace",
          "SFMono-Regular",
          "monospace"
        ]
      }
    }
  },
  plugins: []
}
