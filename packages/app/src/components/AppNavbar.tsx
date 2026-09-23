import { Boxes, Maximize2, Minus, Moon, Sun, X } from "lucide-react";
import { Button } from "@electron-bun-starter/ui";
import { useServerStatus } from "../useServerStatus";

declare global {
  interface Window {
    windowControls?: {
      minimize: () => void;
      toggleMaximize: () => void;
      close: () => void;
    };
  }
}

type AppNavbarProps = {
  readonly isDark: boolean;
  readonly onToggleTheme: () => void;
};

export function AppNavbar({ isDark, onToggleTheme }: AppNavbarProps) {
  const controls = window.windowControls;
  const server = useServerStatus();

  return (
    <header className="app-drag-region flex h-12 shrink-0 select-none items-center justify-between border-b bg-background">
      <div className="flex h-full items-center gap-2.5 px-4">
        <div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Boxes className="size-3.5" aria-hidden="true" />
        </div>
        <span className="text-sm font-medium tracking-tight">electron-bun-starter</span>
        <span className="ml-1 hidden text-xs text-muted-foreground sm:inline">Welcome</span>

        <div
          className="ml-2 flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground"
          title={server.error ? `Server: ${server.error}` : `Connected to Bun on ${server.data?.runtime ?? "local"}`}
        >
          <span
            className={`size-1.5 rounded-full ${
              server.isConnected
                ? "bg-emerald-500"
                : server.isChecking
                  ? "bg-amber-400 animate-pulse"
                  : "bg-rose-500"
            }`}
            aria-hidden="true"
          />
          <span className="hidden md:inline">
            {server.isConnected ? "Bun online" : server.isChecking ? "Connecting..." : "Offline"}
          </span>
        </div>
      </div>

      <div className="app-no-drag flex h-full items-center" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
        <Button
          className="app-no-drag h-12 w-11 rounded-none"
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
          variant="ghost"
          size="icon"
          aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
          title={isDark ? "Switch to light theme" : "Switch to dark theme"}
          onClick={onToggleTheme}
        >
          {isDark ? <Sun className="size-4 pointer-events-none" aria-hidden="true" /> : <Moon className="size-4 pointer-events-none" aria-hidden="true" />}
        </Button>

        {controls && (
          <>
            <span className="mx-1 h-4 w-px bg-border" aria-hidden="true" />
            <Button
              className="app-no-drag h-12 w-11 rounded-none"
              style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
              variant="ghost"
              size="icon"
              aria-label="Minimize window"
              title="Minimize"
              onClick={() => controls.minimize()}
            >
              <Minus className="size-4 pointer-events-none" aria-hidden="true" />
            </Button>
            <Button
              className="app-no-drag h-12 w-11 rounded-none"
              style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
              variant="ghost"
              size="icon"
              aria-label="Maximize or restore window"
              title="Maximize or restore"
              onClick={() => controls.toggleMaximize()}
            >
              <Maximize2 className="size-3.5 pointer-events-none" aria-hidden="true" />
            </Button>
            <Button
              className="app-no-drag h-12 w-12 rounded-none hover:bg-destructive hover:text-destructive-foreground"
              style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
              variant="ghost"
              size="icon"
              aria-label="Close window"
              title="Close"
              onClick={() => controls.close()}
            >
              <X className="size-4 pointer-events-none" aria-hidden="true" />
            </Button>
          </>
        )}
      </div>
    </header>
  );
}
