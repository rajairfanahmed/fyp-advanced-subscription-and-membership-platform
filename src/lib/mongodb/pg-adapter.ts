/**
 * Mongoose-shaped data access on PostgreSQL so existing Advanced Subscription & Membership Platform services
 * keep working after the Mongo -> Postgres move.
 */
import { pgQuery } from "@/lib/db/pool";
import { isRecordId } from "@/lib/db/ids";

type Filter = Record<string, unknown>;
type SortSpec = Record<string, 1 | -1>;

const CAMEL_TO_SNAKE: Record<string, string> = {
  clerkUserId: "clerk_user_id",
  userProfileId: "user_profile_id",
  creatorName: "creator_name",
  creatorSlug: "creator_slug",
  avatarUrl: "avatar_url",
  avatarKey: "avatar_key",
  bannerUrl: "banner_url",
  bannerKey: "banner_key",
  subscriberCount: "subscriber_count",
  contentCount: "content_count",
  totalViews: "total_views",
  profileStatus: "profile_status",
  displayName: "display_name",
  fullName: "full_name",
  accountStatus: "account_status",
  lastLoginAt: "last_login_at",
  onboardingCompleted: "onboarding_completed",
  currentPlanLabel: "current_plan_label",
  creatorClerkUserId: "creator_clerk_user_id",
  creatorProfileId: "creator_profile_id",
  subscriberClerkUserId: "subscriber_clerk_user_id",
  subscriberProfileId: "subscriber_profile_id",
  contentType: "content_type",
  requiredPlan: "required_plan",
  thumbnailUrl: "thumbnail_url",
  thumbnailKey: "thumbnail_key",
  publishedAt: "published_at",
  viewsCount: "views_count",
  downloadsCount: "downloads_count",
  watchPercentSum: "watch_percent_sum",
  watchEventsCount: "watch_events_count",
  videoUrl: "video_url",
  videoKey: "video_key",
  videoDurationLabel: "video_duration_label",
  videoProvider: "video_provider",
  externalVideoUrl: "external_video_url",
  articleBody: "article_body",
  articleSummary: "article_summary",
  fileSubtype: "file_subtype",
  fileUrl: "file_url",
  fileKey: "file_key",
  fileSizeLabel: "file_size_label",
  priceMonthly: "price_monthly",
  billingCycle: "billing_cycle",
  accessLevel: "access_level",
  isActive: "is_active",
  isDefault: "is_default",
  sortOrder: "sort_order",
  stripePriceId: "stripe_price_id",
  stripeProductId: "stripe_product_id",
  planId: "plan_id",
  startedAt: "started_at",
  currentPeriodEnd: "current_period_end",
  canceledAt: "canceled_at",
  cancelAtPeriodEnd: "cancel_at_period_end",
  stripeCustomerId: "stripe_customer_id",
  stripeSubscriptionId: "stripe_subscription_id",
  quotaPeriodStart: "quota_period_start",
  monthlyDownloadCount: "monthly_download_count",
  amountCents: "amount_cents",
  stripePaymentIntentId: "stripe_payment_intent_id",
  stripeChargeId: "stripe_charge_id",
  stripeInvoiceId: "stripe_invoice_id",
  receiptUrl: "receipt_url",
  paidAt: "paid_at",
  recipientClerkUserId: "recipient_clerk_user_id",
  isRead: "is_read",
  readAt: "read_at",
  snapshotDate: "snapshot_date",
  totalSubscribers: "total_subscribers",
  activeSubscribers: "active_subscribers",
  paidSubscribers: "paid_subscribers",
  totalRevenueCents: "total_revenue_cents",
  monthlyRecurringCents: "monthly_recurring_cents",
  totalDownloads: "total_downloads",
  newSubscribersToday: "new_subscribers_today",
  churnedSubscribersToday: "churned_subscribers_today",
  submitterClerkUserId: "submitter_clerk_user_id",
  deliveredToAdminCount: "delivered_to_admin_count",
  singletonKey: "singleton_key",
  platformDisplayName: "platform_display_name",
  supportEmail: "support_email",
  defaultSubscriberTier: "default_subscriber_tier",
  defaultCreatorStatus: "default_creator_status",
  platformCurrency: "platform_currency",
  defaultBillingCycle: "default_billing_cycle",
  renewalReminderLeadDays: "renewal_reminder_lead_days",
  failureAlertCadence: "failure_alert_cadence",
  maintenanceMode: "maintenance_mode",
  platformFeeBps: "platform_fee_bps",
  createdAt: "created_at",
  updatedAt: "updated_at",
};

