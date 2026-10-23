# Sweet Treats LR — Go-Live Runbook

A plain-English checklist to take the shop from "built" to "open for orders."
Work top to bottom; each step is something you can do yourself from the admin
desk at **sweettreatslr.com**. Nothing here needs a developer.

---

## 1. Sign in to the shop desk

- [ ] Go to **sweettreatslr.com/sign-in**
- [ ] Sign in with your Google account (the one the site was set up for:
      lauryan0311@gmail.com)
- [ ] You should land on **Admin → Overview**. If you ever type the admin
      address while logged out, it looks like a missing page on purpose —
      just sign in first.

## 2. Finish the setup wizard (Admin → Overview)

The checklist at the top of Overview walks you through this. The two items
that start as "needs your review":

- [ ] **Shop address** — replace the placeholder shipping origin with the
      real bakery address. This is where packages ship _from_.
- [ ] **Cookie weights** — the baking scale method: weigh 3 cookies, divide
      by 3, enter the average per cookie. Shipping quotes are only as good
      as these numbers.

## 3. Set real stock counts (Admin → Items)

Each location has its own shelf count now — Little Rock and North Little
Rock never draw from the same pool, so online orders can't sell cookies that
are physically sitting at the other shop.

- [ ] Open each cookie and set **Stock at Little Rock** and **Stock at
      North Little Rock** to what's really on the shelf today.
- [ ] Leave packs alone — their counts come from the cookies inside them
      automatically.
- [ ] Bake a new batch? Just raise the numbers. Sold some at the counter?
      Use the **−1 buttons** right on the items list (one per location). The
      website sees every change immediately.

## 4. Turn on real payments (Admin → Integrations)

Replace the test keys with your live ones. **Only ever paste keys in this
sheet** — never send them by email or text.

- [ ] **Stripe secret key** (`sk_live_…`) — from your Stripe Dashboard →
      Developers → API keys. The sheet checks the key against Stripe
      before saving, and it syncs your menu to Stripe automatically.
- [ ] **Stripe publishable key** (`pk_live_…`).
- [ ] In Stripe: Developers → Webhooks → **Add endpoint**, URL
      `https://sweettreatslr.com/api/stripe/webhook`, events:
      `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
      `checkout.session.async_payment_failed`, `checkout.session.expired`.
      Copy the **signing secret** (`whsec_…`) it shows you.
- [ ] Paste that `whsec_…` into the sheet's **Stripe webhook signing
      secret** field.
- [ ] All three Stripe badges in the sheet should read **LIVE**.

## 5. Turn on real shipping (Admin → Integrations)

- [ ] **Shippo API token** (`shippo_live_…`) — from your Shippo account →
      API settings.
- [ ] In the sheet, invent a **long random string** for the
      **Shippo tracking-webhook token** (20+ characters, anything you like
      — keep a copy).
- [ ] In Shippo: Settings → Webhooks → **Add webhook** with the URL
      `https://sweettreatslr.com/api/shippo/webhook?token=YOUR-STRING-HERE`
      (paste your string where it says YOUR-STRING-HERE), event
      **track_updated**.
- [ ] When a package is delivered, the order marks itself complete and the
      customer gets a "Delivered!" email automatically.

## 6. Place a test order (with a friend's help or another device)

This is the dress rehearsal — it exercises everything at once:

- [ ] On your phone or a logged-out browser, add a cookie pack to the cart
      and check out (pickup at one location).
- [ ] Watch the **admin tab on your computer**: the Orders badge should
      pop within a second, with a toast and a little ding.
- [ ] Open the order — confirm it, print or read it back to the kitchen.
- [ ] Check the customer email arrived (confirmation, from
      noreply@orders.sweettreatslr.com).
- [ ] Back on Admin → Items, hit the **−1** for that location — the count
      the web store sees should drop by one more.
- [ ] Repeat once with a **Ship to me** order to see live USPS rates.

## 7. Ship your first real box

- [ ] Open the order in Admin → Orders and click **Buy label** (cheapest
      USPS rate is picked for you; the customer gets a tracking email
      automatically).
- [ ] Print the label from the order page.
- [ ] When USPS delivers it, the order flips to **completed** on its own.

## 8. Day-to-day rhythm

| Situation             | What you do                                                 |
| --------------------- | ----------------------------------------------------------- |
| Baked a fresh batch   | Raise the numbers in Admin → Items                          |
| Sold cookies in store | Tap the **−1** button for that location                     |
| New online order      | Badge + ding appear on any open admin tab                   |
| Shipping a box        | Admin → Orders → **Buy label**                              |
| Something looks wrong | Check Admin → Overview; the wizard tells you what's missing |

---

**Stuck on a step?** Screenshot the Integrations sheet or the wizard and send
it to your developer — keys never need to be shared to get help, because
everything sensitive lives in the sheet itself.
