import { Link, createFileRoute } from "@tanstack/react-router";

import { CookieCard } from "../components/cookie-card";
import { useCart } from "../lib/cart";
import { formatMoney } from "../lib/format";
import { getTodayMenu } from "../lib/api";

export const Route = createFileRoute("/")({
  loader: () => getTodayMenu(),
  component: HomeComponent,
});

function HomeComponent() {
  const menu = Route.useLoaderData();
  const items = menu.items;
  const availableItems = items.filter((item) => item.available);
  const cart = useCart();
  const todayLabel = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: "America/Chicago",
  }).format(new Date(`${menu.menuDate}T12:00:00`));
  const showingToday = menu.menuDate === menu.requestedDate;

  return (
    <main className="page">
      <section className="hero-flyer">
        <div className="hero-inner">
          <div className="hero-lockup">
            <img src="/sweet-treats-logo.png" alt="Sweet Treats LR" className="hero-logo" />
            <h1 className="hero-title">Order Today</h1>
          </div>
        </div>
        <div className="flyer-strip">
          <div>
            <strong>{todayLabel}</strong>
            {showingToday ? "today's menu" : "next pickup day"}
          </div>
          <div>
            <strong>{showingToday ? "Pickup orders" : "Closed today"}</strong>
            {showingToday ? "choose your time at checkout" : "ordering moved to the next open day"}
          </div>
          <div>
            <strong>{availableItems.length} available</strong>
            ready for pickup
          </div>
        </div>
      </section>

      <section>
        <div className="section-head">
          <h2 className="section-title">Today&apos;s Menu</h2>
          <Link to="/menu" className="text-button">
            See all
          </Link>
        </div>
        <div className="flyer-menu-grid">
          {availableItems.map((item) => (
            <CookieCard key={item.id} item={item} />
          ))}
        </div>
      </section>

      <footer className="footer" aria-label="Sweet Treats LR contact">
        <div className="footer-brand">
          <img src="/sweet-treats-logo.png" alt="" className="footer-logo" />
          <div>
            <strong>Sweet Treats LR</strong>
            <span>Cookies, jars, and pickup treats</span>
          </div>
        </div>
        <div className="footer-links">
          <a href="https://instagram.com/sweettreatslr" target="_blank" rel="noreferrer">
            @sweettreatslr
          </a>
          <span>Pickup in Little Rock</span>
        </div>
      </footer>

      {cart.count > 0 ? (
        <Link to="/cart" className="primary-button sticky-cart">
          Checkout {cart.count} item{cart.count === 1 ? "" : "s"} ·{" "}
          {formatMoney(cart.subtotalCents)}
        </Link>
      ) : null}
    </main>
  );
}
