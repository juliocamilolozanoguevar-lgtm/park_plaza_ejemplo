export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        park: {
          dark: "#0F3D2E",
          green: "#1E7D4B",
          "green-soft": "#E7F4EC",
          gold: "#F5A623",
          "gold-soft": "#FFF3D6",
          black: "#111111",
          white: "#FFFFFF",
          bg: "#F7F8F6",
          border: "#E5E7EB",
          text: "#111111",
          muted: "#6B7280",
          danger: "#E74C3C",
          "danger-soft": "#FDECEC"
        }
      },
      fontFamily: {
        display: ["Poppins", "Inter", "ui-sans-serif", "system-ui"],
        sans: ["Inter", "ui-sans-serif", "system-ui"],
        body: ["Roboto", "Inter", "ui-sans-serif", "system-ui"]
      },
      boxShadow: {
        soft: "0 8px 24px rgba(15, 61, 46, 0.06)",
        card: "0 8px 24px rgba(15, 61, 46, 0.06)",
        dropdown: "0 12px 30px rgba(15, 61, 46, 0.10)",
        drawer: "0 18px 46px rgba(15, 61, 46, 0.16)",
        modal: "0 24px 64px rgba(15, 61, 46, 0.18)"
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
