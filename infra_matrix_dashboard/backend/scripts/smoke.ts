import { loadConfig } from "../src/config.js";
import { MonitoringService } from "../src/services/monitoringService.js";
import { InMemoryStore } from "../src/services/memoryStore.js";

const config = loadConfig();
const store = new InMemoryStore();
const monitor = new MonitoringService(config, store);
const snapshot = await monitor.collectOnce();
const health = monitor.health();

console.log("SMOKE_OK");
console.log(`mode=${snapshot.mode}`);
console.log(`connectionOk=${health.connectionOk}`);
console.log(`degraded=${health.degraded}`);
if (health.reason) console.log(`reason=${health.reason}`);
console.log(`jobs=${snapshot.jobs.length}`);
console.log(`workers=${snapshot.workers.length}`);
console.log(`logs=${snapshot.logs.length}`);
console.log(`alerts=${snapshot.alerts.length}`);
