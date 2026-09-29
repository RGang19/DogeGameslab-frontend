import { createFileRoute, redirect } from "@tanstack/react-router";

// The reel feed used to key each game by a path segment (/play/$gameId),
// which changes the URL's pathname on every swipe. Some embedded WebViews
// (in-app browsers among them) treat a pathname change as "leaving the page" and
// show a confirmation dialog mid-swipe. The feed now keys games by a search
// param instead (/play?gameId=...), which never touches the pathname. This
// route only exists so any link/bookmark still using the old shape keeps
// working, by bouncing straight to the new one.
export const Route = createFileRoute("/_app/play/$gameId")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/play",
      search: { gameId: params.gameId },
      replace: true,
    });
  },
});
