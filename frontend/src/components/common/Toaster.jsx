import { useEffect } from "react";
import useToastStore from "../../store/toastStore";
import { CloseIcon } from "../icons";

function Toast({ toast }) {
  const removeToast = useToastStore((s) => s.removeToast);

  useEffect(() => {
    if (toast.duration <= 0) return;
    const timer = setTimeout(() => removeToast(toast.id), toast.duration);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, removeToast]);

  return (
    <div className={`toast toast--${toast.type}`} role="status" aria-live="polite">
      <span className="toast__message">{toast.message}</span>
      <div className="toast__right">
        {toast.action && (
          <button type="button" className="toast__action" onClick={toast.action.onClick}>
            {toast.action.label}
          </button>
        )}
        <button
          type="button"
          className="toast__close"
          onClick={() => removeToast(toast.id)}
          aria-label="Fermer"
        >
          <CloseIcon width={16} height={16} />
        </button>
      </div>
    </div>
  );
}

export default function Toaster() {
  const toasts = useToastStore((s) => s.toasts);

  return (
    <div className="toaster" aria-live="polite">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
