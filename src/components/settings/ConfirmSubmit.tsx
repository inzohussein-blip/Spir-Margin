"use client";

import type { ReactNode } from "react";

/** A submit button that asks for confirmation before its form is submitted. */
export function ConfirmSubmit({
  confirmText,
  className,
  children,
}: {
  confirmText: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!window.confirm(confirmText)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
