import type { Config } from "tailwindcss";

export default {
  content: ["./frontend/index.html", "./frontend/src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        matrix: {
          bg: "#030706",
          panel: "#07110d",
          line: "#123326",
          green: "#35ff93",
          cyan: "#31d7ff",
          amber: "#ffcc66",
          red: "#ff4d6d"
        }
      },
      boxShadow: {
        glow: "0 0 24px rgba(53, 255, 147, 0.18)",
        cyan: "0 0 22px rgba(49, 215, 255, 0.16)"
      },
      fontFamily: {
        mono: ["JetBrains Mono", "Consolas", "monospace"],
        sans: ["Inter", "Segoe UI", "Arial", "sans-serif"]
      }
    }
  },
  plugins: []
} satisfies Config;
