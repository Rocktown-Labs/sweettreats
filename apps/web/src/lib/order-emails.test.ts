import { describe, expect, it } from "vitest";
import {
  AdminOrderNotificationEmail,
  CustomerOrderConfirmationEmail,
  MagicLinkEmail,
  render,
} from "@sweettreats/email";
import React from "react";

describe("Email Templates & Notifications", () => {
  it("renders AdminOrderNotificationEmail with complete order details", async () => {
    const html = await render(
      React.createElement(AdminOrderNotificationEmail, {
        orderId: "ord-test-1",
        orderNumber: "STLR-501",
        customerName: "Lauryan",
        customerEmail: "customer@example.com",
        customerPhone: "(501) 555-0142",
        pickupLocationName: "Little Rock Pickup (LR)",
        pickupDate: "2026-10-15",
        pickupTime: "2:00 PM",
        subtotalCents: 2800,
        paymentStatus: "paid",
        items: [
          {
            name: "Brown Butter Chocolate Chip",
            quantity: 4,
            unitPriceCents: 350,
            lineTotalCents: 1400,
          },
          {
            name: "Red Velvet White Chip",
            quantity: 2,
            unitPriceCents: 400,
            lineTotalCents: 800,
          },
        ],
      }),
    );

    expect(html).toContain("STLR-501");
    expect(html).toContain("Lauryan");
    expect(html).toContain("Little Rock Pickup (LR)");
    expect(html).toContain("Brown Butter Chocolate Chip");
    expect(html).toContain("$28.00");
  });

  it("renders CustomerOrderConfirmationEmail with pickup instructions", async () => {
    const html = await render(
      React.createElement(CustomerOrderConfirmationEmail, {
        orderNumber: "STLR-502",
        orderId: "ord-test-2",
        customerName: "Alex",
        pickupLocationName: "North Little Rock Pickup (NLR)",
        pickupLocationAddress: "North Little Rock, AR (Argenta / Main St)",
        pickupLocationInstructions: "State your name and order number at counter",
        pickupDate: "2026-10-16",
        pickupTime: "11:30 AM",
        subtotalCents: 1600,
        items: [
          {
            name: "Strawberry Crunch",
            quantity: 4,
            lineTotalCents: 1600,
          },
        ],
      }),
    );

    expect(html).toContain("STLR-502");
    expect(html).toContain("North Little Rock Pickup (NLR)");
    expect(html).toContain("State your name and order number");
    expect(html).toContain("Strawberry Crunch");
    expect(html).toContain("$16.00");
  });

  it("renders MagicLinkEmail with secure activation button", async () => {
    const html = await render(
      React.createElement(MagicLinkEmail, {
        url: "https://sweettreatslr.com/api/auth/magic-link/verify?token=abc",
        email: "customer@example.com",
      }),
    );

    expect(html).toContain("Sign In to Your Account");
    expect(html).toContain("customer@example.com");
    expect(html).toContain("https://sweettreatslr.com/api/auth/magic-link/verify?token=abc");
  });
});
