import { createFileRoute } from "@tanstack/react-router";
import { HomeFeedSkeleton } from "@/components/studio/PageSkeletons";
import { Home } from "./_app.index.full";

/** Home route — grids only (no carousels) for shelves / categories / creators. */
export const Route = createFileRoute("/_app/")({
  pendingComponent: HomeFeedSkeleton,
  head: () => ({
    meta: [
      { title: "Home - Creator Studio" },
      { name: "description", content: "Create, publish, and grow playable games with AI." },
    ],
  }),
  component: Home,
});
