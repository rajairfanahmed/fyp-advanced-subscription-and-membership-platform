import { connectToMongoDB } from "@/lib/mongodb/connect";
import {
  PlatformSettingsModel,
  type PlatformSettingsDocument,
} from "@/lib/mongodb/models";
import type {
  AdminPlatformSettingsInput,
  AdminPlatformSettingsResponse,
} from "@/types/admin-stats";

const SINGLETON_KEY = "primary";

const ALLOWED_TIERS: AdminPlatformSettingsResponse["defaultSubscriberTier"][] = [
  "free",
  "pending",
];
const ALLOWED_CREATOR_STATUS: AdminPlatformSettingsResponse["defaultCreatorStatus"][] = [
  "review",
  "active",
];
const ALLOWED_CURRENCIES: AdminPlatformSettingsResponse["platformCurrency"][] = [
  "usd",
  "eur",
  "gbp",
];
const ALLOWED_BILLING_CYCLES: AdminPlatformSettingsResponse["defaultBillingCycle"][] =
  ["monthly", "annually"];
const ALLOWED_FAILURE_CADENCE: AdminPlatformSettingsResponse["failureAlertCadence"][] =
  ["immediate", "daily"];

function serialize(doc: PlatformSettingsDocument): AdminPlatformSettingsResponse {
  return {
    platformDisplayName: doc.platformDisplayName ?? "Nexora",
    supportEmail: doc.supportEmail ?? "support@nexora.com",
    defaultSubscriberTier:
      (doc.defaultSubscriberTier as
        | AdminPlatformSettingsResponse["defaultSubscriberTier"]
        | undefined) ?? "free",
    defaultCreatorStatus:
      (doc.defaultCreatorStatus as
        | AdminPlatformSettingsResponse["defaultCreatorStatus"]
        | undefined) ?? "review",
    platformCurrency:
      (doc.platformCurrency as
        | AdminPlatformSettingsResponse["platformCurrency"]
        | undefined) ?? "usd",
    defaultBillingCycle:
      (doc.defaultBillingCycle as
        | AdminPlatformSettingsResponse["defaultBillingCycle"]
        | undefined) ?? "monthly",
    renewalReminderLeadDays: doc.renewalReminderLeadDays ?? 7,
    failureAlertCadence:
      (doc.failureAlertCadence as
        | AdminPlatformSettingsResponse["failureAlertCadence"]
        | undefined) ?? "immediate",
    maintenanceMode: doc.maintenanceMode ?? false,
  };
}

/**
 * Load the singleton platform settings doc, creating it on first
 * access with safe defaults.
 */
export async function loadPlatformSettings(): Promise<AdminPlatformSettingsResponse> {
  await connectToMongoDB();
  const existing = await PlatformSettingsModel.findOne({
    singletonKey: SINGLETON_KEY,
  });
  if (existing) return serialize(existing);

  const created = await PlatformSettingsModel.create({
    singletonKey: SINGLETON_KEY,
  });
  return serialize(created);
}

/**
 * Apply a partial update to platform settings. Only whitelisted
 * fields are accepted; unknown keys are silently dropped.
 */
export async function updatePlatformSettings(
  input: AdminPlatformSettingsInput
): Promise<AdminPlatformSettingsResponse> {
  await connectToMongoDB();

  const update: Record<string, unknown> = {};

  if (typeof input.platformDisplayName === "string") {
    const trimmed = input.platformDisplayName.trim();
    if (!trimmed) throw new Error("Platform display name cannot be empty.");
    if (trimmed.length > 80)
      throw new Error("Platform display name is too long.");
    update.platformDisplayName = trimmed;
  }
  if (typeof input.supportEmail === "string") {
    const trimmed = input.supportEmail.trim().toLowerCase();
    if (!trimmed) throw new Error("Support email cannot be empty.");
    if (!/^\S+@\S+\.\S+$/.test(trimmed))
      throw new Error("Support email is not valid.");
    update.supportEmail = trimmed;
  }
  if (
    typeof input.defaultSubscriberTier === "string" &&
    ALLOWED_TIERS.includes(input.defaultSubscriberTier)
  ) {
    update.defaultSubscriberTier = input.defaultSubscriberTier;
  }
  if (
    typeof input.defaultCreatorStatus === "string" &&
    ALLOWED_CREATOR_STATUS.includes(input.defaultCreatorStatus)
  ) {
    update.defaultCreatorStatus = input.defaultCreatorStatus;
  }
  if (
    typeof input.platformCurrency === "string" &&
    ALLOWED_CURRENCIES.includes(input.platformCurrency)
  ) {
    update.platformCurrency = input.platformCurrency;
  }
  if (
    typeof input.defaultBillingCycle === "string" &&
    ALLOWED_BILLING_CYCLES.includes(input.defaultBillingCycle)
  ) {
    update.defaultBillingCycle = input.defaultBillingCycle;
  }
  if (
    typeof input.renewalReminderLeadDays === "number" &&
    Number.isFinite(input.renewalReminderLeadDays)
  ) {
    const days = Math.max(0, Math.min(30, Math.round(input.renewalReminderLeadDays)));
    update.renewalReminderLeadDays = days;
  }
  if (
    typeof input.failureAlertCadence === "string" &&
    ALLOWED_FAILURE_CADENCE.includes(input.failureAlertCadence)
  ) {
    update.failureAlertCadence = input.failureAlertCadence;
  }
  if (typeof input.maintenanceMode === "boolean") {
    update.maintenanceMode = input.maintenanceMode;
  }

  const doc = await PlatformSettingsModel.findOneAndUpdate(
    { singletonKey: SINGLETON_KEY },
    { $set: update, $setOnInsert: { singletonKey: SINGLETON_KEY } },
    { upsert: true, returnDocument: "after" }
  );
  if (!doc) throw new Error("Failed to update platform settings.");
  return serialize(doc);
}
