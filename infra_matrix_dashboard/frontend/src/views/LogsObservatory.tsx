import { AlertTriangle } from "lucide-react";
import type { LogHeartbeat } from "../lib/api";
import { fmtTime } from "../lib/utils";
import { Badge } from "../components/ui/badge";
import { Card, CardHeader, CardTitle } from "../components/ui/card";

export const LogsObservatory = ({ logs }: { logs: LogHeartbeat[] }) => {
  const errors = logs.flatMap((log) => log.topErrors.map((error) => ({ file: log.fileName, error }))).slice(0, 30);
  return (
    <div className="grid gap-4 xl:grid-cols-[1.2fr_.8fr]">
      <Card>
        <CardHeader>
          <CardTitle>Состояние логов</CardTitle>
          <Badge tone="info">{logs.length} файлов</Badge>
        </CardHeader>
        <div className="overflow-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="font-mono text-xs uppercase text-white/45">
              <tr>
                <th className="p-2">файл</th>
                <th className="p-2">последняя запись</th>
                <th className="p-2">строк/мин</th>
                <th className="p-2">ошибки</th>
                <th className="p-2">состояние</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.path} className="border-t border-white/10">
                  <td className="p-2 font-mono text-matrix-cyan">{log.fileName}</td>
                  <td className="p-2 text-white/65">{fmtTime(log.lastWriteAt)}</td>
                  <td className="p-2 text-white/65">{log.linesPerMin}</td>
                  <td className="p-2"><Badge tone={log.errorCount ? "warn" : "ok"}>{log.errorCount}</Badge></td>
                  <td className="p-2"><Badge tone={log.stale ? "crit" : "ok"}>{log.stale ? "не обновляется" : "активен"}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Поток ошибок</CardTitle>
          <AlertTriangle className="h-4 w-4 text-matrix-amber" />
        </CardHeader>
        <div className="grid max-h-[520px] gap-2 overflow-auto pr-1">
          {errors.map((item, index) => (
            <div key={`${item.file}-${index}`} className="rounded border border-matrix-red/20 bg-matrix-red/5 p-2">
              <div className="font-mono text-xs text-matrix-red">{item.file}</div>
              <div className="mt-1 text-xs text-white/65">{item.error}</div>
            </div>
          ))}
          {errors.length === 0 ? <div className="text-sm text-white/50">В последних строках логов сигнатур ошибок нет.</div> : null}
        </div>
      </Card>
    </div>
  );
};
