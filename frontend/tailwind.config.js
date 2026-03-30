module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        heading: ["'Outfit'", "sans-serif"],
        body: ["'IBM Plex Sans'", "sans-serif"],
      },
      colors: {
        brand: {
          purple: '#7c3aed',
          pink: '#ec4899',
        },
        dark: {
          base: '#0f0f11',
          surface: '#1a1a2e',
          hover: '#22223b',
        },
      },
    },
  },
  plugins: [],
};
