import * as React from "react";
import { render } from "@react-email/render";
import { getResendClient } from "./client";
import AdminOrderNotificationEmail, {
  type AdminOrderNotificationEmailProps,
} from "../emails/admin-order-notification";
import CustomerOrderConfirmationEmail, {
  type CustomerOrderConfirmationEmailProps,
} from "../emails/customer-order-confirmation";
import CustomerOrderShippedEmail, {
  type CustomerOrderShippedEmailProps,
} from "../emails/customer-order-shipped";
import CustomerOrderDeliveredEmail, {
  type CustomerOrderDeliveredEmailProps,
} from "../emails/customer-order-delivered";
import MagicLinkEmail, { type MagicLinkEmailProps } from "../emails/magic-link";
import VerifyEmail, { type VerifyEmailProps } from "../emails/verify-email";
import WelcomeEmail, { type WelcomeEmailProps } from "../emails/welcome-email";
import AbandonedCartEmail, { type AbandonedCartEmailProps } from "../emails/abandoned-cart-email";

export interface SendEmailResult {
  success: boolean;
  id?: string;
  error?: string;
  mocked?: boolean;
}

const DEFAULT_FROM_EMAIL = "Sweet Treats LR <noreply@orders.sweettreatslr.com>";

export async function sendAdminOrderEmail(
  props: AdminOrderNotificationEmailProps,
  options?: {
    to?: string | string[];
    from?: string;
    apiKey?: string;
  },
): Promise<SendEmailResult> {
  const recipients = options?.to
    ? Array.isArray(options.to)
      ? options.to
      : [options.to]
    : ["lauryan0311@gmail.com", "admin@sweettreatslr.com"];

  const from = options?.from || DEFAULT_FROM_EMAIL;
  const resend = getResendClient(options?.apiKey);

  const element = React.createElement(AdminOrderNotificationEmail, props);
  const html = await render(element);
  const text = await render(element, { plainText: true });

  const subject = `New Order #${props.orderNumber} • ${props.customerName} ($${(props.subtotalCents / 100).toFixed(2)})`;

  if (!resend) {
    console.info(
      JSON.stringify({
        event: "email.admin_order_notification_simulated",
        orderId: props.orderId,
        orderNumber: props.orderNumber,
        recipients,
        subject,
      }),
    );
    return { success: true, mocked: true };
  }

  const { data, error } = await resend.emails.send(
    {
      from,
      to: recipients,
      subject,
      html,
      text,
    },
    {
      idempotencyKey: `admin-order/${props.orderId}`,
    },
  );

  if (error) {
    console.error(
      JSON.stringify({
        event: "email.admin_order_notification_failed",
        orderId: props.orderId,
        error: error.message,
      }),
    );
    return { success: false, error: error.message };
  }

  return { success: true, id: data?.id };
}

export async function sendCustomerOrderEmail(
  props: CustomerOrderConfirmationEmailProps,
  options: {
    to: string;
    from?: string;
    apiKey?: string;
  },
): Promise<SendEmailResult> {
  const from = options.from || DEFAULT_FROM_EMAIL;
  const resend = getResendClient(options.apiKey);

  const element = React.createElement(CustomerOrderConfirmationEmail, props);
  const html = await render(element);
  const text = await render(element, { plainText: true });

  const subject = `Your Sweet Treats LR Order #${props.orderNumber} is Confirmed!`;

  if (!resend) {
    console.info(
      JSON.stringify({
        event: "email.customer_order_confirmation_simulated",
        orderId: props.orderId,
        orderNumber: props.orderNumber,
        to: options.to,
        subject,
      }),
    );
    return { success: true, mocked: true };
  }

  const { data, error } = await resend.emails.send(
    {
      from,
      to: options.to,
      subject,
      html,
      text,
    },
    {
      idempotencyKey: `customer-order/${props.orderId}`,
    },
  );

  if (error) {
    console.error(
      JSON.stringify({
        event: "email.customer_order_confirmation_failed",
        orderId: props.orderId,
        error: error.message,
      }),
    );
    return { success: false, error: error.message };
  }

  return { success: true, id: data?.id };
}

export async function sendVerifyEmail(
  props: VerifyEmailProps,
  options: {
    to: string;
    from?: string;
    apiKey?: string;
  },
): Promise<SendEmailResult> {
  const from = options.from || DEFAULT_FROM_EMAIL;
  const resend = getResendClient(options.apiKey);

  const element = React.createElement(VerifyEmail, props);
  const html = await render(element);
  const text = await render(element, { plainText: true });

  const subject = "Verify your Sweet Treats LR email";

  if (!resend) {
    console.info(
      JSON.stringify({
        event: "email.verify_email_simulated",
        to: options.to,
      }),
    );
    return { success: true, mocked: true };
  }

  const { data, error } = await resend.emails.send({
    from,
    to: options.to,
    subject,
    html,
    text,
  });

  if (error) {
    console.error(
      JSON.stringify({
        event: "email.verify_email_failed",
        to: options.to,
        error: error.message,
      }),
    );
    return { success: false, error: error.message };
  }

  return { success: true, id: data?.id };
}

