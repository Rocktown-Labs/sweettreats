export { default as AdminOrderNotificationEmail } from "../emails/admin-order-notification";
export type {
  AdminOrderNotificationEmailProps,
  OrderItemProp,
} from "../emails/admin-order-notification";

export { default as CustomerOrderConfirmationEmail } from "../emails/customer-order-confirmation";
export type {
  CustomerOrderConfirmationEmailProps,
  CustomerOrderItemProp,
} from "../emails/customer-order-confirmation";

export { default as MagicLinkEmail } from "../emails/magic-link";
export type { MagicLinkEmailProps } from "../emails/magic-link";

export { default as VerifyEmail } from "../emails/verify-email";
export type { VerifyEmailProps } from "../emails/verify-email";

export { default as WelcomeEmail } from "../emails/welcome-email";
export type { WelcomeEmailProps } from "../emails/welcome-email";

export { default as AbandonedCartEmail } from "../emails/abandoned-cart-email";
export type { AbandonedCartEmailProps } from "../emails/abandoned-cart-email";

export { getResendClient } from "./client";
export {
  sendAbandonedCartEmail,
  sendAdminOrderEmail,
  sendCustomerOrderEmail,
  sendMagicLinkEmail,
  sendVerifyEmail,
  sendWelcomeEmail,
  type SendEmailResult,
} from "./send";
export { render, renderAsync } from "@react-email/render";
