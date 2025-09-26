module.exports = {
  content: ["./src/**/*.{astro,tsx,ts,jsx,js}"],
  darkMode: "class",
  theme: {
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
        iris: "var(--rp-iris)"
      },
      boxShadow: {
        soft: "var(--shadow-soft)"
      },
      backdropBlur: {
        soft: "var(--blur)"
      },
      fontFamily: {
        sans: ["Nebula Sans", "Inter", "system-ui", "sans-serif"],
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
