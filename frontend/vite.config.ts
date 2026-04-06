import fs from "node:fs";
import path from "node:path";

import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, type Plugin } from "vite";

function scenarioProxy(): Plugin {
  const scenariosDir = path.resolve(__dirname, "../mock-sensors/scenarios");
  return {
    name: "scenario-proxy",
    configureServer(server) {
      server.middlewares.use("/scenarios", (req, res, next) => {
        const filePath = path.join(scenariosDir, req.url ?? "");
        if (fs.existsSync(filePath) && filePath.endsWith(".json")) {
          res.setHeader("Content-Type", "application/json");
          fs.createReadStream(filePath).pipe(res);
        } else {
          next();
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), scenarioProxy()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 3000,
    proxy: {
      "/realms": {
        changeOrigin: true,
        target: process.env.KEYCLOAK_INTERNAL_URL ?? "http://localhost:8080",
      },
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/test-setup.ts",
  },
});
