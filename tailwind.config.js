/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1c2a2a",
        mist: "#f3ede1",
        coral: "#ee6c4d",
        sea: "#2a9d8f",
      },
      boxShadow: {
        glow: "0 24px 80px -30px rgba(42, 157, 143, 0.65)",
      },
      keyframes: {
        drift: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
      },
      animation: {
        drift: "drift 8s ease-in-out infinite",
      },
    },
  },
  plugins: [],
}