function snake(field: string) {
  return CAMEL_TO_SNAKE[field] ?? field.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
}

function scalar(value: unknown): unknown {
  if (value === undefined || value === null) return value;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (value instanceof Date) return value;
  if (typeof value === "object" && value && "toString" in value) {
    return (value as { toString: () => string }).toString();
  }
  return value;
}

function idParam(value: unknown) {
  return String(scalar(value) ?? "").trim();
}

function isPgUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let i = 0; i < 4 && current; i += 1) {
    if (
      typeof current === "object" &&
      current &&
      "code" in current &&
      (current as { code?: string }).code === "23505"
    ) {
      return true;
    }
    current =
      typeof current === "object" && current && "cause" in current
        ? (current as { cause?: unknown }).cause
        : null;
  }
  const message = error instanceof Error ? error.message : "";
  return /duplicate key|unique constraint/i.test(message);
}

function wrapId(uuid: string) {
  return {
    toString() {
      return uuid;
    },
    valueOf() {
      return uuid;
    },
  };
}

/** Columns stored as-is (no camelCase map) on hydrated docs. */
const PLAIN_FIELDS = [
  "email",
  "role",
  "bio",
  "name",
  "slug",
  "title",
  "description",
  "status",
  "currency",
  "category",
  "message",
  "link",
  "metadata",
  "topic",
] as const;

const SKIP_SAVE = new Set([
  "save",
  "_id",
  "id",
  "features",
  "creatorWorkspaceAlerts",
  "workspaceDefaults",
  "notificationPreferences",
  "preferredContentTypes",
  "createdAt",
  "updatedAt",
]);

function saveScalar(camel: string, value: unknown): unknown {
  if (camel === "fileSubtype" && (value === "" || value === null)) return null;
  if (typeof value === "string" && value === "" && camel.toLowerCase().includes("stripe")) {
    return null;
  }
  if (camel === "metadata") {
    if (value == null) return "{}";
    if (typeof value === "string") return value;
    return JSON.stringify(value);
  }
  return scalar(value);
}

const NUMERIC_SNAKE = new Set([
  "price_monthly",
  "watch_percent_sum",
  "amount_cents",
  "subscriber_count",
  "content_count",
  "total_views",
  "views_count",
  "downloads_count",
  "watch_events_count",
  "sort_order",
  "monthly_download_count",
  "delivered_to_admin_count",
  "total_subscribers",
  "active_subscribers",
  "paid_subscribers",
  "total_revenue_cents",
  "monthly_recurring_cents",
  "total_downloads",
  "new_subscribers_today",
  "churned_subscribers_today",
  "renewal_reminder_lead_days",
  "platform_fee_bps",
]);

function asNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return value;
  if (typeof value === "number") return value;
  const n = Number(value);
  return Number.isFinite(n) ? n : value;
}

type ModelSpec = { table: string };

function compileWhere(filter: Filter | undefined, params: unknown[]): string {
  if (!filter || Object.keys(filter).length === 0) return "TRUE";
  const parts: string[] = [];
  for (const [key, raw] of Object.entries(filter)) {
    if (raw === undefined) continue;
    if (key === "$or" && Array.isArray(raw)) {
      if (raw.length === 0) {
        parts.push("FALSE");
        continue;
      }
      const grouped = raw.map((clause) => {
        const inner = compileWhere(clause as Filter, params);
        return `(${inner})`;
      });
      parts.push(`(${grouped.join(" OR ")})`);
      continue;
    }
    if (key === "_id" || key === "id") {
      params.push(idParam(raw));
      const i = params.length;
      parts.push(`(id::text = $${i} OR COALESCE(legacy_mongo_id,'') = $${i})`);
      continue;
    }
    if (raw && typeof raw === "object" && !Array.isArray(raw) && !(raw instanceof Date)) {
      const op = raw as Record<string, unknown>;
      const col = snake(key);
      if ("$in" in op && Array.isArray(op.$in)) {
        const arr = op.$in.map((v) => idParam(v));
        if (arr.length === 0) {
          parts.push("FALSE");
          continue;
        }
        const placeholders = arr.map((v) => {
          params.push(v);
          return `$${params.length}`;
        });
        parts.push(`${col} IN (${placeholders.join(",")})`);
        continue;
      }
      if ("$ne" in op) {
        params.push(scalar(op.$ne));
        parts.push(`${col} IS DISTINCT FROM $${params.length}`);
        continue;
      }
      if ("$gte" in op) {
        params.push(scalar(op.$gte));
        parts.push(`${col} >= $${params.length}`);
        continue;
      }
      if ("$gt" in op) {
        params.push(scalar(op.$gt));
        parts.push(`${col} > $${params.length}`);
        continue;
      }
      if ("$lte" in op) {
        params.push(scalar(op.$lte));
        parts.push(`${col} <= $${params.length}`);
        continue;
      }
    }
    params.push(scalar(raw));
    parts.push(`${snake(key)} = $${params.length}`);
  }
  return parts.length ? parts.join(" AND ") : "TRUE";
}

