import { Home, ListTodo, Settings, Users } from "lucide-react";

// Ties the header toggle to the region it controls via `aria-controls`.
export const SIDEBAR_ID = "app-sidebar";

export const sidebarItems = [
  { icon: Home, label: "Dashboard", to: "/" },
  { icon: ListTodo, label: "Todos", to: "/todos" },
  { icon: Users, label: "Members", to: "/members" },
  { icon: Settings, label: "Settings", to: "/settings" },
] as const;
