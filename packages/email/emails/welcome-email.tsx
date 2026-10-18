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

export interface WelcomeEmailProps {
  name?: string;
  menuUrl?: string;
}

export default function WelcomeEmail({
  name = "Friend",
  menuUrl = "https://sweettreatslr.com/menu",
}: WelcomeEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>Welcome to Sweet Treats LR 🍪</Preview>
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
              Welcome, {name}!
            </Heading>
            <Text style={leadText}>
              Thanks for creating an account with Sweet Treats LR. Your account keeps your order
              history in one place, and we&apos;ll email you a receipt and pickup or tracking
              details for every order.
            </Text>
            <Text style={leadText}>
              Fresh cookies are baked daily in Little Rock — order ahead and skip the line.
            </Text>

            <Section style={ctaSection}>
              <Button href={menuUrl} style={button}>
                Browse the menu
              </Button>
            </Section>

            <Hr style={divider} />

            <Text style={subtext}>
              Pickups in Little Rock &amp; North Little Rock, or shipping straight to your door
              where available.
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

const ctaSection: React.CSSProperties = {
  textAlign: "center",
  margin: "8px 0 20px",
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
  margin: "20px 0 12px",
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
