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

export interface CustomerOrderDeliveredEmailProps {
  orderNumber: string;
  customerName: string;
  trackingNumber: string;
  /** Direct carrier tracking link (USPS) built from the tracking number. */
  trackingUrl?: string;
  /** Instagram URL for the "tell us how they taste" nudge. */
  instagramUrl?: string;
}

export default function CustomerOrderDeliveredEmail({
  orderNumber = "STLR-8821",
  customerName = "Valued Customer",
  trackingNumber = "9400100000000000000000",
  trackingUrl = "https://tools.usps.com/go/TrackConfirmAction?tLabels=9400100000000000000000",
  instagramUrl = "https://instagram.com/sweettreatslr",
}: CustomerOrderDeliveredEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>Your Sweet Treats LR order #{orderNumber} was delivered! 🎉</Preview>
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
              Delivered! Enjoy every bite 🍪
            </Heading>
            <Text style={greeting}>Hi {customerName},</Text>
            <Text style={leadText}>
              Your order <strong>#{orderNumber}</strong> was marked delivered by USPS. We hope the
              cookies arrive as fresh as they left the oven — warm-ish, sweet, and impossible to
              share.
            </Text>

            <Section style={trackingBox}>
              <Text style={trackingLabel}>ORDER &amp; TRACKING</Text>
              <Text style={trackingValue}>
                #{orderNumber} · {trackingNumber}
              </Text>
              {trackingUrl ? (
                <Section style={ctaSection}>
                  <Button href={trackingUrl} style={button}>
                    View Delivery Details
                  </Button>
                </Section>
              ) : null}
            </Section>

            <Text style={leadText}>
              If anything arrived less than perfect, call our bakery desk at{" "}
              <a href="tel:5015550142" style={phoneLink}>
                (501) 555-0142
              </a>{" "}
              and we&apos;ll make it right. And if they were exactly perfect — tell the world{" "}
              <a href={instagramUrl} style={phoneLink}>
                @sweettreatslr
              </a>
              . We read every post.
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

CustomerOrderDeliveredEmail.PreviewProps = {
  orderNumber: "STLR-8821",
  customerName: "Alex Rivera",
  trackingNumber: "9400100000000000000000",
} satisfies CustomerOrderDeliveredEmailProps;

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
  fontSize: "16px",
  fontWeight: "800",
  color: "#241408",
  letterSpacing: "0.5px",
  margin: "0 0 14px 0",
};

const ctaSection: React.CSSProperties = {
  textAlign: "center",
  margin: "0 0 6px 0",
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
