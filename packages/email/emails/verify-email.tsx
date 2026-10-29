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

export interface VerifyEmailProps {
  url: string;
  email?: string;
}

export default function VerifyEmail({
  url = "https://sweettreatslr.com/api/auth/verify-email?token=sample",
  email = "customer@example.com",
}: VerifyEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>Verify your Sweet Treats LR email address</Preview>
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

          {/* Card */}
          <Section style={card}>
            <Heading as="h1" style={heading}>
              Confirm your email address
            </Heading>
            <Text style={leadText}>
              Welcome! Confirm <strong>{email}</strong> to finish setting up your Sweet Treats LR
              account and start tracking your orders.
            </Text>

            <Section style={ctaSection}>
              <Button href={url} style={button}>
                Verify My Email
              </Button>
            </Section>

            <Text style={subtext}>Or copy and paste this secure link into your browser:</Text>
            <Text style={urlText}>
              <a href={url} style={link}>
                {url}
              </a>
            </Text>

            <Hr style={divider} />

            <Text style={securityNotice}>
              🔒 If you did not create a Sweet Treats LR account, you can safely ignore this email.
            </Text>
          </Section>

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>Sweet Treats LR • Little Rock &amp; North Little Rock</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

VerifyEmail.PreviewProps = {
  url: "https://sweettreatslr.com/api/auth/verify-email?token=sample-token-123",
  email: "customer@example.com",
} satisfies VerifyEmailProps;

// Styles
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
  margin: "0 0 24px 0",
};

const ctaSection: React.CSSProperties = {
  textAlign: "center",
  margin: "20px 0",
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
  margin: "16px 0 4px 0",
};

const urlText: React.CSSProperties = {
  fontSize: "12px",
  color: "#6b5847",
  textAlign: "center",
  wordBreak: "break-all",
  margin: "0 0 16px 0",
};

const link: React.CSSProperties = {
  color: "#241408",
  textDecoration: "underline",
};

const divider: React.CSSProperties = {
  border: "none",
  borderTop: "1px solid #ead8bf",
  margin: "20px 0",
};

const securityNotice: React.CSSProperties = {
  fontSize: "12px",
  color: "#8c6f4a",
  textAlign: "center",
  lineHeight: "1.5",
  margin: 0,
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
