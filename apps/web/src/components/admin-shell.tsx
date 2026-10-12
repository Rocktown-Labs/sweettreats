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
  LayoutDashboard,
  MapPin,
  Package,
  Store,
  Users,
} from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

const adminLinks = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard },
  { to: "/admin/items", label: "Items", icon: Package },
  { to: "/admin/daily-menu", label: "Menu days", icon: CalendarDays },
  { to: "/admin/orders", label: "Orders", icon: ClipboardList },
  { to: "/admin/locations", label: "Locations", icon: MapPin },
  { to: "/admin/customers", label: "Customers", icon: Users },
] as const;

function useActivePath() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (to: string) =>
    to === "/admin" ? pathname === "/admin" : pathname === to || pathname.startsWith(`${to}/`);
}

/**
 * Admin chrome. Desktop gets the shadcn sidebar; phones get a native-style bottom tab bar
 * (CSS decides which one is visible so there is no JS device sniffing or layout flash).
 */
export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider
      className="page admin-page"
      style={{ "--sidebar-width": "14rem" } as CSSProperties}
    >
      <AdminSidebar />
      <main className="admin-content">{children}</main>
      <AdminTabBar />
    </SidebarProvider>
  );
}

function AdminSidebar() {
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

function AdminTabBar() {
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
            </span>
            <span className="admin-tab-label">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
