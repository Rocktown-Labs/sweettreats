import { useRouter, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import type { CSSProperties } from "react";
import { useState } from "react";
import { toast } from "sonner";

import { getAdminDashboard, saveWeeklyMenu } from "../lib/api";

export const Route = createFileRoute("/admin/daily-menu")({
  loader: () => getAdminDashboard(),
  component: AdminDailyMenuPage,
});

const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function startOfShopWeek(date = new Date()) {
  const shopDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  const [year, month, day] = shopDate.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  const dayIndex = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() - dayIndex + 1);
  return utc.toISOString().slice(0, 10);
}

function addDaysIso(dateIso: string, days: number) {
  const [year, month, day] = dateIso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

function AdminDailyMenuPage() {
  const { items, todaysMenu, shopDays } = Route.useLoaderData();
  const router = useRouter();
  const saveWeek = useServerFn(saveWeeklyMenu);
  const [weekStart, setWeekStart] = useState(startOfShopWeek());
  const weekDates = Array.from({ length: 7 }, (_, index) => addDaysIso(weekStart, index));
  const visibleItems = items.filter((item) => item.available);
  const scheduled = new Set(
    todaysMenu
      .filter((entry) => entry.availableOverride !== false)
      .map((entry) => `${entry.menuItemId}:${entry.menuDate}`),
  );
  const closedDates = new Set(shopDays.filter((day) => day.closed).map((day) => day.dayDate));

  return (
    <div className="admin-main">
      <div className="section-head admin-heading">
        <div>
          <p className="eyebrow">Admin</p>
          <h1 className="page-title">Menu days</h1>
        </div>
        <label className="field compact-field">
          <span>Week of</span>
          <input
            type="date"
            value={weekStart}
            onChange={(event) =>
              setWeekStart(startOfShopWeek(new Date(`${event.currentTarget.value}T12:00:00`)))
            }
          />
        </label>
      </div>
      <form
        className="panel weekly-menu-panel"
        onSubmit={async (event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const itemDays: Record<string, string[]> = {};
          for (const item of visibleItems) {
            itemDays[item.id] = weekDates.filter((date) => form.get(`${item.id}:${date}`) === "on");
          }
          const closed = weekDates.filter((date) => form.get(`closed:${date}`) === "on");

          await saveWeek({ data: { weekStart, itemDays, closedDates: closed } });
          toast.success("Menu days saved successfully!");
          await router.invalidate();
        }}
      >
        <div
          className="weekly-menu-grid"
          style={{ "--day-count": weekDates.length } as CSSProperties}
        >
          <div className="weekly-menu-head">Item</div>
          {weekDates.map((date, index) => (
            <div key={date} className="weekly-menu-day">
              <strong>{dayLabels[index]}</strong>
              <span>{date.slice(5).replace("-", "/")}</span>
              <label className="closed-day-check">
                <input
                  name={`closed:${date}`}
                  type="checkbox"
                  defaultChecked={closedDates.has(date)}
                />
                Closed
              </label>
            </div>
          ))}
          {visibleItems.map((item) => (
            <div className="weekly-menu-row" key={item.id}>
              <div className="weekly-item-name">
                <strong>{item.name}</strong>
                <span>{item.category === "Main Cookies" ? "Cookies" : item.category}</span>
              </div>
              {weekDates.map((date) => (
                <label className="day-check" key={date}>
                  <input
                    name={`${item.id}:${date}`}
                    type="checkbox"
                    defaultChecked={scheduled.has(`${item.id}:${date}`)}
                  />
                  <span>{date}</span>
                </label>
              ))}
            </div>
          ))}
        </div>
        <button type="submit" className="primary-button">
          Save menu days
        </button>
      </form>
    </div>
  );
}
