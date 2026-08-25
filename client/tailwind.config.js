export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        park: {
          dark: "#0B1020",
          primary: "#112244",
          accent: "#1E6FD6",
          "accent-soft": "#7EC6FF",
          border: "#E6E9EE",
          white: "#FFFFFF",
          bg: "#F7F8F6",
          black: "#111111",
          muted: "#6B7280",
          danger: "#E74C3C",
          "danger-soft": "#FDECEC"
        }
      },
      fontFamily: {
        display: ["Poppins", "ui-sans-serif", "system-ui"],
        sans: ["Poppins", "ui-sans-serif", "system-ui"],
        body: ["Poppins", "ui-sans-serif", "system-ui"]
      },
      boxShadow: {
        soft: "0 8px 24px rgba(11, 16, 32, 0.06)",
        card: "0 8px 24px rgba(11, 16, 32, 0.06)",
        dropdown: "0 12px 30px rgba(11, 16, 32, 0.10)",
        drawer: "0 18px 46px rgba(11, 16, 32, 0.16)",
        modal: "0 24px 64px rgba(11, 16, 32, 0.18)"
      },
      borderRadius: {
        input: "8px",
        button: "8px",
        card: "12px",
        panel: "16px",
        modal: "16px"
      }
    }
  },
  plugins: []
};
