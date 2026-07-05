import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}", "./lib/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#05070a",
        panel: "#0b0f16",
        line: "rgba(255,255,255,0.10)",
        muted: "#8b94a7",
        volt: "#49ff88",
        cyan: "#1ee7ff"
      }
    }
  },
  plugins: []
};

export default config;
