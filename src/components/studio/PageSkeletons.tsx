import type { ReactNode } from "react";
import { Block, TermLoader } from "@/components/term/Term";

function PageShell({ children, label = "Loading" }: { children: ReactNode; label?: string }) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <TermLoader label={label} className="mb-5" />
      {children}
    </div>
  );
}

function CardBlocks({ count = 8, className = "" }: { count?: number; className?: string }) {
  return (
    <div className={`grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 ${className}`}>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="border-2 border-line bg-ink-2">
          <Block className="aspect-[4/3] w-full" />
          <div className="space-y-2 p-2.5">
            <Block className="h-3 w-3/4" />
            <Block className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function RoutePendingSkeleton() {
  return (
    <PageShell>
      <Block className="mb-6 h-10 w-full max-w-md" />
      <CardBlocks count={6} />
    </PageShell>
  );
}

export function HomeFeedSkeleton() {
  return (
    <PageShell label="Mounting cartridges">
      <Block className="mb-8 h-56 w-full" />
      {Array.from({ length: 2 }).map((_, section) => (
        <div key={section} className="mb-8">
          <Block className="mb-3 h-5 w-48" />
          <CardBlocks count={4} />
        </div>
      ))}
    </PageShell>
  );
}

export function LeaderboardSkeleton() {
  return (
    <PageShell label="Reading high scores">
      <Block className="mb-5 h-12 w-full" />
      <div className="mb-6 grid grid-cols-3 items-end gap-3">
        <Block className="h-28" />
        <Block className="h-36" />
        <Block className="h-24" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, index) => (
          <Block key={index} className="h-12 w-full" />
        ))}
      </div>
    </PageShell>
  );
}

export function ProfileSkeleton() {
  return (
    <PageShell label="Loading player data">
      <div className="mb-6 flex items-center gap-4">
        <Block className="size-20" />
        <div className="flex-1 space-y-3">
          <Block className="h-6 w-48" />
          <Block className="h-4 w-64" />
        </div>
      </div>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Block key={index} className="h-20" />
        ))}
      </div>
      <CardBlocks count={6} />
    </PageShell>
  );
}

export function PlayPageSkeleton() {
  return (
    <div className="grid h-[100dvh] place-items-center bg-ink-0">
      <TermLoader label="Inserting cartridge" />
    </div>
  );
}

export function CreatePageSkeleton() {
  return (
    <PageShell label="Booting build agents">
      <div className="mx-auto max-w-3xl space-y-4">
        <Block className="h-72 w-full" />
        <Block className="h-14 w-full" />
      </div>
    </PageShell>
  );
}

export function EditPageSkeleton() {
  return (
    <div className="grid min-h-[calc(100dvh-52px)] gap-3 p-3 lg:grid-cols-[300px_1fr_280px]">
      <Block className="hidden min-h-[60vh] lg:block" />
      <div className="flex flex-col gap-3">
        <TermLoader label="Opening editor" />
        <Block className="min-h-[60vh] flex-1" />
      </div>
      <Block className="hidden min-h-[60vh] lg:block" />
    </div>
  );
}

export function TemplatesGridSkeleton() {
  return (
    <PageShell label="Reading cartridge library">
      <Block className="mb-5 h-12 w-72" />
      <CardBlocks count={8} />
    </PageShell>
  );
}

export function ActivityListSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="flex items-center gap-3 border-2 border-line p-2.5">
          <Block className="size-8" />
          <div className="flex-1 space-y-2">
            <Block className="h-3 w-3/4" />
            <Block className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PreviewSkeleton() {
  return (
    <div className="grid h-full min-h-[320px] w-full place-items-center bg-ink-0">
      <TermLoader label="Loading game" />
    </div>
  );
}
