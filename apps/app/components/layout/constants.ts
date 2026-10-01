import { Home, ListTodo, Newspaper, Settings, Users } from "lucide-react";

// Ties the header toggle to the region it controls via `aria-controls`.
export const SIDEBAR_ID = "app-sidebar";

export const sidebarItems = [
  { icon: Home, label: "Dashboard", to: "/dashboard" },
  { icon: ListTodo, label: "Todos", to: "/todos" },
  { icon: Newspaper, label: "Posts", to: "/posts" },
  { icon: Users, label: "Members", to: "/members" },
  { icon: Settings, label: "Settings", to: "/settings" },
] as const;
