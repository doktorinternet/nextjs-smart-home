import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      screens: {
        md: '1024px'
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
      colors: {
        time_table: 'rgb(var(--bg-section))',
        dark_gray: '#4a4a4a',
        light_gray: '#989898'
      },
      spacing: {
        1: '1px',
        8: '8px',
        12: '12px',
        24: '24px',
        100: '100px',
        // 900: '1024px'
        1024: '920px'
      },
      borderRadius: {
        md: '10px'
      }
    }
  },
  plugins: []
};
export default config;
