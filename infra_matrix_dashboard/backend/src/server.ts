import fs from "node:fs";
import path from "node:path";
import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import { loadConfig } from "./config.js";
import { MonitoringService } from "./services/monitoringService.js";
import { registerApiRoutes } from "./routes/api.js";
import { InMemoryStore } from "./services/memoryStore.js";

const config = loadConfig();
const app = Fastify({
  logger: {
    level: config.appEnv === "prod" ? "info" : "debug",
    redact: ["req.headers.authorization", "password", "privateKey"]
  }
});

await app.register(cors, {
  origin: config.frontendOrigin,
  credentials: false
});

const store = new InMemoryStore();
const monitor = new MonitoringService(config, store);
await registerApiRoutes(app, { monitor });

const frontendDist = path.resolve(process.cwd(), "frontend", "dist");
if (fs.existsSync(path.join(frontendDist, "index.html"))) {
  await app.register(fastifyStatic, {
    root: frontendDist,
    prefix: "/"
  });
  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith("/api/")) {
      reply.code(404).send({ error: "not_found" });
      return;
    }
    reply.sendFile("index.html");
  });
}

monitor.start();

const shutdown = async () => {
  monitor.stop();
  await app.close();
  process.exit(0);
};

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());

await app.listen({ host: config.apiHost, port: config.apiPort });
app.log.info(`Infra Matrix API listening on http://${config.apiHost}:${config.apiPort}`);
