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

export interface AbandonedCartEmailProps {
  name?: string;
  items: { name: string; quantity: number }[];
  subtotalCents: number;
  menuUrl?: string;
}

export default function AbandonedCartEmail({
  name = "Friend",
  items = [{ name: "Brown Butter Chocolate Chip", quantity: 2 }],
  subtotalCents = 700,
  menuUrl = "https://sweettreatslr.com/menu",
}: AbandonedCartEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>Your cookies are still in the box 🍪</Preview>
      <Body style={main}>
        <Container style={container}>
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

          <Section style={card}>
            <Heading as="h1" style={heading}>
              Still craving these, {name}?
            </Heading>
            <Text style={leadText}>
              You left these in your cart — they&apos;re baked fresh daily, so they only get better
              the sooner you order:
            </Text>

            <Section style={itemsBox}>
              {items.slice(0, 5).map((item) => (
                <Text key={item.name} style={itemLine}>
                  <strong>{item.quantity}×</strong> {item.name}
                </Text>
              ))}
              {items.length > 5 ? (
                <Text style={itemLine}>…plus {items.length - 5} more</Text>
              ) : null}
              <Hr style={divider} />
              <Text style={totalLine}>
                Cart total: <strong>${(subtotalCents / 100).toFixed(2)}</strong>
              </Text>
            </Section>

            <Section style={ctaSection}>
              <Button href={menuUrl} style={button}>
                Finish my order
              </Button>
            </Section>

            <Hr style={divider} />

            <Text style={subtext}>
              Pickup in Little Rock &amp; North Little Rock or shipping where available. If you
              didn&apos;t mean to leave these behind, no worries — ignore this note.
            </Text>
          </Section>

          <Section style={footer}>
            <Text style={footerText}>Sweet Treats LR • Little Rock &amp; North Little Rock</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const main: React.CSSProperties = {
  backgroundColor: "#fff8e7",
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  padding: "24px 0",
};

const container: React.CSSProperties = {
  maxWidth: "540px",
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
  fontSize: "22px",
  fontWeight: "800",
  color: "#241408",
  margin: "0 0 12px 0",
  letterSpacing: "-0.5px",
};

const leadText: React.CSSProperties = {
  fontSize: "15px",
  color: "#5c4939",
  lineHeight: "1.5",
  margin: "0 0 16px 0",
};

const itemsBox: React.CSSProperties = {
  backgroundColor: "#fff8e7",
  borderRadius: "12px",
  padding: "14px 18px",
  margin: "0 0 20px 0",
};

const itemLine: React.CSSProperties = {
  fontSize: "14px",
  color: "#4a2a12",
  margin: "0 0 6px 0",
};

const totalLine: React.CSSProperties = {
  fontSize: "15px",
  color: "#241408",
  fontWeight: "600",
  margin: 0,
};

const ctaSection: React.CSSProperties = {
  textAlign: "center",
  margin: "8px 0 8px",
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

const subtext: React.CSSProperties = {
  fontSize: "12px",
  color: "#8c6f4a",
  textAlign: "center",
  margin: 0,
};

const divider: React.CSSProperties = {
  border: "none",
  borderTop: "1px solid #ead8bf",
  margin: "10px 0",
};

const footer: React.CSSProperties = {
  marginTop: "24px",
  textAlign: "center",
};

const footerText: React.CSSProperties = {
  fontSize: "12px",
  color: "#b09878",
  margin: 0,
};
