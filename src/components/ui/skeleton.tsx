import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("dither animate-shimmer bg-ink-3", className)} {...props} />;
}

export { Skeleton };
