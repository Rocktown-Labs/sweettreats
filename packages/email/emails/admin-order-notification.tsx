import * as React from "react";
import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Section,
  Heading,
  Text,
  Button,
  Hr,
  Row,
  Column,
  Img,
} from "@react-email/components";

export interface OrderItemProp {
  name: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
}

export interface AdminOrderNotificationEmailProps {
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  pickupLocationName: string;
  pickupLocationAddress?: string;
  pickupDate: string;
  pickupTime: string;
  /** When set, the email shows a shipping block instead of pickup details. */
  shippingAddress?: string;
  shippingServiceName?: string;
  shippingTotalCents?: number;
  notes?: string | null;
  subtotalCents: number;
  paymentStatus: "paid" | "confirmed" | "pending";
  items: OrderItemProp[];
  adminDashboardUrl?: string;
}

function formatMoney(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function AdminOrderNotificationEmail({
  orderId = "ord-sample",
  orderNumber = "STLR-1001",
  customerName = "Taylor Swift",
  customerEmail = "customer@example.com",
  customerPhone = "(501) 555-0199",
  pickupLocationName = "Little Rock Pickup (Downtown LR)",
  pickupLocationAddress = "400 President Clinton Ave, Little Rock, AR 72201",
  pickupDate = "2026-10-15",
  pickupTime = "2:30 PM",
  shippingAddress,
  shippingServiceName,
  shippingTotalCents,
  notes = "Please pack in separate boxes if possible!",
  subtotalCents = 2450,
  paymentStatus = "paid",
  items = [
    {
      name: "Chocolate Chip Cookie (4-Pack)",
      quantity: 1,
      unitPriceCents: 1400,
      lineTotalCents: 1400,
    },
    {
      name: "Red Velvet White Chip",
      quantity: 2,
      unitPriceCents: 400,
      lineTotalCents: 800,
    },
    {
      name: "Lemon Glaze Cookie",
      quantity: 1,
      unitPriceCents: 250,
      lineTotalCents: 250,
    },
  ],
  adminDashboardUrl = "https://sweettreatslr.com/admin/orders",
}: AdminOrderNotificationEmailProps) {
  const viewUrl = adminDashboardUrl.endsWith(orderId)
    ? adminDashboardUrl
    : `${adminDashboardUrl.replace(/\/$/, "")}/${orderId}`;

  return (
    <Html lang="en">
      <Head />
      <Preview>
        New Order #{orderNumber} from {customerName} ({formatMoney(subtotalCents)})
      </Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header */}
          <Section style={headerSection}>
            <Row>
              <Column style={{ width: "64px", verticalAlign: "middle" }}>
                <Img
                  src="https://sweettreatslr.com/sweet-treats-logo.png"
                  alt="Sweet Treats LR Logo"
                  width="56"
                  height="56"
                  style={logoImg}
                />
              </Column>
              <Column style={{ verticalAlign: "middle", paddingLeft: "12px" }}>
                <Text style={brandTitle}>Sweet Treats LR</Text>
                <Text style={badge}>NEW ORDER ALERT</Text>
              </Column>
            </Row>
          </Section>

          {/* Headline & Overview */}
          <Section style={card}>
            <Heading as="h1" style={heading}>
              Order #{orderNumber}
            </Heading>
            <Text style={subheading}>
              A new order has been placed and confirmed through checkout.
            </Text>

            <Section style={statusBox}>
              <Row>
                <Column style={{ width: "50%" }}>
                  <Text style={metaLabel}>PAYMENT STATUS</Text>
                  <Text style={metaValueHighlight}>
                    {paymentStatus === "paid" ? "PAID (Stripe)" : "CONFIRMED"}
                  </Text>
                </Column>
                <Column style={{ width: "50%" }}>
                  <Text style={metaLabel}>TOTAL AMOUNT</Text>
                  <Text style={metaValueHighlight}>{formatMoney(subtotalCents)}</Text>
                </Column>
              </Row>
            </Section>

            <Hr style={divider} />

            {/* Customer Details */}
            <Heading as="h2" style={sectionTitle}>
              Customer Details
            </Heading>
            <table role="presentation" style={detailsTable}>
              <tbody>
                <tr>
                  <td style={tableLabel}>Name:</td>
                  <td style={tableValue}>{customerName}</td>
                </tr>
                <tr>
                  <td style={tableLabel}>Email:</td>
                  <td style={tableValue}>
                    <a href={`mailto:${customerEmail}`} style={link}>
                      {customerEmail}
                    </a>
                  </td>
                </tr>
                <tr>
                  <td style={tableLabel}>Phone:</td>
                  <td style={tableValue}>
                    <a href={`tel:${customerPhone}`} style={link}>
                      {customerPhone}
                    </a>
                  </td>
                </tr>
              </tbody>
            </table>

            <Hr style={divider} />

            {/* Fulfillment: shipping or pickup */}
            <Heading as="h2" style={sectionTitle}>
              {shippingAddress ? "Shipping Information" : "Pickup Information"}
            </Heading>
            <Section style={pickupBox}>
              {shippingAddress ? (
                <>
                  <Text style={pickupSpotName}>
                    {shippingServiceName || "USPS"}
                    {shippingTotalCents != null && shippingTotalCents > 0
                      ? ` — ${formatMoney(shippingTotalCents)}`
                      : ""}
                  </Text>
                  <Text style={pickupSpotAddress}>{shippingAddress}</Text>
                </>
              ) : (
                <>
                  <Text style={pickupSpotName}>{pickupLocationName}</Text>
                  {pickupLocationAddress ? (
                    <Text style={pickupSpotAddress}>{pickupLocationAddress}</Text>
                  ) : null}
                  <Text style={pickupTimeHighlight}>
                    Date: <strong>{pickupDate}</strong> • Time: <strong>{pickupTime}</strong>
                  </Text>
                </>
              )}
            </Section>

            {notes ? (
              <Section style={notesBox}>
                <Text style={metaLabel}>CUSTOMER NOTE</Text>
                <Text style={notesText}>"{notes}"</Text>
              </Section>
            ) : null}

            <Hr style={divider} />

            {/* Itemized Order List */}
            <Heading as="h2" style={sectionTitle}>
              Order Items ({items.reduce((acc, i) => acc + i.quantity, 0)})
            </Heading>
            <table role="presentation" style={itemsTable}>
              <thead>
                <tr>
                  <th style={itemThLeft}>Item</th>
                  <th style={itemThCenter}>Qty</th>
                  <th style={itemThRight}>Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={idx} style={itemRow}>
                    <td style={itemTdLeft}>{item.name}</td>
                    <td style={itemTdCenter}>×{item.quantity}</td>
                    <td style={itemTdRight}>{formatMoney(item.lineTotalCents)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2} style={totalTh}>
                    Subtotal:
                  </td>
                  <td style={totalTd}>{formatMoney(subtotalCents)}</td>
                </tr>
              </tfoot>
            </table>

            {/* Admin CTA Button */}
            <Section style={ctaSection}>
              <Button href={viewUrl} style={button}>
                View Order in Admin Dashboard
              </Button>
            </Section>
          </Section>

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>Sweet Treats LR • Automated Bakery Order Notification</Text>
            <Text style={footerSubtext}>
              Central Arkansas Bakery Operations • Little Rock &amp; North Little Rock
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

AdminOrderNotificationEmail.PreviewProps = {
  orderId: "ord-test-preview",
  orderNumber: "STLR-9042",
  customerName: "Lauryan",
  customerEmail: "lauryan0311@gmail.com",
  customerPhone: "(501) 555-0142",
  pickupLocationName: "Little Rock Pickup (Downtown LR)",
  pickupLocationAddress: "400 President Clinton Ave, Little Rock, AR 72201",
  pickupDate: "2026-10-15",
  pickupTime: "1:00 PM",
  notes: "Extra napkins please!",
  subtotalCents: 3250,
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
      quantity: 3,
      unitPriceCents: 400,
      lineTotalCents: 1200,
    },
    {
      name: "Lemon Glaze Cookie",
      quantity: 2,
      unitPriceCents: 325,
      lineTotalCents: 650,
    },
  ],
  adminDashboardUrl: "https://sweettreatslr.com/admin/orders",
} satisfies AdminOrderNotificationEmailProps;

