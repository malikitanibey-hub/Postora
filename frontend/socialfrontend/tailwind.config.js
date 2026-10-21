/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{html,js,jsx}"],
  // The `dark:` variants must follow the app theme (the `dark` class is put on
  // <html> in src/App.js), not the operating system preference.
  darkMode: "class",
  theme: {
    extend: {
      colors:{
        primary: "#2764de",
      },
      borderRadius: {
        custom: "12px",
        big: "20px"
      }
    },
  },
  plugins: [],
}