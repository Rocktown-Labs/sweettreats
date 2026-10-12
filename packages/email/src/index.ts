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

export { getResendClient } from "./client";
export {
  sendAdminOrderEmail,
  sendCustomerOrderEmail,
  sendMagicLinkEmail,
  type SendEmailResult,
} from "./send";
export { render, renderAsync } from "@react-email/render";
