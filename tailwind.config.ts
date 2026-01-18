import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Apple-inspired color palette
        background: "#ffffff",
        "secondary-bg": "#f5f5f7",
        "text-primary": "#1d1d1f",
        "text-secondary": "#86868b",
        "accent-blue": "#007aff",
        "accent-green": "#34c759",
        "accent-red": "#ff3b30",
        "accent-orange": "#ff9500",
        "accent-yellow": "#ffcc00",
        "accent-purple": "#af52de",
        "border-light": "#d2d2d7",
      },
      fontFamily: {
        sans: [
          "SF Pro Display",
          "SF Pro Text",
          "-apple-system",
          "BlinkMacSystemFont",
          "system-ui",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      borderRadius: {
        apple: "12px",
        "apple-lg": "16px",
        "apple-xl": "20px",
      },
      boxShadow: {
        apple: "0 4px 12px rgba(0, 0, 0, 0.08)",
        "apple-lg": "0 8px 24px rgba(0, 0, 0, 0.12)",
      },
    },
  },
  plugins: [],
};

export default config;
