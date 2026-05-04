import type { PropsWithChildren } from "react";
import { X } from "lucide-react";
import { Button } from "./ui/button";

export const SettingsDialog = ({
  title,
  children,
  onSave,
  onCancel,
  onReset
}: PropsWithChildren<{
  title: string;
  onSave: () => void;
  onCancel: () => void;
  onReset: () => void;
}>) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
    <div className="matrix-panel max-h-[88vh] w-full max-w-2xl overflow-hidden rounded-lg border border-matrix-green/35">
      <div className="flex items-center justify-between border-b border-matrix-line p-4">
        <h2 className="font-mono text-sm uppercase tracking-wider text-matrix-green">{title}</h2>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-8 w-8 items-center justify-center rounded border border-matrix-line bg-black/20 text-white/60 hover:border-matrix-cyan hover:text-matrix-cyan"
          aria-label="Закрыть настройки"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="max-h-[62vh] overflow-auto p-4">{children}</div>
      <div className="flex flex-wrap justify-end gap-2 border-t border-matrix-line p-4">
        <Button onClick={onReset}>Сбросить</Button>
        <Button onClick={onCancel}>Отмена</Button>
        <Button onClick={onSave}>Сохранить</Button>
      </div>
    </div>
  </div>
);
