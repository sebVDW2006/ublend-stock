import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#034638",
          dark: "#081e1c",
          light: "#557570",
          muted: "#8da39f",
          bg: "#e8eceb",
        },
      },
      fontFamily: {
        serif: ['"Playfair Display"', "Georgia", "serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
