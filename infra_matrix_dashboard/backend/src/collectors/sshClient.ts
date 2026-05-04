import fs from "node:fs";
import { Client } from "ssh2";
import type { AppConfig } from "../types/models.js";

export class SshClient {
  constructor(private readonly config: AppConfig) {}

  exec(command: string, timeoutMs = 25_000): Promise<{ stdout: string; stderr: string; code: number | null }> {
    return new Promise((resolve, reject) => {
      const conn = new Client();
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          conn.end();
          reject(new Error(`SSH command timed out after ${timeoutMs}ms`));
        }
      }, timeoutMs);

      const finish = (fn: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        fn();
      };

      const connectConfig: Record<string, unknown> = {
        host: this.config.ssh.host,
        port: this.config.ssh.port,
        username: this.config.ssh.user,
        readyTimeout: timeoutMs
      };

      if (this.config.ssh.keyPath) {
        connectConfig.privateKey = fs.readFileSync(this.config.ssh.keyPath);
      } else if (this.config.ssh.password) {
        connectConfig.password = this.config.ssh.password;
      }

      conn
        .on("ready", () => {
          conn.exec(command, (err, stream) => {
            if (err) {
              finish(() => reject(err));
              return;
            }
            let stdout = "";
            let stderr = "";
            stream
              .on("close", (code: number | null) => {
                conn.end();
                finish(() => resolve({ stdout, stderr, code }));
              })
              .on("data", (data: Buffer) => {
                stdout += data.toString("utf8");
              });
            stream.stderr.on("data", (data: Buffer) => {
              stderr += data.toString("utf8");
            });
          });
        })
        .on("error", (err) => finish(() => reject(err)))
        .connect(connectConfig);
    });
  }
}
