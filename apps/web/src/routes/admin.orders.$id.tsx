import { Link, useRouter, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { MapPin, Phone, Package, Printer, Truck } from "lucide-react";
import { toast } from "sonner";

import {
  getAdminDashboard,
  getAdminOrder,
  getShippingRatesForOrder,
  purchaseShippingLabel,
  updateOrderStatus,
} from "../lib/api";
import { formatMoney, orderStatusLabel } from "../lib/format";

export const Route = createFileRoute("/admin/orders/$id")({
  loader: async ({ params }) => {
    const [order, dashboard] = await Promise.all([
      getAdminOrder({ data: params.id }),
      getAdminDashboard(),
    ]);
    return { order, statuses: dashboard.statuses };
  },
  component: AdminOrderDetailPage,
});

/** Friendly copy for the shipping-status chip (carrier statuses from Shippo). */
function shippingStatusLabel(shippingStatus: string): string {
  switch (shippingStatus) {
    case "PRE_TRANSIT":
      return "Pre transit";
    case "TRANSIT":
      return "In transit";
    case "DELIVERED":
      return "Delivered";
    case "RETURNED":
      return "Returned";
    case "FAILURE":
      return "Delivery failed";
    case "label_created":
      return "Label purchased";
    default:
      return shippingStatus || "Label purchased";
  }
}

function AdminOrderDetailPage() {
  const { order, statuses } = Route.useLoaderData();
  const router = useRouter();
  const saveStatus = useServerFn(updateOrderStatus);

  if (!order) {
    return (
      <div className="admin-main">
        <section className="panel">Order not found.</section>
      </div>
    );
  }

  const handleStatusChange = async (status: string) => {
    await saveStatus({
      data: { id: order.id, status },
    });
    await router.invalidate();
    toast.success(`Order marked as ${orderStatusLabel(status)}`);
  };

  return (
    <div className="admin-main">
      <div className="section-head admin-heading">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <Link to="/admin/orders" className="text-link" style={{ fontSize: "0.9rem" }}>
              &larr; Back to orders
            </Link>
          </div>
          <p className="eyebrow">Order</p>
          <h1 className="page-title">{order.orderNumber}</h1>
        </div>
      </div>
      <div className="admin-detail-grid">
        <section className="panel">
          <p className="eyebrow">Customer</p>
          <h2>{order.customerName}</h2>
          <p>{order.customerEmail}</p>
          <p>{order.customerPhone}</p>
          <p className="muted">Notes: {order.notes || "None"}</p>
        </section>

        {order.fulfillmentType === "shipping" ? (
          <ShippingLabelSection
            order={order}
            statuses={statuses}
            onStatusChange={handleStatusChange}
          />
        ) : (
          <section className="panel">
            <p className="eyebrow">Pickup</p>
            <h2>
              {order.pickupDate} at {order.pickupTime}
            </h2>

            {order.pickupLocationName ? (
              <div className="pickup-location-detail" style={{ margin: "14px 0 10px" }}>
                <p
                  style={{
                    margin: 0,
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    color: "#1b0f08",
                  }}
                >
                  <MapPin size={16} aria-hidden="true" style={{ color: "#b9823b" }} />
                  <span>{order.pickupLocationName}</span>
                </p>
                {order.pickupLocation?.address ? (
                  <p className="muted" style={{ margin: "3px 0 0 22px", fontSize: "0.85rem" }}>
                    {order.pickupLocation.address}
                  </p>
                ) : null}
                {order.pickupLocation?.phone ? (
                  <p style={{ margin: "4px 0 0 22px", fontSize: "0.85rem" }}>
                    <a
                      href={`tel:${order.pickupLocation.phone}`}
                      className="text-link"
                      style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}
                    >
                      <Phone size={13} aria-hidden="true" />
                      Call location: {order.pickupLocation.phone}
                    </a>
                  </p>
                ) : null}
                {order.pickupLocation?.instructions ? (
                  <p
                    className="muted"
                    style={{ margin: "4px 0 0 22px", fontSize: "0.8rem", fontStyle: "italic" }}
                  >
                    Note: {order.pickupLocation.instructions}
                  </p>
                ) : null}
              </div>
            ) : null}

            <div
              className="dispatch-reminder"
              style={{
                background: "#fff9eb",
                border: "1.5px solid #d8ae6a",
                borderRadius: "8px",
                padding: "10px 12px",
                margin: "12px 0 16px",
                fontSize: "0.84rem",
                lineHeight: 1.4,
              }}
            >
              <strong style={{ display: "block", color: "#2a160d", marginBottom: "2px" }}>
                Staff Dispatch:
              </strong>
              Call {order.pickupLocationName || "the pickup spot"} to relay customer order ticket.
            </div>

            <label className="field">
              <span>Status</span>
              <select
                value={order.status}
                onChange={async (event) => {
                  await handleStatusChange(event.currentTarget.value);
                }}
              >
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {orderStatusLabel(status)}
                  </option>
                ))}
              </select>
            </label>
          </section>
        )}
      </div>
      <section className="panel" style={{ marginTop: 18 }}>
        <p className="eyebrow">Items</p>
        {order.items.map((item) => (
          <div className="receipt-line" key={item.id}>
            <span>
              {item.quantity} x {item.itemNameSnapshot}
            </span>
            <strong>{formatMoney(item.lineTotalCents)}</strong>
          </div>
        ))}
        <div className="receipt-line receipt-total">
          <span>Total</span>
          <strong>{formatMoney(order.subtotalCents)}</strong>
        </div>
      </section>
    </div>
  );
}