function compileSort(sort?: SortSpec) {
  if (!sort || Object.keys(sort).length === 0) return "";
  const bits = Object.entries(sort).map(
    ([k, dir]) => `${snake(k)} ${dir === -1 ? "DESC" : "ASC"}`
  );
  return `ORDER BY ${bits.join(", ")}`;
}

function rowToDoc(row: Record<string, unknown>) {
  const doc: Record<string, unknown> = {};
  const skipWrap = new Set([
    "clerkUserId",
    "creatorClerkUserId",
    "subscriberClerkUserId",
    "recipientClerkUserId",
    "submitterClerkUserId",
    "stripePriceId",
    "stripeProductId",
    "stripeCustomerId",
    "stripeSubscriptionId",
    "stripePaymentIntentId",
    "stripeChargeId",
    "stripeInvoiceId",
  ]);
  for (const [camel, sn] of Object.entries(CAMEL_TO_SNAKE)) {
    if (!(sn in row)) continue;
    const v = row[sn];
    if (sn.endsWith("_id") && v && !skipWrap.has(camel)) {
      doc[camel] = wrapId(String(v));
    } else {
      doc[camel] = NUMERIC_SNAKE.has(sn) ? asNumber(v) : v;
    }
  }
  for (const plain of PLAIN_FIELDS) {
    if (plain in row) doc[plain] = row[plain];
  }
  if ("features" in row) doc.features = row.features;
  const uuid = String(row.id);
  doc._id = wrapId(uuid);
  doc.id = uuid;
  return doc;
}

async function hydrateCreator(doc: Record<string, unknown>) {
  const id = String((doc._id as { toString: () => string }).toString());
  const alerts = await pgQuery(
    `SELECT * FROM creator_workspace_alerts WHERE creator_profile_id::text = $1`,
    [id]
  );
  const defaults = await pgQuery(
    `SELECT * FROM creator_workspace_defaults WHERE creator_profile_id::text = $1`,
    [id]
  );
  const a = alerts.rows[0];
  const d = defaults.rows[0];
  doc.creatorWorkspaceAlerts = a
    ? {
        newSubscriber: a.new_subscriber,
        renewalSummary: a.renewal_summary,
        failedPayment: a.failed_payment,
        engagementReport: a.engagement_report,
        weeklyRevenue: a.weekly_revenue,
      }
    : {
        newSubscriber: true,
        renewalSummary: true,
        failedPayment: false,
        engagementReport: true,
        weeklyRevenue: true,
      };
  doc.workspaceDefaults = d
    ? {
        defaultRequiredPlan: d.default_required_plan,
        defaultStatus: d.default_status,
      }
    : { defaultRequiredPlan: "basic", defaultStatus: "draft" };
}

async function hydrateSubscriber(doc: Record<string, unknown>) {
  const id = String((doc._id as { toString: () => string }).toString());
  const prefs = await pgQuery(
    `SELECT * FROM subscriber_notification_preferences WHERE subscriber_profile_id::text = $1`,
    [id]
  );
  const types = await pgQuery(
    `SELECT content_type FROM subscriber_preferred_content_types WHERE subscriber_profile_id::text = $1`,
    [id]
  );
  const p = prefs.rows[0];
  doc.notificationPreferences = p
    ? {
        productUpdates: p.product_updates,
        contentDigests: p.content_digests,
        downloadAlerts: p.download_alerts,
        renewalReminders: p.renewal_reminders,
        paymentAlerts: p.payment_alerts,
        accountNotices: p.account_notices,
        creatorAnnouncements: p.creator_announcements,
      }
    : {};
  doc.preferredContentTypes = types.rows.map((r) => r.content_type);
}

