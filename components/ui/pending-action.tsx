import type { ReactNode } from "react";

import { buttonStyles } from "./button";

type PendingActionProps = {
  /** What still has to be connected before the action works. */
  requires: string;
  variant?: "primary" | "secondary" | "ghost" | "accent" | "danger";
  size?: "sm" | "md";
  className?: string;
  children: ReactNode;
};

/**
 * Button for an action that is designed but not wired yet. It stays visible so
 * the screen shows its final shape, and says why it cannot be used.
 */
export function PendingAction({ requires, variant, size, className, children }: PendingActionProps) {
  return (
    <button
      type="button"
      disabled
      title={`Disponível ao conectar ${requires}`}
      className={buttonStyles({ variant, size, className })}
    >
      {children}
    </button>
  );
}
