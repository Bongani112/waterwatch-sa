/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eff8ff",
          100: "#dbeefe",
          200: "#bfe2fe",
          300: "#93d0fd",
          400: "#60b5fa",
          500: "#3b95f6",
          600: "#2577eb",
          700: "#1d61d8",
          800: "#1e4faf",
          900: "#1e458a",
        },
      },
    },
  },
  plugins: [],
};
