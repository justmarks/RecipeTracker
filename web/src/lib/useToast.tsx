import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Toast } from "../components/ui";

interface ToastContextValue {
  /**
   * Fire a confirmation toast. Latest call wins — if a toast is already
   * on screen, the new message replaces it and the visibility timer
   * resets. Pass a short, sentence-case string ("Saved Shepherd's pie").
   */
  show: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const VISIBLE_MS = 2500;
const REMOVE_MS = 2800; // a little after fade so transition completes

/**
 * App-wide toast provider. Sits above the route tree (in main.tsx
 * alongside AuthProvider) so the Toast component persists across
 * navigation — onSubmit handlers can fire show() right before
 * navigate() and the user still sees the confirmation.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [counter, setCounter] = useState(0);

  useEffect(() => {
    if (!message) return;
    setVisible(true);
    const hideAt = setTimeout(() => setVisible(false), VISIBLE_MS);
    const removeAt = setTimeout(() => setMessage(null), REMOVE_MS);
    return () => {
      clearTimeout(hideAt);
      clearTimeout(removeAt);
    };
    // The counter participates in the dep array so a second call with the
    // same string still resets the timer.
  }, [message, counter]);

  const show = useCallback((msg: string) => {
    setMessage(msg);
    setCounter((c) => c + 1);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {message && <Toast visible={visible}>{message}</Toast>}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}
