// Type shim for the ported JS canvas game engine (ThreePreview.jsx).
import type { ReactElement } from "react";
export function ThreePreview(props: {
  gamePackage: any;
  onScoreSubmit?: (score: number) => void;
}): ReactElement;
