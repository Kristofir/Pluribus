"use client";

import {
  ColorField as ColorFieldPrimitive,
  type ColorFieldProps,
} from "react-aria-components/ColorField";
import { cx } from "@/lib/Primitive";
import { fieldStyles } from "./Field";

export function ColorField({ className, ...props }: ColorFieldProps) {
  return (
    <ColorFieldPrimitive
      {...props}
      data-slot="control"
      className={cx(fieldStyles(), className)}
    />
  );
}
