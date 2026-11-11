// Tells TypeScript that <math-field> (MathLive's custom HTML element) is allowed in JSX.
import type { DetailedHTMLProps, HTMLAttributes } from "react";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "math-field": DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & { placeholder?: string };
    }
  }
}