async function hydratePlan(doc: Record<string, unknown>) {
  const id = String((doc._id as { toString: () => string }).toString());
  const feats = await pgQuery(
    `SELECT feature_text FROM plan_features WHERE plan_id::text = $1 ORDER BY sort_order`,
    [id]
  );
  doc.features = feats.rows.map((r) => r.feature_text);
}

class PgQuery {
  private _sort: SortSpec | undefined;
  private _limit: number | undefined;
  private _skip: number | undefined;

  constructor(
    private spec: ModelSpec,
    private filter: Filter,
    private hydrate?: (doc: Record<string, unknown>) => Promise<void>
  ) {}

  sort(spec: SortSpec) {
    this._sort = spec;
    return this;
  }

  limit(n: number) {
    this._limit = n;
    return this;
  }

  skip(n: number) {
    this._skip = n;
    return this;
  }

  select() {
    return this;
  }

  lean() {
    return this;
  }

  then<TResult1 = unknown[], TResult2 = never>(
    resolve?: ((value: unknown[]) => TResult1 | PromiseLike<TResult1>) | null,
    reject?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ) {
    return this.exec().then(resolve ?? ((v) => v as TResult1), reject ?? undefined);
  }

  async exec() {
    const params: unknown[] = [];
    const where = compileWhere(this.filter, params);
    const order = compileSort(this._sort);
    const limitSql = this._limit ? `LIMIT ${Number(this._limit)}` : "";
    const offsetSql =
      this._skip && this._skip > 0 ? `OFFSET ${Number(this._skip)}` : "";
    const sql = `SELECT * FROM ${this.spec.table} WHERE ${where} ${order} ${limitSql} ${offsetSql}`;
    const res = await pgQuery(sql, params);
    const docs = res.rows.map((r) => rowToDoc(r));
    if (this.hydrate) {
      for (const d of docs) await this.hydrate(d);
    }
    return docs;
  }
}

function attachSave(doc: Record<string, unknown>, spec: ModelSpec) {
  doc.save = async () => {
    const sets: string[] = [];
    const params: unknown[] = [];
    const used = new Set<string>();
    const allowed = new Set<string>([...Object.keys(CAMEL_TO_SNAKE), ...PLAIN_FIELDS]);

    for (const camel of Object.keys(doc)) {
      if (!allowed.has(camel) || SKIP_SAVE.has(camel)) continue;
      const sn = snake(camel);
      if (sn === "created_at" || sn === "updated_at" || used.has(sn)) continue;
      used.add(sn);
      params.push(saveScalar(camel, doc[camel]));
      sets.push(`${sn} = $${params.length}`);
    }

    sets.push("updated_at = NOW()");
    const id = String((doc._id as { toString: () => string }).toString());
    params.push(id);
    await pgQuery(
      `UPDATE ${spec.table} SET ${sets.join(", ")} WHERE id::text = $${params.length} OR COALESCE(legacy_mongo_id,'') = $${params.length}`,
      params
    );

    if (spec.table === "plans" && Array.isArray(doc.features)) {
      await pgQuery(`DELETE FROM plan_features WHERE plan_id::text = $1`, [id]);
      let i = 0;
      for (const feature of doc.features) {
        const text = String(feature).trim();
        if (!text) continue;
        await pgQuery(
          `INSERT INTO plan_features (plan_id, feature_text, sort_order) VALUES ($1,$2,$3)`,
          [id, text, i++]
        );
      }
    }

    return doc;
  };
  return doc;
}

const SKIP_CREATE = new Set([
  "creatorWorkspaceAlerts",
  "workspaceDefaults",
  "notificationPreferences",
  "preferredContentTypes",
  "features",
]);

