import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { MapPin, Phone, Plus, Edit2, Trash2, CheckCircle2, XCircle, Info } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  deletePickupLocation,
  getAdminPickupLocations,
  savePickupLocation,
  type PickupLocation,
} from "../lib/api";

export const Route = createFileRoute("/admin/locations")({
  loader: () => getAdminPickupLocations(),
  component: AdminLocationsPage,
});

type LocationFormData = {
  id?: string;
  name: string;
  address: string;
  instructions: string;
  phone: string;
  active: boolean;
  sortOrder: number;
};

const emptyFormData: LocationFormData = {
  name: "",
  address: "",
  instructions: "",
  phone: "",
  active: true,
  sortOrder: 0,
};

function AdminLocationsPage() {
  const locations = Route.useLoaderData();
  const router = useRouter();
  const save = useServerFn(savePickupLocation);
  const remove = useServerFn(deletePickupLocation);

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<LocationFormData>(emptyFormData);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleStartAdd = () => {
    setFormData({
      ...emptyFormData,
      sortOrder: locations.length,
    });
    setIsEditing(true);
  };

  const handleStartEdit = (loc: PickupLocation) => {
    setFormData({
      id: loc.id,
      name: loc.name,
      address: loc.address,
      instructions: loc.instructions ?? "",
      phone: loc.phone ?? "",
      active: loc.active,
      sortOrder: loc.sortOrder,
    });
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setFormData(emptyFormData);
  };

  const handleToggleActive = async (loc: PickupLocation) => {
    try {
      await save({
        data: {
          id: loc.id,
          name: loc.name,
          address: loc.address,
          instructions: loc.instructions ?? undefined,
          phone: loc.phone ?? undefined,
          active: !loc.active,
          sortOrder: loc.sortOrder,
        },
      });
      toast.success(loc.active ? `Deactivated "${loc.name}"` : `Activated "${loc.name}"`);
      await router.invalidate();
    } catch {
      toast.error("Failed to update location status");
    }
  };

  const handleDelete = async (loc: PickupLocation) => {
    if (locations.length <= 1) {
      toast.error("You must have at least one pickup location.");
      return;
    }
    if (!window.confirm(`Are you sure you want to delete "${loc.name}"?`)) {
      return;
    }

    setDeletingId(loc.id);
    try {
      await remove({ data: loc.id });
      toast.success(`Deleted "${loc.name}"`);
      await router.invalidate();
    } catch {
      toast.error("Failed to delete location");
    } finally {
      setDeletingId(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("Location name is required");
      return;
    }
    if (!formData.address.trim()) {
      toast.error("Street address is required");
      return;
    }

    setIsSaving(true);
    try {
      await save({
        data: {
          id: formData.id,
          name: formData.name.trim(),
          address: formData.address.trim(),
          instructions: formData.instructions.trim() || undefined,
          phone: formData.phone.trim() || undefined,
          active: formData.active,
          sortOrder: Number(formData.sortOrder) || 0,
        },
      });
      toast.success(formData.id ? "Location updated" : "New location added");
      setIsEditing(false);
      setFormData(emptyFormData);
      await router.invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save location");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="admin-main">
      <div className="section-head admin-heading">
        <div>
          <p className="eyebrow">Admin</p>
          <h1 className="page-title">Pickup locations</h1>
          <p className="muted" style={{ marginTop: "4px" }}>
            Manage the locations where customers can pick up sweet treats orders.
          </p>
        </div>
        {!isEditing && (
          <button
            type="button"
            className="primary-button"
            onClick={handleStartAdd}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <Plus size={18} aria-hidden="true" />
            <span>Add location</span>
          </button>
        )}
      </div>

      {/* Autonomous order routing info callout */}
      <div className="dispatch-notice-card" role="region" aria-label="Dispatch status">
        <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
          <Info size={20} className="dispatch-notice-icon" aria-hidden="true" />
          <div>
            <strong style={{ display: "block", color: "#2a160d", marginBottom: "2px" }}>
              Order Dispatch & Autonomous Operations
            </strong>
            <p style={{ margin: 0, fontSize: "0.86rem", color: "#5a3a20", lineHeight: 1.45 }}>
              Orders placed by customers are assigned to their chosen pickup spot. Currently, staff
              receives the order notification and calls the partner location to relay the ticket. As
              the system scales to autonomous routing, order tickets will be routed directly to
              location printers and track per-location inventory.
            </p>
          </div>
        </div>
      </div>

      {/* Add / Edit Form Modal or Card */}
      {isEditing && (
        <section className="panel" style={{ marginBottom: "24px", marginTop: "16px" }}>
          <h2
            style={{ margin: "0 0 16px", fontFamily: "var(--font-display)", fontSize: "1.25rem" }}
          >
            {formData.id ? "Edit Pickup Location" : "Add New Pickup Location"}
          </h2>
          <form onSubmit={handleSubmit} style={{ display: "grid", gap: "16px" }}>
            <div className="field-grid">
              <label className="field field-wide">
                <span className="field-label is-required">Location name</span>
                <input
                  type="text"
                  required
                  placeholder="e.g. West Little Rock Partner Pickup"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </label>

              <label className="field field-wide">
                <span className="field-label is-required">Address</span>
                <input
                  type="text"
                  required
                  placeholder="e.g. 11525 Cantrell Rd, Little Rock, AR 72212"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </label>

              <label className="field">
                <span className="field-label">Phone number</span>
                <input
                  type="tel"
                  placeholder="(501) 555-0102"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </label>

              <label className="field">
                <span className="field-label">Display sort order</span>
                <input
                  type="number"
                  min="0"
                  value={formData.sortOrder}
                  onChange={(e) => setFormData({ ...formData, sortOrder: Number(e.target.value) })}
                />
              </label>

              <label className="field field-wide">
                <span className="field-label">Pickup instructions</span>
                <textarea
                  rows={2}
                  placeholder="e.g. Curbside pickup in designated spots behind the store or bakery counter"
                  value={formData.instructions}
                  onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                />
              </label>

              <label
                className="field field-wide"
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: "10px",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={formData.active}
                  onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                  style={{ width: "18px", height: "18px" }}
                />
                <span style={{ fontWeight: 600 }}>Active (Available to customers at checkout)</span>
              </label>
            </div>

            <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
              <button type="submit" className="primary-button" disabled={isSaving}>
                {isSaving ? "Saving..." : formData.id ? "Update location" : "Create location"}
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={handleCancel}
                disabled={isSaving}
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Locations List */}
      <div style={{ display: "grid", gap: "14px", marginTop: "16px" }}>
        {locations.map((loc) => (
          <article key={loc.id} className="panel location-admin-card">
            <div className="location-admin-header">
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <MapPin size={20} className="location-admin-pin" aria-hidden="true" />
                <h2 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 750 }}>{loc.name}</h2>
                <span
                  className={loc.active ? "badge-active" : "badge-inactive"}
                  style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}
                >
                  {loc.active ? (
                    <>
                      <CheckCircle2 size={12} aria-hidden="true" />
                      Active
                    </>
                  ) : (
                    <>
                      <XCircle size={12} aria-hidden="true" />
                      Inactive
                    </>
                  )}
                </span>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  className="secondary-button compact-btn"
                  onClick={() => handleStartEdit(loc)}
                  aria-label={`Edit ${loc.name}`}
                  title="Edit location"
                >
                  <Edit2 size={14} aria-hidden="true" />
                  <span>Edit</span>
                </button>
                <button
                  type="button"
                  className="secondary-button compact-btn"
                  onClick={() => handleToggleActive(loc)}
                  title={loc.active ? "Deactivate location" : "Activate location"}
                >
                  {loc.active ? "Deactivate" : "Activate"}
                </button>
                <button
                  type="button"
                  className="secondary-button compact-btn danger-btn"
                  onClick={() => handleDelete(loc)}
                  disabled={deletingId === loc.id}
                  aria-label={`Delete ${loc.name}`}
                  title="Delete location"
                >
                  <Trash2 size={14} aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="location-admin-body">
              <p className="location-admin-address">{loc.address}</p>
              {loc.phone && (
                <p className="location-admin-phone">
                  <Phone size={14} aria-hidden="true" />
                  <a href={`tel:${loc.phone}`} className="text-link">
                    {loc.phone}
                  </a>
                  <span className="muted" style={{ fontSize: "0.8rem", marginLeft: "6px" }}>
                    (Staff dispatch contact)
                  </span>
                </p>
              )}
              {loc.instructions && (
                <p className="location-admin-instructions">
                  <strong>Pickup note:</strong> {loc.instructions}
                </p>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
