import {nextui} from '@nextui-org/theme';
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./node_modules/@nextui-org/theme/dist/components/[object Object].js"
  ],
  safelist: [
    'col-span-1',
    'col-span-2',
    'col-span-3',
    'col-span-4',
    'col-span-5',
    'col-span-6',
    'col-span-7',
    'col-span-8',
    'row-span-1',
    'row-span-2',
    'row-span-3',
    'row-span-4',
    'row-span-5',
    'row-span-6',
    'row-span-7',
    'row-span-8',
    'grid-cols-1',
    'grid-cols-2',
    'grid-cols-3',
    'grid-cols-4',
    'grid-cols-5',
    'grid-cols-6',
    'grid-cols-7',
    'grid-cols-8',
    'grid-cols-9',
    'grid-rows-1',
    'grid-rows-2',
    'grid-rows-3',
    'grid-rows-4',
    'grid-rows-5',
    'grid-rows-6',
    'grid-rows-7',
    'grid-rows-8',
    'grid-rows-9',
    'gap-8',
    'gap-10',
    'gap-12',
    {
      pattern: /p-.+/,
    }
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
        4: '4px',
        8: '8px',
        12: '12px',
        24: '24px',
        100: '100px',
        // 900: '1024px'
        1024: '920px'
      },
      borderRadius: {
        md: '10px'
      },
      
    }
    // todo safelist col span grid cols etc
  },
  plugins: [nextui()]};
export default config;
