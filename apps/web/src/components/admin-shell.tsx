import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@sweettreats/ui/components/sidebar";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  CalendarDays,
  ClipboardList,
  KeyRound,
  LayoutDashboard,
  MapPin,
  Package,
  ShoppingBag,
  Store,
  Truck,
  Users,
} from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

import { useAdminNotifications } from "../lib/use-admin-notifications";

const adminLinks = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard },
  { to: "/admin/items", label: "Items", icon: Package },
  { to: "/admin/daily-menu", label: "Menu days", icon: CalendarDays },
  { to: "/admin/orders", label: "Orders", icon: ClipboardList },
  { to: "/admin/locations", label: "Locations", icon: MapPin },
  { to: "/admin/shipping", label: "Shipping", icon: Truck },
  { to: "/admin/carts", label: "Carts", icon: ShoppingBag },
  { to: "/admin/settings", label: "Integrations", icon: KeyRound },
  { to: "/admin/customers", label: "Customers", icon: Users },
] as const;

const ORDERS_BADGE_TARGET = "/admin/orders";

function useActivePath() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (to: string) =>
    to === "/admin" ? pathname === "/admin" : pathname === to || pathname.startsWith(`${to}/`);
}

function NavBadge({ count }: { count: number }) {
  if (count <= 0) {
    return null;
  }
  return <span className="admin-nav-badge">{count > 9 ? "9+" : count}</span>;
}

/**
 * Admin chrome. Desktop gets the shadcn sidebar; phones get a native-style bottom tab bar
 * (CSS decides which one is visible so there is no JS device sniffing or layout flash).
 */
export function AdminShell({ children }: { children: ReactNode }) {
  // New-order badge: instant push + 20s polling, per useAdminNotifications.
  const { newOrderCount } = useAdminNotifications();

  return (
    <SidebarProvider
      className="page admin-page"
      style={{ "--sidebar-width": "14rem" } as CSSProperties}
    >
      <AdminSidebar newOrderCount={newOrderCount} />
      <main className="admin-content">{children}</main>
      <AdminTabBar newOrderCount={newOrderCount} />
    </SidebarProvider>
  );
}

function AdminSidebar({ newOrderCount }: { newOrderCount: number }) {
  const isActive = useActivePath();

  return (
    <Sidebar collapsible="none" className="admin-sidebar" aria-label="Admin navigation">
      <SidebarHeader>
        <p className="admin-sidebar-title">Shop desk</p>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Manage</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {adminLinks.map(({ to, label, icon: Icon }) => (
                <SidebarMenuItem key={to}>
                  <SidebarMenuButton
                    isActive={isActive(to)}
                    render={<Link to={to} aria-current={isActive(to) ? "page" : undefined} />}
                  >
                    <Icon aria-hidden="true" />
                    <span>{label}</span>
                    {to === ORDERS_BADGE_TARGET ? <NavBadge count={newOrderCount} /> : null}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton render={<Link to="/menu" />}>
              <Store aria-hidden="true" />
              <span>View storefront</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

function AdminTabBar({ newOrderCount }: { newOrderCount: number }) {
  const isActive = useActivePath();

  return (
    <nav className="admin-tabbar" aria-label="Admin navigation">
      {adminLinks.map(({ to, label, icon: Icon }) => {
        const active = isActive(to);
        return (
          <Link
            key={to}
            to={to}
            className="admin-tab"
            data-active={active ? "" : undefined}
            aria-current={active ? "page" : undefined}
          >
            <span className="admin-tab-icon">
              <Icon size={22} strokeWidth={active ? 2.4 : 1.9} aria-hidden="true" />
              {to === ORDERS_BADGE_TARGET ? <NavBadge count={newOrderCount} /> : null}
            </span>
            <span className="admin-tab-label">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