async function persistSubscriberNotificationPreferences(
  profileId: string,
  prefs: Record<string, boolean>
) {
  await pgQuery(
    `INSERT INTO subscriber_notification_preferences (
      subscriber_profile_id, product_updates, content_digests, download_alerts,
      renewal_reminders, payment_alerts, account_notices, creator_announcements
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    ON CONFLICT (subscriber_profile_id) DO UPDATE SET
      product_updates = EXCLUDED.product_updates,
      content_digests = EXCLUDED.content_digests,
      download_alerts = EXCLUDED.download_alerts,
      renewal_reminders = EXCLUDED.renewal_reminders,
      payment_alerts = EXCLUDED.payment_alerts,
      account_notices = EXCLUDED.account_notices,
      creator_announcements = EXCLUDED.creator_announcements`,
    [
      profileId,
      prefs.productUpdates ?? true,
      prefs.contentDigests ?? true,
      prefs.downloadAlerts ?? true,
      prefs.renewalReminders ?? true,
      prefs.paymentAlerts ?? true,
      prefs.accountNotices ?? true,
      prefs.creatorAnnouncements ?? false,
    ]
  );
}

async function persistCreatorWorkspaceAlerts(
  profileId: string,
  alerts: Record<string, boolean>
) {
  await pgQuery(
    `INSERT INTO creator_workspace_alerts (
      creator_profile_id, new_subscriber, renewal_summary, failed_payment, engagement_report, weekly_revenue
    ) VALUES ($1,$2,$3,$4,$5,$6)
    ON CONFLICT (creator_profile_id) DO UPDATE SET
      new_subscriber = EXCLUDED.new_subscriber,
      renewal_summary = EXCLUDED.renewal_summary,
      failed_payment = EXCLUDED.failed_payment,
      engagement_report = EXCLUDED.engagement_report,
      weekly_revenue = EXCLUDED.weekly_revenue`,
    [
      profileId,
      alerts.newSubscriber ?? true,
      alerts.renewalSummary ?? true,
      alerts.failedPayment ?? false,
      alerts.engagementReport ?? true,
      alerts.weeklyRevenue ?? true,
    ]
  );
}