// Styles
const main: React.CSSProperties = {
  backgroundColor: "#fff8e7",
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  padding: "24px 0",
};

const container: React.CSSProperties = {
  maxWidth: "600px",
  margin: "0 auto",
  padding: "0 16px",
};

const headerSection: React.CSSProperties = {
  marginBottom: "16px",
};

const logoImg: React.CSSProperties = {
  borderRadius: "50%",
  display: "block",
};

const brandTitle: React.CSSProperties = {
  margin: "0 0 4px 0",
  fontSize: "20px",
  fontWeight: "800",
  color: "#241408",
  letterSpacing: "-0.5px",
};

const badge: React.CSSProperties = {
  display: "inline-block",
  margin: 0,
  padding: "3px 8px",
  backgroundColor: "#e07a5f",
  color: "#ffffff",
  fontSize: "11px",
  fontWeight: "700",
  letterSpacing: "0.8px",
  borderRadius: "4px",
};

const card: React.CSSProperties = {
  backgroundColor: "#ffffff",
  borderRadius: "16px",
  padding: "28px",
  boxShadow: "0 4px 16px rgba(36, 20, 8, 0.08)",
  border: "1px solid #f1e2cc",
};

const heading: React.CSSProperties = {
  fontSize: "26px",
  fontWeight: "800",
  color: "#241408",
  margin: "0 0 6px 0",
  letterSpacing: "-0.5px",
};

const subheading: React.CSSProperties = {
  fontSize: "14px",
  color: "#6b5847",
  margin: "0 0 20px 0",
};

