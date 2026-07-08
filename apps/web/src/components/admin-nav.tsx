import { Link } from "@tanstack/react-router";
import { CalendarDays, ClipboardList, LayoutDashboard, Package, Users } from "lucide-react";

const adminLinks = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard },
  { to: "/admin/items", label: "Items", icon: Package },
  { to: "/admin/daily-menu", label: "Menu days", icon: CalendarDays },
  { to: "/admin/orders", label: "Orders", icon: ClipboardList },
  { to: "/admin/customers", label: "Customers", icon: Users },
] as const;

export function AdminNav() {
  return (
    <nav className="admin-nav" aria-label="Admin navigation">
      {adminLinks.map(({ to, label, icon: Icon }) => (
        <Link key={to} to={to} activeOptions={to === "/admin" ? { exact: true } : undefined}>
          <Icon size={18} aria-hidden="true" />
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}
