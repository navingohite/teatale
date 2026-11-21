"use client";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { CircleHelp } from "lucide-react";
type Request = {
  title: string;
  message: string;
  label?: string;
  danger?: boolean;
};
const ConfirmationContext = createContext<(r: Request) => Promise<boolean>>(
  () => Promise.resolve(false),
);
export const useConfirmation = () => useContext(ConfirmationContext);
export function ConfirmationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [request, setRequest] = useState<Request | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  function finish(ok: boolean) {
    dialog.current?.close();
    resolver.current?.(ok);
    resolver.current = null;
    setRequest(null);
  }
  useEffect(() => {
    if (request && !dialog.current?.open) dialog.current?.showModal();
  }, [request]);
  useEffect(
    () => () => {
      resolver.current?.(false);
    },
    [],
  );
  return (
    <ConfirmationContext.Provider
      value={(r) =>
        new Promise((resolve) => {
          resolver.current?.(false);
          resolver.current = resolve;
          setRequest(r);
        })
      }
    >
      {children}
      <dialog
        ref={dialog}
        className="admin-confirm"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
        onCancel={(e) => {
          e.preventDefault();
          finish(false);
        }}
      >
        <div
          className={request?.danger ? "confirm-icon danger" : "confirm-icon"}
        >
          <CircleHelp size={27} />
        </div>
        <p className="confirm-eyebrow">PLEASE CONFIRM</p>
        <h2 id="confirm-title">{request?.title || "Are you sure?"}</h2>
        <p id="confirm-message">{request?.message}</p>
        <div className="confirm-actions">
          <button
            autoFocus
            className="button secondary"
            onClick={() => finish(false)}
          >
            Cancel
          </button>
          <button
            className={`button ${request?.danger ? "danger-button" : ""}`}
            onClick={() => finish(true)}
          >
            {request?.label || "Yes, continue"}
          </button>
        </div>
      </dialog>
    </ConfirmationContext.Provider>
  );
}
