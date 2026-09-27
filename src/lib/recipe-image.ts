import type { CSSProperties } from "react";

export function recipeImageStyle(image: string): CSSProperties {
  // The service returns either a saved image URL or its existing gradient fallback.
  return /^https?:\/\//i.test(image)
    ? {
        backgroundImage: `url(${JSON.stringify(image)})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : { background: image };
}