export function createPgModel(
  spec: ModelSpec,
  hydrate?: (doc: Record<string, unknown>) => Promise<void>
) {
  function findOne(filter: Filter) {
    const query = new PgQuery(spec, filter, hydrate).limit(1);
    const execDoc = async () => {
      const rows = await query.exec();
      const doc = rows[0];
      if (!doc) return null;
      return attachSave(doc, spec);
    };
    const thenable = {
      lean() {
        return thenable;
      },
      select() {
        return thenable;
      },
      sort(spec: SortSpec) {
        query.sort(spec);
        return thenable;
      },
      then(
        onFulfilled?: ((value: Record<string, unknown> | null) => unknown) | null,
        onRejected?: ((reason: unknown) => unknown) | null
      ) {
        return execDoc().then(onFulfilled ?? undefined, onRejected ?? undefined);
      },
      catch(onRejected?: ((reason: unknown) => unknown) | null) {
        return execDoc().catch(onRejected ?? undefined);
      },
    };
    return thenable;
  }

  const api = {
    find(filter: Filter = {}) {
      return new PgQuery(spec, filter, hydrate);
    },
    findOne,
    async findById(id: unknown) {
      return findOne({ _id: idParam(id) });
    },
    async exists(filter: Filter) {
      const params: unknown[] = [];
      const where = compileWhere(filter, params);
      const res = await pgQuery(`SELECT 1 FROM ${spec.table} WHERE ${where} LIMIT 1`, params);
      return res.rowCount ? { _id: true } : null;
    },
    async countDocuments(filter: Filter = {}) {
      const params: unknown[] = [];
      const where = compileWhere(filter, params);
      const res = await pgQuery<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM ${spec.table} WHERE ${where}`,
        params
      );
      return Number(res.rows[0]?.count ?? 0);
    },
    async insertMany(docs: Record<string, unknown>[] = []) {
      const created: unknown[] = [];
      for (const doc of docs) {
        created.push(await api.create(doc));
      }
      return created;
    },
    async create(data: Record<string, unknown>) {
      const cols: string[] = [];
      const placeholders: string[] = [];
      const params: unknown[] = [];
      for (const [camel, value] of Object.entries(data)) {
        if (value === undefined || SKIP_CREATE.has(camel)) continue;
        cols.push(snake(camel));
        const v = scalar(value);
        params.push(
          camel === "fileSubtype" && (v === "" || v === null)
            ? null
            : typeof v === "string" && v === "" && camel.toLowerCase().includes("stripe")
              ? null
              : v
        );
        placeholders.push(`$${params.length}`);
      }
      if (!cols.includes("created_at")) {
        cols.push("created_at");
        params.push(new Date());
        placeholders.push(`$${params.length}`);
      }
      if (!cols.includes("updated_at")) {
        cols.push("updated_at");
        params.push(new Date());
        placeholders.push(`$${params.length}`);
      }
      const res = await pgQuery(
        `INSERT INTO ${spec.table} (${cols.join(",")}) VALUES (${placeholders.join(",")}) RETURNING *`,
        params
      );
      const doc = attachSave(rowToDoc(res.rows[0]), spec);
      const id = String(res.rows[0].id);
      if (spec.table === "creator_profiles") {
        const alerts = (data.creatorWorkspaceAlerts as Record<string, boolean>) || {};
        await pgQuery(
          `INSERT INTO creator_workspace_alerts (creator_profile_id, new_subscriber, renewal_summary, failed_payment, engagement_report, weekly_revenue)
           VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (creator_profile_id) DO NOTHING`,
          [
            id,
            alerts.newSubscriber ?? true,
            alerts.renewalSummary ?? true,
            alerts.failedPayment ?? false,
            alerts.engagementReport ?? true,
            alerts.weeklyRevenue ?? true,
          ]
        );
        const defs = (data.workspaceDefaults as Record<string, string>) || {};
        await pgQuery(
          `INSERT INTO creator_workspace_defaults (creator_profile_id, default_required_plan, default_status)
           VALUES ($1,$2,$3) ON CONFLICT (creator_profile_id) DO NOTHING`,
          [id, defs.defaultRequiredPlan ?? "basic", defs.defaultStatus ?? "draft"]
        );
        await hydrateCreator(doc);
      }
      if (spec.table === "subscriber_profiles") {
        const prefs = (data.notificationPreferences as Record<string, boolean>) || {};
        await pgQuery(
          `INSERT INTO subscriber_notification_preferences (
            subscriber_profile_id, product_updates, content_digests, download_alerts,
            renewal_reminders, payment_alerts, account_notices, creator_announcements
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (subscriber_profile_id) DO NOTHING`,
          [
            id,
            prefs.productUpdates ?? true,
            prefs.contentDigests ?? true,
            prefs.downloadAlerts ?? true,
            prefs.renewalReminders ?? true,
            prefs.paymentAlerts ?? true,
            prefs.accountNotices ?? true,
            prefs.creatorAnnouncements ?? false,
          ]
        );
        const types = Array.isArray(data.preferredContentTypes) ? data.preferredContentTypes : [];
        for (const t of types) {
          await pgQuery(
            `INSERT INTO subscriber_preferred_content_types (subscriber_profile_id, content_type)
             VALUES ($1,$2) ON CONFLICT DO NOTHING`,
            [id, String(t)]
          );
        }
        await hydrateSubscriber(doc);
      }
      if (spec.table === "plans" && Array.isArray(data.features)) {
        let i = 0;
        for (const f of data.features) {
          await pgQuery(
            `INSERT INTO plan_features (plan_id, feature_text, sort_order) VALUES ($1,$2,$3)`,
            [id, String(f), i++]
          );
        }
        await hydratePlan(doc);
      }
      return doc;
    },
    async updateOne(filter: Filter, update: Record<string, unknown>) {
      const set = (update.$set as Record<string, unknown>) || (!update.$inc && !update.$setOnInsert ? update : {});
      const inc = (update.$inc as Record<string, number>) || {};
      const params: unknown[] = [];
      const sets: string[] = [];
      const used = new Set<string>();
      for (const [k, v] of Object.entries(set)) {
        if (v === undefined || k.startsWith("$") || SKIP_SAVE.has(k)) continue;
        const sn = snake(k);
        if (sn === "updated_at" || sn === "created_at" || used.has(sn)) continue;
        used.add(sn);
        params.push(saveScalar(k, v));
        sets.push(`${sn} = $${params.length}`);
      }
      for (const [k, v] of Object.entries(inc)) {
        const sn = snake(k);
        if (used.has(sn)) continue;
        used.add(sn);
        sets.push(`${sn} = COALESCE(${sn},0) + (${Number(v)})`);
      }
      if (!sets.length && !Object.keys(inc).length && !Object.keys(set).length) {
        return { acknowledged: true, modifiedCount: 0 };
      }
      sets.push("updated_at = NOW()");
      const where = compileWhere(filter, params);
      const res = await pgQuery(
        `UPDATE ${spec.table} SET ${sets.join(", ")} WHERE ${where}`,
        params
      );
      return { acknowledged: true, modifiedCount: res.rowCount ?? 0 };
    },
    async findByIdAndUpdate(id: unknown, update: Record<string, unknown>) {
      await api.updateOne({ _id: idParam(id) }, update);
      return findOne({ _id: idParam(id) });
    },
    async findOneAndUpdate(
      filter: Filter,
      update: Record<string, unknown>,
      options?: { upsert?: boolean; returnDocument?: string }
    ) {
      const existing = await findOne(filter);
      if (!existing && options?.upsert) {
        const set = (update.$set as Record<string, unknown>) || {};
        const setOnInsert = (update.$setOnInsert as Record<string, unknown>) || {};
        const createPayload = {
          ...setOnInsert,
          ...set,
          ...Object.fromEntries(Object.entries(filter).filter(([k]) => !k.startsWith("$"))),
        };
        delete (createPayload as { status?: unknown }).status;
        try {
          return await api.create(createPayload);
        } catch (error) {
          if (!isPgUniqueViolation(error)) throw error;
          const raced = await findOne(filter);
          if (!raced) throw error;
          await api.updateOne(filter, update);
          return findOne(filter);
        }
      }
      if (!existing) return null;
      await api.updateOne(filter, update);
      const nestedSet = (update.$set as Record<string, unknown>) || {};
      if (spec.table === "subscriber_profiles" && nestedSet.notificationPreferences) {
        try {
          await persistSubscriberNotificationPreferences(
            String(existing._id),
            nestedSet.notificationPreferences as Record<string, boolean>
          );
        } catch (error) {
          console.error("[pg] persist subscriber notification preferences", error);
          throw error;
        }
      }
      if (spec.table === "creator_profiles" && nestedSet.creatorWorkspaceAlerts) {
        await persistCreatorWorkspaceAlerts(
          String(existing._id),
          nestedSet.creatorWorkspaceAlerts as Record<string, boolean>
        );
      }
      return findOne(filter);
    },
    async findOneAndDelete(filter: Filter) {
      const existing = await findOne(filter);
      if (!existing) return null;
      await api.deleteOne(filter);
      return existing;
    },
    async deleteOne(filter: Filter) {
      const params: unknown[] = [];
      const where = compileWhere(filter, params);
      const res = await pgQuery(`DELETE FROM ${spec.table} WHERE ${where}`, params);
      return { deletedCount: res.rowCount ?? 0 };
    },
    async deleteMany(filter: Filter) {
      const mapped =
        spec.table === "contacts" && "clerkUserId" in filter
          ? { submitterClerkUserId: filter.clerkUserId }
          : filter;
      const params: unknown[] = [];
      const where = compileWhere(mapped as Filter, params);
      const res = await pgQuery(`DELETE FROM ${spec.table} WHERE ${where}`, params);
      return { deletedCount: res.rowCount ?? 0 };
    },
    async aggregate(pipeline: unknown[]) {
      const match = (pipeline as { $match?: Filter }[])[0]?.$match;
      const group = (pipeline as { $group?: { total?: { $sum?: string } } }[])[1]?.$group;
      if (spec.table === "payments" && match && group?.total?.$sum === "$amountCents") {
        const params: unknown[] = [];
        const where = compileWhere(match, params);
        const res = await pgQuery<{ total: string }>(
          `SELECT COALESCE(SUM(amount_cents),0)::text AS total FROM ${spec.table} WHERE ${where}`,
          params
        );
        return [{ _id: null, total: Number(res.rows[0]?.total ?? 0) }];
      }
      return [];
    },
  };

  return api;
}

export const UserProfilePg = createPgModel({ table: "user_profiles" });
export const CreatorProfilePg = createPgModel({ table: "creator_profiles" }, hydrateCreator);
export const SubscriberProfilePg = createPgModel({ table: "subscriber_profiles" }, hydrateSubscriber);
export const ContentPg = createPgModel({ table: "content" });
export const PlanPg = createPgModel({ table: "plans" }, hydratePlan);
export const SubscriptionPg = createPgModel({ table: "subscriptions" });
export const PaymentPg = createPgModel({ table: "payments" });
export const NotificationPg = createPgModel({ table: "notifications" });
export const AnalyticsPg = createPgModel({ table: "analytics" });
export const ContactPg = createPgModel({ table: "contacts" });
export const PlatformSettingsPg = createPgModel({ table: "platform_settings" });

void isRecordId;
