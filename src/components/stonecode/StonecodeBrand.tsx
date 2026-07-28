import type { HTMLAttributes } from "react";

export function StonecodeLogoMark({ className = "", ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      {...props}
      aria-hidden="true"
      className={`stonecode-logo-mark${className ? ` ${className}` : ""}`}
    >
      <i />
    </span>
  );
}
