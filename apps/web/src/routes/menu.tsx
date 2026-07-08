import { createFileRoute } from "@tanstack/react-router";

import { CookieCard } from "../components/cookie-card";
import { getMenu } from "../lib/api";

export const Route = createFileRoute("/menu")({
  loader: () => getMenu(),
  component: MenuPage,
  pendingComponent: MenuPagePending,
});

function MenuPagePending() {
  return (
    <main className="page">
      <div className="section-head">
        <div>
          <p
            className="eyebrow skeleton"
            style={{ width: "80px", height: "14px", marginBottom: "8px" }}
          ></p>
          <h1 className="page-title skeleton" style={{ width: "180px", height: "48px" }}></h1>
        </div>
      </div>
      <section>
        <div className="section-head">
          <h2 className="section-title skeleton" style={{ width: "120px", height: "28px" }}></h2>
        </div>
        <div className="flyer-menu-grid">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="skeleton-card">
              <div
                className="skeleton"
                style={{ height: "180px", borderRadius: "8px", marginBottom: "8px" }}
              ></div>
              <div className="skeleton skeleton-title" style={{ width: "80%" }}></div>
              <div className="skeleton skeleton-text" style={{ width: "60%" }}></div>
              <div
                className="skeleton skeleton-button"
                style={{ width: "100%", height: "36px" }}
              ></div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function MenuPage() {
  const items = Route.useLoaderData();
  const categories = [...new Set(items.map((item) => displayCategory(item.category)))];

  return (
    <main className="page">
      <div className="section-head">
        <div>
          <p className="eyebrow">Fresh today</p>
          <h1 className="page-title">Menu</h1>
        </div>
      </div>
      {categories.map((category) => (
        <section key={category}>
          <div className="section-head">
            <h2 className="section-title">{category}</h2>
          </div>
          <div className="flyer-menu-grid">
            {items
              .filter((item) => displayCategory(item.category) === category)
              .map((item) => (
                <CookieCard key={item.id} item={item} />
              ))}
          </div>
        </section>
      ))}
    </main>
  );
}

function displayCategory(category: string) {
  return category === "Main Cookies" ? "Today's Batch" : category;
}
