import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./data/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#13254f",
        paper: "#f8f4e8",
        line: "#d8dfef",
        accent: "#1f6fff",
        warm: "#ffbf47",
        mint: "#1ea88b"
      },
      boxShadow: {
        soft: "0 18px 50px rgba(14, 33, 78, 0.08)",
        lift: "0 18px 38px rgba(16, 37, 87, 0.14)"
      },
      backgroundImage: {
        "grid-paper":
          "linear-gradient(rgba(19,37,79,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(19,37,79,0.08) 1px, transparent 1px)"
      },
      fontFamily: {
        body: ["var(--font-body)"],
        display: ["var(--font-display)"]
      }
    }
  },
  plugins: []
};

export default config;
