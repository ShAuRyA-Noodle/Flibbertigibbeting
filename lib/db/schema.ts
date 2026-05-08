/**
 * Drizzle schema. Authored against sqlite-core but designed to round-trip
 * cleanly to postgres-core (text/integer/real map 1:1 once dialect-swapped).
 *
 * IDs are application-generated text via lib/db/id.ts (prefixed nanoid).
 * Timestamps are stored as milliseconds-since-epoch integers — portable and
 * cheaper than ISO strings. JSON columns are stored as text and parsed in app code.
 */

import { sql } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const now = sql`(unixepoch() * 1000)`;

export const orgs = sqliteTable("orgs", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  plan: text("plan").notNull().default("free"),
  createdAt: integer("created_at").notNull().default(now),
});

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  image: text("image"),
  emailVerified: integer("email_verified"),
  createdAt: integer("created_at").notNull().default(now),
});

export const memberships = sqliteTable(
  "memberships",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["owner", "admin", "inspector", "viewer"] }).notNull(),
    createdAt: integer("created_at").notNull().default(now),
  },
  (t) => [
    uniqueIndex("memberships_user_org_uq").on(t.userId, t.orgId),
    index("memberships_org_idx").on(t.orgId),
  ],
);

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: integer("expires_at").notNull(),
    createdAt: integer("created_at").notNull().default(now),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const sites = sqliteTable(
  "sites",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    lat: real("lat"),
    lon: real("lon"),
    capacityKw: real("capacity_kw"),
    country: text("country"),
    createdAt: integer("created_at").notNull().default(now),
  },
  (t) => [index("sites_org_idx").on(t.orgId)],
);

export const strings = sqliteTable(
  "strings",
  {
    id: text("id").primaryKey(),
    siteId: text("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    panelCount: integer("panel_count").notNull().default(0),
    createdAt: integer("created_at").notNull().default(now),
  },
  (t) => [index("strings_site_idx").on(t.siteId)],
);

export const modules = sqliteTable(
  "modules",
  {
    id: text("id").primaryKey(),
    siteId: text("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    stringId: text("string_id").references(() => strings.id, {
      onDelete: "set null",
    }),
    serialNumber: text("serial_number"),
    manufacturer: text("manufacturer"),
    model: text("model"),
    wattageW: integer("wattage_w"),
    installDate: integer("install_date"),
    lat: real("lat"),
    lon: real("lon"),
    mountType: text("mount_type"),
    createdAt: integer("created_at").notNull().default(now),
  },
  (t) => [
    index("modules_site_idx").on(t.siteId),
    index("modules_string_idx").on(t.stringId),
    index("modules_serial_idx").on(t.serialNumber),
  ],
);

export const inspections = sqliteTable(
  "inspections",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    siteId: text("site_id").references(() => sites.id, { onDelete: "set null" }),
    kind: text("kind", { enum: ["manual", "drone", "webcam", "video"] }).notNull(),
    sourceFilename: text("source_filename"),
    status: text("status", {
      enum: ["queued", "running", "completed", "failed"],
    })
      .notNull()
      .default("queued"),
    panelCount: integer("panel_count").notNull().default(0),
    createdAt: integer("created_at").notNull().default(now),
    finishedAt: integer("finished_at"),
    createdByUserId: text("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
  },
  (t) => [
    index("inspections_org_idx").on(t.orgId),
    index("inspections_site_idx").on(t.siteId),
    index("inspections_status_idx").on(t.status),
  ],
);

export const inspectionImages = sqliteTable(
  "inspection_images",
  {
    id: text("id").primaryKey(),
    inspectionId: text("inspection_id")
      .notNull()
      .references(() => inspections.id, { onDelete: "cascade" }),
    sha256: text("sha256").notNull(),
    imageUrl: text("image_url").notNull(),
    exifJson: text("exif_json"),
    lat: real("lat"),
    lon: real("lon"),
    takenAt: integer("taken_at"),
  },
  (t) => [
    index("inspection_images_inspection_idx").on(t.inspectionId),
    index("inspection_images_sha_idx").on(t.sha256),
  ],
);

export const modelVersions = sqliteTable(
  "model_versions",
  {
    id: text("id").primaryKey(),
    role: text("role", {
      enum: ["vision", "synthesis", "explain", "detect"],
    }).notNull(),
    provider: text("provider").notNull(),
    modelName: text("model_name").notNull(),
    promptHash: text("prompt_hash").notNull(),
    createdAt: integer("created_at").notNull().default(now),
  },
  (t) => [
    uniqueIndex("model_versions_role_name_hash_uq").on(
      t.role,
      t.modelName,
      t.promptHash,
    ),
  ],
);

export const panelResults = sqliteTable(
  "panel_results",
  {
    id: text("id").primaryKey(),
    inspectionId: text("inspection_id")
      .notNull()
      .references(() => inspections.id, { onDelete: "cascade" }),
    imageId: text("image_id").references(() => inspectionImages.id, {
      onDelete: "set null",
    }),
    moduleId: text("module_id").references(() => modules.id, {
      onDelete: "set null",
    }),
    panelIdString: text("panel_id_string").notNull(),
    panelType: text("panel_type").notNull(),
    conditionScore: integer("condition_score").notNull(),
    cleanlinessScore: integer("cleanliness_score").notNull(),
    effLossPct: real("eff_loss_pct").notNull(),
    observations: text("observations").notNull(),
    imageQuality: text("image_quality").notNull(),
    confidence: real("confidence").notNull(),
    modelVersionId: text("model_version_id").references(() => modelVersions.id, {
      onDelete: "set null",
    }),
    sourceBboxJson: text("source_bbox_json"),
    createdAt: integer("created_at").notNull().default(now),
  },
  (t) => [
    index("panel_results_inspection_idx").on(t.inspectionId),
    index("panel_results_module_idx").on(t.moduleId),
  ],
);

