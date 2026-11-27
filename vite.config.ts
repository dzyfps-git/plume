import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

export default defineConfig({
  plugins: [solid()],
  clearScreen: false,
  server: { port: 1430, strictPort: true },
  // The overlay and the second screen are pages of their own, so they load none of the main window.
  build: { target: "chrome120", rollupOptions: { input: { main: "index.html", overlay: "overlay.html", second: "second.html" } } },
});
