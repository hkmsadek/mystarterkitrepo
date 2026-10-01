import {
  Avatar,
  AvatarFallback,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui";
import { useEffect, useState } from "react";

type SessionUser = { name: string; email: string; image?: string | null };

type State = { status: "out" } | { status: "in"; user: SessionUser };

/**
 * Header account menu for the marketing site.
 *
 * Marketing pages are mostly prerendered, so nothing server-side knows who
 * is visiting. The island renders the signed-out links first – that is what
 * the static HTML contains, and what most visitors are – then asks the API
 * for the session once it mounts and swaps in the visitor's avatar with a
 * menu into the app. A signed-in visitor sees the swap after one quick request.
 */
export function SessionMenu() {
  const [state, setState] = useState<State>({ status: "out" });

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
        if (data?.user) setState({ status: "in", user: data.user });
      })
      .catch(() => {
        // Signed-out links are already showing; nothing to change.
      });
    return () => controller.abort();
  }, []);

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

  async function signOut() {
    // Better Auth ends the session and clears its cookies; the page then
    // reloads so every island and link reflects the signed-out state.
    await fetch("/api/auth/sign-out", {
      method: "POST",
      credentials: "include",
      // Better Auth rejects a POST without a JSON body as 415.
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    window.location.assign("/");
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-full outline-offset-2"
          aria-label="Account menu"
        >
          <Avatar className="h-8 w-8">
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <span className="hidden sm:inline text-sm font-medium">
            {user.name || user.email}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <p className="text-sm font-medium">{user.name}</p>
          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {/* Document navigations: the app is a separate bundle at these paths. */}
        <DropdownMenuItem asChild>
          <a href="/dashboard">Dashboard</a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href="/todos">Todos</a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href="/settings">Settings</a>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={signOut}>Log out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
