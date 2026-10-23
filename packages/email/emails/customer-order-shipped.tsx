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
  Row,
  Column,
  Img,
} from "@react-email/components";

export interface CustomerOrderShippedEmailProps {
  orderNumber: string;
  customerName: string;
  trackingNumber: string;
  serviceName?: string;
  /** Direct carrier tracking link (USPS) built from the tracking number. */
  trackingUrl?: string;
}

export default function CustomerOrderShippedEmail({
  orderNumber = "STLR-8821",
  customerName = "Valued Customer",
  trackingNumber = "9400100000000000000000",
  serviceName = "USPS Ground Advantage",
  trackingUrl = "https://tools.usps.com/go/TrackConfirmAction?tLabels=9400100000000000000000",
}: CustomerOrderShippedEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>Your Sweet Treats LR order #{orderNumber} has shipped! 🍪</Preview>
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
              Your cookies are on the way! 🚚
            </Heading>
            <Text style={greeting}>Hi {customerName},</Text>
            <Text style={leadText}>
              Good news — your order <strong>#{orderNumber}</strong> was baked fresh, boxed up, and
              handed to the carrier. It&apos;s heading to you via{" "}
              <strong>{serviceName || "USPS"}</strong>.
            </Text>

            {/* Tracking Box */}
            <Section style={trackingBox}>
              <Text style={trackingLabel}>TRACKING NUMBER</Text>
              <Text style={trackingValue}>{trackingNumber}</Text>
              {trackingUrl ? (
                <Section style={ctaSection}>
                  <Button href={trackingUrl} style={button}>
                    Track Your Package
                  </Button>
                </Section>
              ) : null}
              <Text style={trackingHint}>
                USPS usually delivers in 1–3 days. Keep the cookies somewhere cool until it&apos;s
                snack time!
              </Text>
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

CustomerOrderShippedEmail.PreviewProps = {
  orderNumber: "STLR-8821",
  customerName: "Alex Rivera",
  trackingNumber: "9400100000000000000000",
  serviceName: "USPS Ground Advantage",
  trackingUrl: "https://tools.usps.com/go/TrackConfirmAction?tLabels=9400100000000000000000",
} satisfies CustomerOrderShippedEmailProps;

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

const trackingBox: React.CSSProperties = {
  backgroundColor: "#fff8e7",
  padding: "20px 16px",
  borderRadius: "12px",
  border: "1px solid #f6c453",
  textAlign: "center",
};

const trackingLabel: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: "700",
  color: "#8c6f4a",
  letterSpacing: "0.5px",
  margin: "0 0 4px 0",
};

const trackingValue: React.CSSProperties = {
  fontSize: "18px",
  fontWeight: "800",
  color: "#241408",
  letterSpacing: "0.5px",
  margin: "0 0 14px 0",
};

const ctaSection: React.CSSProperties = {
  textAlign: "center",
  margin: "0 0 14px 0",
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

const trackingHint: React.CSSProperties = {
  fontSize: "13px",
  color: "#6b5847",
  lineHeight: "1.5",
  margin: "0 0 4px 0",
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
