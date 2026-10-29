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

export interface MagicLinkEmailProps {
  url: string;
  email?: string;
  isNewAccount?: boolean;
}

export default function MagicLinkEmail({
  url = "https://sweettreatslr.com/api/auth/verify?token=sample",
  email = "customer@example.com",
  isNewAccount = false,
}: MagicLinkEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>Your Sweet Treats LR sign-in link</Preview>
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
              {isNewAccount ? "Welcome to Sweet Treats LR!" : "Sign In to Your Account"}
            </Heading>
            <Text style={leadText}>
              Click the button below to securely sign in to Sweet Treats LR with{" "}
              <strong>{email}</strong>. No password needed!
            </Text>

            <Section style={ctaSection}>
              <Button href={url} style={button}>
                {isNewAccount ? "Activate & Sign In" : "Sign In to Sweet Treats LR"}
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
              🔒 This link will expire in 15 minutes. If you did not request this link, you can
              safely ignore this email — your account remains completely secure.
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

MagicLinkEmail.PreviewProps = {
  url: "https://sweettreatslr.com/api/auth/magic-link/verify?token=sample-token-123",
  email: "customer@example.com",
  isNewAccount: false,
} satisfies MagicLinkEmailProps;

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
  lineHeight: "1.5",
  margin: 0,
};

const footer: React.CSSProperties = {
  textAlign: "center",
  marginTop: "24px",
};

const footerText: React.CSSProperties = {
  fontSize: "12px",
  color: "#8c6f4a",
  margin: 0,
  fontWeight: "600",
};
