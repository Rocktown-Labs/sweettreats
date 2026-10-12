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

export interface CustomerOrderItemProp {
  name: string;
  quantity: number;
  lineTotalCents: number;
}

export interface CustomerOrderConfirmationEmailProps {
  orderNumber: string;
  orderId: string;
  customerName: string;
  pickupLocationName: string;
  pickupLocationAddress?: string;
  pickupLocationInstructions?: string;
  pickupDate: string;
  pickupTime: string;
  subtotalCents: number;
  items: CustomerOrderItemProp[];
  viewOrderUrl?: string;
}

function formatMoney(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function CustomerOrderConfirmationEmail({
  orderNumber = "STLR-1001",
  orderId = "ord-sample",
  customerName = "Valued Customer",
  pickupLocationName = "Little Rock Pickup (Downtown LR)",
  pickupLocationAddress = "400 President Clinton Ave, Little Rock, AR 72201",
  pickupLocationInstructions = "Pick up at the front counter. Curbside pickup available upon request.",
  pickupDate = "2026-10-15",
  pickupTime = "2:30 PM",
  subtotalCents = 2450,
  items = [
    { name: "Brown Butter Chocolate Chip", quantity: 4, lineTotalCents: 1400 },
    { name: "Red Velvet White Chip", quantity: 2, lineTotalCents: 800 },
    { name: "Lemon Glaze Cookie", quantity: 1, lineTotalCents: 250 },
  ],
  viewOrderUrl = "https://sweettreatslr.com/order/success",
}: CustomerOrderConfirmationEmailProps) {
  const orderUrl = viewOrderUrl.includes("?")
    ? `${viewOrderUrl}&orderId=${orderId}`
    : `${viewOrderUrl}?orderId=${orderId}`;

  return (
    <Html lang="en">
      <Head />
      <Preview>Your Sweet Treats LR order #{orderNumber} is confirmed!</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header */}
          <Section style={headerSection}>
            <Row>
              <Column style={{ width: "64px", verticalAlign: "middle" }}>
                <Img
                  src="https://sweettreatslr.com/sweet-treats-logo.png"
                  alt="Sweet Treats LR"
                  width="56"
                  height="56"
                  style={logoImg}
                />
              </Column>
              <Column style={{ verticalAlign: "middle", paddingLeft: "12px" }}>
                <Text style={brandTitle}>Sweet Treats LR</Text>
                <Text style={brandTagline}>Cookies, Cakes, Shakes &amp; More</Text>
              </Column>
            </Row>
          </Section>

          {/* Main Card */}
          <Section style={card}>
            <Heading as="h1" style={heading}>
              Order Confirmed! 🍪
            </Heading>
            <Text style={greeting}>Hi {customerName},</Text>
            <Text style={leadText}>
              Thank you for ordering with Sweet Treats LR! We've received your order{" "}
              <strong>#{orderNumber}</strong> and will have your fresh batch ready for pickup.
            </Text>

            {/* Pickup Spot Box */}
            <Section style={pickupBox}>
              <Text style={pickupLabel}>YOUR PICKUP DETAILS</Text>
              <Text style={pickupSpotName}>{pickupLocationName}</Text>
              {pickupLocationAddress ? (
                <Text style={pickupSpotAddress}>{pickupLocationAddress}</Text>
              ) : null}
              <Text style={pickupWhen}>
                🗓️ Scheduled for: <strong>{pickupDate}</strong> at <strong>{pickupTime}</strong>
              </Text>
              {pickupLocationInstructions ? (
                <Text style={pickupInstructions}>
                  📌 <em>{pickupLocationInstructions}</em>
                </Text>
              ) : null}
            </Section>

            <Hr style={divider} />

            {/* Items Summary */}
            <Heading as="h2" style={sectionTitle}>
              Order Summary
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
                    Total Paid:
                  </td>
                  <td style={totalTd}>{formatMoney(subtotalCents)}</td>
                </tr>
              </tfoot>
            </table>

            {/* CTA Button to View Order */}
            <Section style={ctaSection}>
              <Button href={orderUrl} style={button}>
                View Order Status &amp; Details
              </Button>
            </Section>

            <Text style={helpText}>
              Questions about your order? Call our bakery desk at{" "}
              <a href="tel:5015550142" style={phoneLink}>
                (501) 555-0142
              </a>{" "}
              or message us on Instagram{" "}
              <a href="https://instagram.com/sweettreatslr" style={phoneLink}>
                @sweettreatslr
              </a>
              .
            </Text>
          </Section>

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              Sweet Treats LR • Handcrafted with love in Central Arkansas
            </Text>
            <Text style={footerSubtext}>Little Rock &amp; North Little Rock, Arkansas</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

CustomerOrderConfirmationEmail.PreviewProps = {
  orderNumber: "STLR-8821",
  orderId: "ord-preview-123",
  customerName: "Alex Rivera",
  pickupLocationName: "Little Rock Pickup (Downtown LR)",
  pickupLocationAddress: "400 President Clinton Ave, Little Rock, AR 72201",
  pickupLocationInstructions:
    "Pick up at the front counter. Curbside pickup available upon request.",
  pickupDate: "2026-10-14",
  pickupTime: "3:00 PM",
  subtotalCents: 2150,
  items: [
    { name: "Brown Butter Chocolate Chip", quantity: 3, lineTotalCents: 1050 },
    { name: "Strawberry Crunch", quantity: 2, lineTotalCents: 800 },
    { name: "Oatmeal Cream", quantity: 1, lineTotalCents: 300 },
  ],
  viewOrderUrl: "https://sweettreatslr.com/order/success",
} satisfies CustomerOrderConfirmationEmailProps;

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
  margin: "0 0 2px 0",
  fontSize: "20px",
  fontWeight: "800",
  color: "#241408",
  letterSpacing: "-0.5px",
};

const brandTagline: React.CSSProperties = {
  margin: 0,
  fontSize: "12px",
  color: "#8c6f4a",
  fontWeight: "600",
};

const card: React.CSSProperties = {
  backgroundColor: "#ffffff",
  borderRadius: "16px",
  padding: "28px",
  boxShadow: "0 4px 16px rgba(36, 20, 8, 0.08)",
  border: "1px solid #f1e2cc",
};

const heading: React.CSSProperties = {
  fontSize: "24px",
  fontWeight: "800",
  color: "#241408",
  margin: "0 0 14px 0",
  letterSpacing: "-0.5px",
};

const greeting: React.CSSProperties = {
  fontSize: "16px",
  fontWeight: "700",
  color: "#241408",
  margin: "0 0 8px 0",
};

const leadText: React.CSSProperties = {
  fontSize: "15px",
  color: "#5c4939",
  lineHeight: "1.5",
  margin: "0 0 20px 0",
};

const pickupBox: React.CSSProperties = {
  backgroundColor: "#fff8e7",
  padding: "16px",
  borderRadius: "12px",
  border: "1px solid #f6c453",
  marginBottom: "20px",
};

const pickupLabel: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: "700",
  color: "#8c6f4a",
  letterSpacing: "0.5px",
  margin: "0 0 6px 0",
};

const pickupSpotName: React.CSSProperties = {
  fontSize: "16px",
  fontWeight: "800",
  color: "#241408",
  margin: "0 0 4px 0",
};

const pickupSpotAddress: React.CSSProperties = {
  fontSize: "13px",
  color: "#6b5847",
  margin: "0 0 8px 0",
};

const pickupWhen: React.CSSProperties = {
  fontSize: "14px",
  color: "#241408",
  margin: "0 0 6px 0",
};

const pickupInstructions: React.CSSProperties = {
  fontSize: "13px",
  color: "#8c6f4a",
  margin: 0,
};

const sectionTitle: React.CSSProperties = {
  fontSize: "16px",
  fontWeight: "700",
  color: "#241408",
  margin: "0 0 12px 0",
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
  margin: "18px 0",
};

const button: React.CSSProperties = {
  backgroundColor: "#f6c453",
  color: "#241408",
  fontSize: "15px",
  fontWeight: "800",
  padding: "14px 28px",
  borderRadius: "10px",
  textDecoration: "none",
  display: "inline-block",
  boxSizing: "border-box",
  border: "1px solid #dfa732",
};

const helpText: React.CSSProperties = {
  fontSize: "13px",
  color: "#6b5847",
  textAlign: "center",
  lineHeight: "1.5",
  margin: "16px 0 0 0",
};

const phoneLink: React.CSSProperties = {
  color: "#241408",
  fontWeight: "600",
  textDecoration: "underline",
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