const statusBox: React.CSSProperties = {
  backgroundColor: "#fffbf2",
  borderRadius: "10px",
  padding: "14px 16px",
  border: "1px solid #f6c453",
  marginBottom: "20px",
};

const metaLabel: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: "700",
  color: "#8c6f4a",
  letterSpacing: "0.5px",
  margin: "0 0 4px 0",
  textTransform: "uppercase",
};

const metaValueHighlight: React.CSSProperties = {
  fontSize: "17px",
  fontWeight: "800",
  color: "#241408",
  margin: 0,
};

const sectionTitle: React.CSSProperties = {
  fontSize: "16px",
  fontWeight: "700",
  color: "#241408",
  margin: "0 0 12px 0",
};

const detailsTable: React.CSSProperties = {
  width: "100%",
  marginBottom: "16px",
  borderCollapse: "collapse",
};

const tableLabel: React.CSSProperties = {
  width: "80px",
  fontSize: "14px",
  color: "#8c6f4a",
  padding: "4px 0",
  fontWeight: "600",
};

const tableValue: React.CSSProperties = {
  fontSize: "14px",
  color: "#241408",
  padding: "4px 0",
  fontWeight: "500",
};

const link: React.CSSProperties = {
  color: "#241408",
  textDecoration: "underline",
};

const pickupBox: React.CSSProperties = {
  backgroundColor: "#fff8e7",
  padding: "14px 16px",
  borderRadius: "10px",
  marginBottom: "16px",
  border: "1px solid #ead8bf",
};

const pickupSpotName: React.CSSProperties = {
  fontSize: "15px",
  fontWeight: "700",
  color: "#241408",
  margin: "0 0 4px 0",
};

const pickupSpotAddress: React.CSSProperties = {
  fontSize: "13px",
  color: "#6b5847",
  margin: "0 0 8px 0",
};

const pickupTimeHighlight: React.CSSProperties = {
  fontSize: "14px",
  color: "#241408",
  margin: 0,
};

const notesBox: React.CSSProperties = {
  backgroundColor: "#fdf8ee",
  padding: "12px 14px",
  borderRadius: "8px",
  borderLeft: "4px solid #f6c453",
  marginBottom: "16px",
};

const notesText: React.CSSProperties = {
  fontSize: "14px",
  fontStyle: "italic",
  color: "#241408",
  margin: 0,
};

const itemsTable: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  marginBottom: "24px",
};

const itemThLeft: React.CSSProperties = {
  textAlign: "left",
  fontSize: "12px",
  fontWeight: "700",
  color: "#8c6f4a",
  paddingBottom: "8px",
  borderBottom: "1px solid #ead8bf",
};

const itemThCenter: React.CSSProperties = {
  textAlign: "center",
  fontSize: "12px",
  fontWeight: "700",
  color: "#8c6f4a",
  paddingBottom: "8px",
  borderBottom: "1px solid #ead8bf",
};

const itemThRight: React.CSSProperties = {
  textAlign: "right",
  fontSize: "12px",
  fontWeight: "700",
  color: "#8c6f4a",
  paddingBottom: "8px",
  borderBottom: "1px solid #ead8bf",
};

const itemRow: React.CSSProperties = {
  borderBottom: "1px solid #f5ede1",
};

const itemTdLeft: React.CSSProperties = {
  padding: "10px 0",
  fontSize: "14px",
  color: "#241408",
  fontWeight: "500",
};

const itemTdCenter: React.CSSProperties = {
  padding: "10px 0",
  textAlign: "center",
  fontSize: "14px",
  color: "#6b5847",
};

const itemTdRight: React.CSSProperties = {
  padding: "10px 0",
  textAlign: "right",
  fontSize: "14px",
  color: "#241408",
  fontWeight: "600",
};

const totalTh: React.CSSProperties = {
  paddingTop: "14px",
  textAlign: "right",
  fontSize: "15px",
  fontWeight: "700",
  color: "#241408",
};

const totalTd: React.CSSProperties = {
  paddingTop: "14px",
  textAlign: "right",
  fontSize: "18px",
  fontWeight: "800",
  color: "#241408",
};

const ctaSection: React.CSSProperties = {
  textAlign: "center",
  marginTop: "16px",
};

const button: React.CSSProperties = {
  backgroundColor: "#241408",
  color: "#ffffff",
  fontSize: "15px",
  fontWeight: "700",
  padding: "14px 28px",
  borderRadius: "10px",
  textDecoration: "none",
  display: "inline-block",
  boxSizing: "border-box",
};

const divider: React.CSSProperties = {
  border: "none",
  borderTop: "1px solid #ead8bf",
  margin: "20px 0",
};

const footer: React.CSSProperties = {
  textAlign: "center",
  marginTop: "24px",
};

const footerText: React.CSSProperties = {
  fontSize: "12px",
  color: "#8c6f4a",
  margin: "0 0 4px 0",
  fontWeight: "600",
};

const footerSubtext: React.CSSProperties = {
  fontSize: "11px",
  color: "#a88e6e",
  margin: 0,
};
