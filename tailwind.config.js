/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#4A4B4D",
        paper: "#F2EEE3",
        card: "#FAF8F3",
        line: "#D8D2C4",
        amber: "#F4791E",
        green: "#4B7355",
        red: "#C7522A",
        steel: "#4A4B4D",
      },
      fontFamily: {
        display: ["'Barlow Condensed'", "sans-serif"],
        body: ["Inter", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
    },
  },
  plugins: [],
};
