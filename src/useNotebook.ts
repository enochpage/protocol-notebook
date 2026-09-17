import { useCallback, useEffect, useRef, useState } from "react";
import { seedWorkspace } from "./model";
import type { Workspace } from "./model";
import { loadWorkspace, native, saveWorkspace } from "./storage";

export function useNotebook() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("Opening notebook…");
  const latest = useRef<Workspace | null>(null);
  const saved = useRef<Workspace | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const flush = useCallback(async () => {
    const state = latest.current;
    if (!state || state === saved.current) return;
    const next = queue.current.catch(() => {}).then(() => saveWorkspace(state));
    queue.current = next;
    try {
      await next;
      saved.current = state;
      if (latest.current === state) {
        setStatus(native ? "Saved on this Mac" : "Saved in this browser");
        setError("");
      }
    } catch (e) {
      setStatus("Not saved");
      setError(String(e));
      throw e;
    }
  }, []);
  useEffect(() => {
    let cancelled = false;
    loadWorkspace()
      .then((data) => {
        if (!cancelled) setWorkspace(data || seedWorkspace());
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    latest.current = workspace;
    if (!workspace) return;
    setStatus("Saving…");
    const timer = window.setTimeout(() => {
      void flush().catch(() => {});
    }, 350);
    return () => window.clearTimeout(timer);
  }, [workspace, flush]);
  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => {
      if (latest.current !== saved.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    const save = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "s") {
        event.preventDefault();
        void flush().catch(() => {});
      }
    };
    window.addEventListener("beforeunload", unload);
    window.addEventListener("keydown", save);
    let unsubscribe: (() => void) | undefined;
    let disposed = false;
    if (native)
      void import("@tauri-apps/api/window")
        .then(async ({ getCurrentWindow }) => {
          const windowHandle = getCurrentWindow();
          const unlisten = await windowHandle.onCloseRequested(
            async (event) => {
              event.preventDefault();
              try {
                await flush();
                await windowHandle.destroy();
              } catch {
                /* Keep the window open with the visible save error. */
              }
            },
          );
          if (disposed) unlisten();
          else unsubscribe = unlisten;
        })
        .catch((e) => setError(`Close protection unavailable: ${String(e)}`));
    return () => {
      disposed = true;
      unsubscribe?.();
      window.removeEventListener("beforeunload", unload);
      window.removeEventListener("keydown", save);
    };
  }, [flush]);
  return { workspace, setWorkspace, error, status, flush };
}
