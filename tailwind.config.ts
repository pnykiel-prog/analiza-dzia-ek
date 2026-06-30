import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        zielony: { DEFAULT: "#16a34a", bg: "#dcfce7", text: "#166534" },
        zolty: { DEFAULT: "#ca8a04", bg: "#fef9c3", text: "#854d0e" },
        czerwony: { DEFAULT: "#dc2626", bg: "#fee2e2", text: "#991b1b" },
      },
    },
  },
  plugins: [],
};

export default config;