function ShippingLabelSection({
  order,
  statuses,
  onStatusChange,
}: {
  order: NonNullable<Awaited<ReturnType<typeof getAdminOrder>>>;
  statuses: readonly string[];
  onStatusChange: (status: string) => Promise<void>;
}) {
  const router = useRouter();
  const fetchRates = useServerFn(getShippingRatesForOrder);
  const buyLabel = useServerFn(purchaseShippingLabel);

  const [rates, setRates] = useState<
    Array<{
      objectId: string;
      amount: string;
      provider: string;
      serviceLevelName: string;
      estimatedDays: number | null;
    }>
  >([]);
  const [selectedRateId, setSelectedRateId] = useState("");
  const [loadingRates, setLoadingRates] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState("");

  const handleFetchRates = async () => {
    setError("");
    setLoadingRates(true);
    try {
      const res = await fetchRates({ data: order.id });
      setRates(res.rates);
      if (res.rates.length > 0) {
        setSelectedRateId(res.rates[0].objectId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch rates.");
    } finally {
      setLoadingRates(false);
    }
  };

  const handlePurchase = async () => {
    if (!selectedRateId) return;
    setError("");
    setPurchasing(true);
    try {
      await buyLabel({
        data: {
          orderId: order.id,
          rateId: selectedRateId,
        },
      });
      toast.success("Shipping label purchased!");
      await router.invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to purchase label.");
    } finally {
      setPurchasing(false);
    }
  };

  const hasPurchasedLabel = Boolean(order.shippoTransactionId && order.labelUrl);

  return (
    <section className="panel">
      <p className="eyebrow">Shipping & Label</p>
      <h2>{order.shippingServiceName || "USPS Delivery"}</h2>

      <div className="pickup-location-detail" style={{ margin: "14px 0 16px" }}>
        <p
          style={{
            margin: 0,
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            gap: "6px",
            color: "#1b0f08",
          }}
        >
          <MapPin size={16} aria-hidden="true" style={{ color: "#b9823b" }} />
          <span>
            {order.shippingName} — {order.shippingCity}, {order.shippingState} {order.shippingZip}
          </span>
        </p>
        <p className="muted" style={{ margin: "3px 0 0 22px", fontSize: "0.85rem" }}>
          {order.shippingLine1}
          {order.shippingLine2 ? `, ${order.shippingLine2}` : ""}
        </p>
        {order.shippingCents + order.handlingCents > 0 ? (
          <p className="muted" style={{ margin: "4px 0 0 22px", fontSize: "0.85rem" }}>
            Customer paid: ${((order.shippingCents + order.handlingCents) / 100).toFixed(2)} ( $
            {(order.shippingCents / 100).toFixed(2)} shipping + $
            {(order.handlingCents / 100).toFixed(2)} handling)
          </p>
        ) : null}
      </div>

      {hasPurchasedLabel ? (
        <div
          style={{
            background: "#fff9eb",
            border: "1.5px solid #d8ae6a",
            borderRadius: "8px",
            padding: "14px",
            marginBottom: "16px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "10px",
            }}
          >
            <div>
              <span
                style={{
                  display: "inline-block",
                  padding: "3px 8px",
                  borderRadius: "999px",
                  background: "#241408",
                  color: "#fff8e7",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: "6px",
                }}
              >
                {shippingStatusLabel(order.shippingStatus)}
              </span>
              {order.trackingNumber ? (
                <p style={{ margin: 0, fontSize: "0.9rem", fontWeight: 600 }}>
                  Tracking: {order.trackingNumber}
                  {order.trackingUrl ? (
                    <>
                      {" "}
                      &middot;{" "}
                      <a
                        href={order.trackingUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-link"
                      >
                        Track package &rarr;
                      </a>
                    </>
                  ) : null}
                </p>
              ) : null}
            </div>
            {order.labelUrl ? (
              <a
                href={order.labelUrl}
                target="_blank"
                rel="noreferrer"
                className="primary-button"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 16px",
                  fontSize: "0.88rem",
                }}
              >
                <Printer size={15} aria-hidden="true" />
                Print Label (PDF)
              </a>
            ) : null}
          </div>
        </div>
      ) : (
        <div
          style={{
            background: "#fffef8",
            border: "1.5px solid #ead8bf",
            borderRadius: "8px",
            padding: "14px",
            marginBottom: "16px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "10px",
            }}
          >
            <span
              style={{
                fontWeight: 700,
                fontSize: "0.9rem",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <Truck size={16} style={{ color: "#b9823b" }} /> Buy Shipping Label
            </span>
            <button
              type="button"
              className="ghost-button"
              onClick={handleFetchRates}
              disabled={loadingRates}
              style={{ fontSize: "0.82rem", padding: "4px 10px" }}
            >
              {loadingRates
                ? "Getting rates..."
                : rates.length > 0
                  ? "Refresh rates"
                  : "Fetch rates (cheapest first)"}
            </button>
          </div>

          {error ? (
            <p className="field-error" style={{ marginBottom: "10px" }} role="alert">
              {error}
            </p>
          ) : null}

          {rates.length > 0 ? (
            <div style={{ display: "grid", gap: "8px", marginBottom: "12px" }}>
              {rates.map((rate, idx) => (
                <label
                  key={rate.objectId}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    border:
                      selectedRateId === rate.objectId ? "2px solid #241408" : "1px solid #ead8bf",
                    background: selectedRateId === rate.objectId ? "#fff8e7" : "#fff",
                    cursor: "pointer",
                    fontSize: "0.88rem",
                  }}
                >
                  <input
                    type="radio"
                    name="adminShippingRate"
                    value={rate.objectId}
                    checked={selectedRateId === rate.objectId}
                    onChange={() => setSelectedRateId(rate.objectId)}
                  />
                  <div style={{ flex: 1 }}>
                    <strong>
                      {rate.provider} {rate.serviceLevelName}
                    </strong>
                    {idx === 0 ? (
                      <span
                        style={{
                          marginLeft: "8px",
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          padding: "2px 6px",
                          borderRadius: "4px",
                          background: "#e3f5e1",
                          color: "#1d6f28",
                        }}
                      >
                        Cheapest
                      </span>
                    ) : null}
                    {rate.estimatedDays != null ? (
                      <span className="muted" style={{ display: "block", fontSize: "0.78rem" }}>
                        {rate.estimatedDays === 1
                          ? "1 day delivery"
                          : `${rate.estimatedDays} days delivery`}
                      </span>
                    ) : null}
                  </div>
                  <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>
                    ${Number(rate.amount).toFixed(2)}
                  </span>
                </label>
              ))}

              <button
                type="button"
                className="primary-button"
                onClick={handlePurchase}
                disabled={purchasing || !selectedRateId}
                style={{
                  marginTop: "6px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                }}
              >
                <Package size={15} />
                {purchasing
                  ? "Purchasing label..."
                  : `Purchase label ($${Number(
                      rates.find((r) => r.objectId === selectedRateId)?.amount || 0,
                    ).toFixed(2)})`}
              </button>
            </div>
          ) : !loadingRates ? (
            <p className="muted" style={{ fontSize: "0.84rem", margin: 0 }}>
              Click &quot;Fetch rates&quot; to compare carrier pricing and buy a shipping label.
            </p>
          ) : null}
        </div>
      )}

      <label className="field">
        <span>Order Status</span>
        <select value={order.status} onChange={(e) => onStatusChange(e.currentTarget.value)}>
          {statuses.map((status) => (
            <option key={status} value={status}>
              {orderStatusLabel(status)}
            </option>
          ))}
        </select>
      </label>
    </section>
  );
}
