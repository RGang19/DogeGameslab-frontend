import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { type Game } from "@/lib/games-data";
import { PixelIcon } from "@/components/term/PixelIcon";
import { Btn, SectionHead } from "@/components/term/Term";
import { GameCard } from "./GameCard";

export function GameRow({
  title,
  games,
  viewAllTo,
}: {
  title: string;
  games: Game[];
  viewAllTo?: string;
}) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "start",
    loop: true,
    dragFree: true,
  });
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(true);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setCanScrollPrev(emblaApi.canScrollPrev());
    setCanScrollNext(emblaApi.canScrollNext());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
      emblaApi.off("reInit", onSelect);
    };
  }, [emblaApi, onSelect]);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    const emblaNode = emblaApi.rootNode();
    let lastWheelTime = 0;
    const handleWheel = (e: WheelEvent) => {
      const isHorizontal = Math.abs(e.deltaX) > Math.abs(e.deltaY);
      const delta = isHorizontal ? e.deltaX : e.deltaY;
      if (Math.abs(delta) < 10) return;
      const now = Date.now();
      if (now - lastWheelTime < 200) return;
      if (delta > 0 && emblaApi.canScrollNext()) {
        emblaApi.scrollNext();
        e.preventDefault();
        lastWheelTime = now;
      } else if (delta < 0 && emblaApi.canScrollPrev()) {
        emblaApi.scrollPrev();
        e.preventDefault();
        lastWheelTime = now;
      }
    };
    emblaNode.addEventListener("wheel", handleWheel, { passive: false });
    return () => emblaNode.removeEventListener("wheel", handleWheel);
  }, [emblaApi]);

  return (
    <section className="px-4 pb-10 sm:px-6 lg:px-8">
      <SectionHead
        title={title}
        action={
          <div className="flex items-center gap-2">
            <Btn
              variant="ghost"
              size="icon"
              onClick={scrollPrev}
              disabled={!canScrollPrev}
              aria-label="Previous games"
            >
              <PixelIcon name="back" size={12} />
            </Btn>
            <Btn
              variant="ghost"
              size="icon"
              onClick={scrollNext}
              disabled={!canScrollNext}
              aria-label="Next games"
            >
              <PixelIcon name="next" size={12} />
            </Btn>
            {viewAllTo && (
              <a href={viewAllTo} className="px-btn" data-variant="ghost" data-size="sm">
                View all
              </a>
            )}
          </div>
        }
      />
      <div
        className="cursor-grab select-none overflow-hidden overscroll-x-contain active:cursor-grabbing"
        ref={emblaRef}
      >
        <div className="flex gap-3">
          {games.map((g, i) => (
            <div
              key={g.title}
              className="min-w-0 shrink-0 grow-0 basis-[46%] sm:basis-[calc(33.333%-8px)] xl:basis-[calc(25%-9px)] 2xl:basis-[calc(20%-10px)]"
            >
              <GameCard game={g} index={i} compact />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
