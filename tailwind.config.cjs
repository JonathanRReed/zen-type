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
        base: "var(--rp-base)",
        surface: "var(--rp-surface)",
        overlay: "var(--rp-overlay)",
        text: "var(--rp-text)",
        muted: "var(--rp-muted)",
        love: "var(--rp-love)",
        gold: "var(--rp-gold)",
        rose: "var(--rp-rose)",
        pine: "var(--rp-pine)",
        foam: "var(--rp-foam)",
        iris: "var(--rp-iris)",
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
  plugins: [
    require('@tailwindcss/line-clamp')
  ]
}
