import { Avatar, AvatarFallback, Button } from "@repo/ui";
import { useEffect, useState } from "react";

type SessionUser = { name: string; email: string; image?: string | null };

type State =
  | { status: "loading" }
  | { status: "out" }
  | { status: "in"; user: SessionUser };

/**
 * Header account menu for the marketing site.
 *
 * Marketing pages are mostly prerendered, so nothing server-side knows who
 * is visiting. This island asks the API for the session once it mounts and
 * renders either sign-in links or the visitor's name with a way into the app.
 * Until the answer arrives it renders a fixed-width placeholder so the header
 * does not jump.
 */
export function SessionMenu() {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/auth/get-session", {
      credentials: "include",
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = response.ok
          ? ((await response.json()) as { user?: SessionUser } | null)
          : null;
        setState(
          data?.user ? { status: "in", user: data.user } : { status: "out" },
        );
      })
      .catch(() => setState({ status: "out" }));
    return () => controller.abort();
  }, []);

  if (state.status === "loading") {
    return <div className="h-8 w-40" aria-hidden="true" />;
  }

  if (state.status === "out") {
    return (
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <a href="/login">Log in</a>
        </Button>
        <Button size="sm" asChild>
          <a href="/signup">Start free</a>
        </Button>
      </div>
    );
  }

  const { user } = state;
  const initials = (user.name || user.email)
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex items-center gap-3">
      {/* "/" is the dashboard once signed in: the worker routes it by the
          auth-hint cookie. A document navigation, since the app lives there. */}
      <a
        href="/"
        className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors"
      >
        <Avatar className="h-8 w-8">
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <span className="hidden sm:inline">{user.name || user.email}</span>
      </a>
      <Button size="sm" asChild>
        <a href="/">Dashboard</a>
      </Button>
    </div>
  );
}
