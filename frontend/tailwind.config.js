/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      boxShadow: { glow: "0 0 24px rgba(239,68,68,0.18)" },
    },
  },
  plugins: [],
};
