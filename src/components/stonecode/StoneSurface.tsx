import { createElement, HTMLAttributes } from "react";

type StoneSurfaceProps = HTMLAttributes<HTMLElement> & {
  as?: "article" | "aside" | "div" | "section";
  variant: "card" | "main" | "side";
};

export function StoneSurface({
  as = "div",
  className = "",
  variant,
  ...props
}: StoneSurfaceProps) {
  return createElement(as, {
    ...props,
    className: `stone-surface stone-surface-${variant}${className ? ` ${className}` : ""}`
  });
}
