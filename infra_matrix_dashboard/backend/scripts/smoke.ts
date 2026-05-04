import { loadConfig } from "../src/config.js";
import { DashboardDb } from "../src/db/database.js";
import { MonitoringService } from "../src/services/monitoringService.js";

const config = loadConfig();
const db = await DashboardDb.open(config.sqlitePath);
const monitor = new MonitoringService(config, db);
const snapshot = await monitor.collectOnce();

console.log("SMOKE_OK");
console.log(`mode=${snapshot.mode}`);
console.log(`jobs=${snapshot.jobs.length}`);
console.log(`workers=${snapshot.workers.length}`);
console.log(`logs=${snapshot.logs.length}`);
console.log(`alerts=${snapshot.alerts.length}`);