export const defects = sqliteTable(
  "defects",
  {
    id: text("id").primaryKey(),
    panelResultId: text("panel_result_id")
      .notNull()
      .references(() => panelResults.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    severity: text("severity", {
      enum: ["low", "medium", "high", "critical"],
    }).notNull(),
    location: text("location").notNull(),
    confidence: real("confidence").notNull(),
    effLossPct: real("eff_loss_pct").notNull(),
    notes: text("notes"),
    bboxJson: text("bbox_json"),
    acceptedByUserId: text("accepted_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
  },
  (t) => [index("defects_panel_result_idx").on(t.panelResultId)],
);

export const reports = sqliteTable(
  "reports",
  {
    id: text("id").primaryKey(),
    inspectionId: text("inspection_id")
      .notNull()
      .references(() => inspections.id, { onDelete: "cascade" }),
    executiveSummary: text("executive_summary").notNull(),
    severityCountsJson: text("severity_counts_json").notNull(),
    topRisksJson: text("top_risks_json").notNull(),
    recommendationsJson: text("recommendations_json").notNull(),
    fleetHealthScore: integer("fleet_health_score").notNull(),
    fleetEffLossPct: real("fleet_eff_loss_pct").notNull(),
    modelVersionId: text("model_version_id").references(() => modelVersions.id, {
      onDelete: "set null",
    }),
    locale: text("locale").notNull().default("en"),
    persona: text("persona").notNull().default("default"),
    createdAt: integer("created_at").notNull().default(now),
  },
  (t) => [index("reports_inspection_idx").on(t.inspectionId)],
);

export const auditLog = sqliteTable(
  "audit_log",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").references(() => orgs.id, { onDelete: "set null" }),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    payloadHash: text("payload_hash").notNull(),
    modelVersion: text("model_version"),
    createdAt: integer("created_at").notNull().default(now),
  },
  (t) => [
    index("audit_log_org_idx").on(t.orgId),
    index("audit_log_target_idx").on(t.targetType, t.targetId),
  ],
);

export const apiKeys = sqliteTable(
  "api_keys",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").references(() => orgs.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["gemini", "groq", "solpop"] }).notNull(),
    encryptedSecret: text("encrypted_secret").notNull(),
    label: text("label").notNull(),
    lastUsedAt: integer("last_used_at"),
    revokedAt: integer("revoked_at"),
    createdAt: integer("created_at").notNull().default(now),
  },
  (t) => [index("api_keys_org_idx").on(t.orgId)],
);

export const usageEvents = sqliteTable(
  "usage_events",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").references(() => orgs.id, { onDelete: "set null" }),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    kind: text("kind", {
      enum: ["vision", "synthesis", "explain", "pdf", "share"],
    }).notNull(),
    units: integer("units").notNull().default(1),
    modelVersionId: text("model_version_id").references(() => modelVersions.id, {
      onDelete: "set null",
    }),
    requestId: text("request_id"),
    createdAt: integer("created_at").notNull().default(now),
  },
  (t) => [
    index("usage_events_org_idx").on(t.orgId),
    index("usage_events_user_idx").on(t.userId),
    index("usage_events_created_idx").on(t.createdAt),
  ],
);

export const shares = sqliteTable(
  "shares",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").references(() => orgs.id, { onDelete: "set null" }),
    inspectionId: text("inspection_id").references(() => inspections.id, {
      onDelete: "set null",
    }),
    payloadJson: text("payload_json").notNull(),
    expiresAt: integer("expires_at").notNull(),
    createdByUserId: text("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: integer("created_at").notNull().default(now),
  },
  (t) => [
    index("shares_org_idx").on(t.orgId),
    index("shares_expires_idx").on(t.expiresAt),
  ],
);

export const jobs = sqliteTable(
  "jobs",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").references(() => orgs.id, { onDelete: "set null" }),
    kind: text("kind").notNull(),
    payloadJson: text("payload_json").notNull(),
    status: text("status", {
      enum: ["queued", "running", "completed", "failed"],
    })
      .notNull()
      .default("queued"),
    priority: integer("priority").notNull().default(0),
    attempts: integer("attempts").notNull().default(0),
    scheduledFor: integer("scheduled_for").notNull(),
    startedAt: integer("started_at"),
    finishedAt: integer("finished_at"),
    error: text("error"),
    createdAt: integer("created_at").notNull().default(now),
  },
  (t) => [
    index("jobs_status_sched_idx").on(t.status, t.scheduledFor),
    index("jobs_org_idx").on(t.orgId),
  ],
);

export const webhookSubs = sqliteTable(
  "webhook_subs",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    secret: text("secret").notNull(),
    eventTypes: text("event_types").notNull(),
    active: integer("active").notNull().default(1),
    createdAt: integer("created_at").notNull().default(now),
  },
  (t) => [index("webhook_subs_org_idx").on(t.orgId)],
);

export const webhookDeliveries = sqliteTable(
  "webhook_deliveries",
  {
    id: text("id").primaryKey(),
    subId: text("sub_id")
      .notNull()
      .references(() => webhookSubs.id, { onDelete: "cascade" }),
    event: text("event").notNull(),
    payloadHash: text("payload_hash").notNull(),
    status: text("status").notNull(),
    responseCode: integer("response_code"),
    attemptedAt: integer("attempted_at").notNull().default(now),
  },
  (t) => [index("webhook_deliveries_sub_idx").on(t.subId)],
);

export type Org = typeof orgs.$inferSelect;
export type NewOrg = typeof orgs.$inferInsert;
export type User = typeof users.$inferSelect;
export type Share = typeof shares.$inferSelect;
export type NewShare = typeof shares.$inferInsert;
