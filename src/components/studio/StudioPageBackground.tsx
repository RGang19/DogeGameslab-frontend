import { PixelSprite } from "@/components/term/PixelSprite";

type StudioPageBackgroundProps = {
  className?: string;
};

/**
 * Ambient layer behind every page: a few dim pixel sprites drifting at the
 * edges of wide screens. The dot grid itself lives on <body>.
 */
export function StudioPageBackground({ className = "" }: StudioPageBackgroundProps) {
  return (
    <div
      className={`pointer-events-none fixed inset-0 z-0 hidden overflow-hidden opacity-[0.16] 2xl:block ${className}`}
      aria-hidden="true"
    >
      <PixelSprite
        name="invader"
        scale={5}
        color="var(--phos)"
        frameMs={900}
        className="animate-bob absolute right-[4%] top-[18%]"
      />
      <PixelSprite
        name="ghost"
        scale={4}
        color="var(--magenta)"
        frameMs={700}
        className="animate-bob absolute bottom-[14%] right-[9%]"
      />
      <PixelSprite
        name="coin"
        scale={4}
        frameMs={420}
        className="absolute right-[2.5%] top-[56%]"
      />
    </div>
  );
}