export async function sendWelcomeEmail(
  props: WelcomeEmailProps,
  options: {
    to: string;
    from?: string;
    apiKey?: string;
  },
): Promise<SendEmailResult> {
  const from = options.from || DEFAULT_FROM_EMAIL;
  const resend = getResendClient(options.apiKey);

  const element = React.createElement(WelcomeEmail, props);
  const html = await render(element);
  const text = await render(element, { plainText: true });

  const subject = "Welcome to Sweet Treats LR!";

  if (!resend) {
    console.info(
      JSON.stringify({
        event: "email.welcome_simulated",
        to: options.to,
      }),
    );
    return { success: true, mocked: true };
  }

  const { data, error } = await resend.emails.send(
    {
      from,
      to: options.to,
      subject,
      html,
      text,
    },
    {
      idempotencyKey: `welcome/${options.to}`,
    },
  );

  if (error) {
    console.error(
      JSON.stringify({
        event: "email.welcome_failed",
        to: options.to,
        error: error.message,
      }),
    );
    return { success: false, error: error.message };
  }

  return { success: true, id: data?.id };
}

export async function sendAbandonedCartEmail(
  props: AbandonedCartEmailProps,
  options: {
    to: string;
    cartId: string;
    from?: string;
    apiKey?: string;
  },
): Promise<SendEmailResult> {
  const from = options.from || DEFAULT_FROM_EMAIL;
  const resend = getResendClient(options.apiKey);

  const element = React.createElement(AbandonedCartEmail, props);
  const html = await render(element);
  const text = await render(element, { plainText: true });

  const subject = "Your cookies are still in the box 🍪";

  if (!resend) {
    console.info(
      JSON.stringify({
        event: "email.abandoned_cart_simulated",
        to: options.to,
        cartId: options.cartId,
      }),
    );
    return { success: true, mocked: true };
  }

  const { data, error } = await resend.emails.send(
    {
      from,
      to: options.to,
      subject,
      html,
      text,
    },
    {
      // One abandonment email per cart, ever — retried queue deliveries must
      // not spam the customer.
      idempotencyKey: `abandoned-cart/${options.cartId}`,
    },
  );

  if (error) {
    console.error(
      JSON.stringify({
        event: "email.abandoned_cart_failed",
        to: options.to,
        cartId: options.cartId,
        error: error.message,
      }),
    );
    return { success: false, error: error.message };
  }

  return { success: true, id: data?.id };
}

export async function sendMagicLinkEmail(
  props: MagicLinkEmailProps,
  options: {
    to: string;
    from?: string;
    apiKey?: string;
  },
): Promise<SendEmailResult> {
  const from = options.from || DEFAULT_FROM_EMAIL;
  const resend = getResendClient(options.apiKey);

  const element = React.createElement(MagicLinkEmail, props);
  const html = await render(element);
  const text = await render(element, { plainText: true });

  const subject = "Your Sign-In Link for Sweet Treats LR";

  if (!resend) {
    console.info(
      JSON.stringify({
        event: "email.magic_link_simulated",
        to: options.to,
        url: props.url,
      }),
    );
    return { success: true, mocked: true };
  }

  const { data, error } = await resend.emails.send({
    from,
    to: options.to,
    subject,
    html,
    text,
  });

  if (error) {
    console.error(
      JSON.stringify({
        event: "email.magic_link_failed",
        to: options.to,
        error: error.message,
      }),
    );
    return { success: false, error: error.message };
  }

  return { success: true, id: data?.id };
}

export async function sendCustomerShippedEmail(
  props: CustomerOrderShippedEmailProps,
  options: {
    to: string;
    from?: string;
    apiKey?: string;
  },
): Promise<SendEmailResult> {
  const from = options.from || DEFAULT_FROM_EMAIL;
  const resend = getResendClient(options.apiKey);

  const element = React.createElement(CustomerOrderShippedEmail, props);
  const html = await render(element);
  const text = await render(element, { plainText: true });

  const subject = `Your Sweet Treats LR Order #${props.orderNumber} Has Shipped! 🚚`;

  if (!resend) {
    console.info(
      JSON.stringify({
        event: "email.customer_order_shipped_simulated",
        orderNumber: props.orderNumber,
        to: options.to,
        subject,
      }),
    );
    return { success: true, mocked: true };
  }

  const { data, error } = await resend.emails.send(
    {
      from,
      to: options.to,
      subject,
      html,
      text,
    },
    {
      idempotencyKey: `customer-order-shipped/${props.orderNumber}`,
    },
  );

  if (error) {
    console.error(
      JSON.stringify({
        event: "email.customer_order_shipped_failed",
        orderNumber: props.orderNumber,
        error: error.message,
      }),
    );
    return { success: false, error: error.message };
  }

  return { success: true, id: data?.id };
}

export async function sendCustomerDeliveredEmail(
  props: CustomerOrderDeliveredEmailProps,
  options: {
    to: string;
    from?: string;
    apiKey?: string;
  },
): Promise<SendEmailResult> {
  const from = options.from || DEFAULT_FROM_EMAIL;
  const resend = getResendClient(options.apiKey);

  const element = React.createElement(CustomerOrderDeliveredEmail, props);
  const html = await render(element);
  const text = await render(element, { plainText: true });

  const subject = `Your Sweet Treats LR Order #${props.orderNumber} Was Delivered! 🍪`;

  if (!resend) {
    console.info(
      JSON.stringify({
        event: "email.customer_order_delivered_simulated",
        orderNumber: props.orderNumber,
        to: options.to,
        subject,
      }),
    );
    return { success: true, mocked: true };
  }

  const { data, error } = await resend.emails.send(
    {
      from,
      to: options.to,
      subject,
      html,
      text,
    },
    {
      idempotencyKey: `customer-order-delivered/${props.orderNumber}`,
    },
  );

  if (error) {
    console.error(
      JSON.stringify({
        event: "email.customer_order_delivered_failed",
        orderNumber: props.orderNumber,
        error: error.message,
      }),
    );
    return { success: false, error: error.message };
  }

  return { success: true, id: data?.id };
}
