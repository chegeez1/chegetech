import { sql } from "drizzle-orm";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = sqliteTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const transactions = sqliteTable("transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  reference: text("reference").unique().notNull(),
  planId: text("plan_id").notNull(),
  planName: text("plan_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  customerName: text("customer_name"),
  amount: integer("amount").notNull(),
  status: text("status").default("pending"),
  emailSent: integer("email_sent", { mode: "boolean" }).default(false),
  accountAssigned: integer("account_assigned", { mode: "boolean" }).default(false),
  paystackReference: text("paystack_reference"),
  expiresAt: text("expires_at"),
  resellerId: integer("reseller_id"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
});

export const customers = sqliteTable("customers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").unique().notNull(),
  name: text("name"),
  passwordHash: text("password_hash"),
  emailVerified: integer("email_verified", { mode: "boolean" }).default(false),
  verificationCode: text("verification_code"),
  verificationExpires: text("verification_expires"),
  suspended: integer("suspended", { mode: "boolean" }).default(false),
  totpSecret: text("totp_secret"),
  totpEnabled: integer("totp_enabled", { mode: "boolean" }).default(false),
  passwordResetCode: text("password_reset_code"),
  passwordResetExpires: text("password_reset_expires"),
  avatarUrl: text("avatar_url"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

export const customerSessions = sqliteTable("customer_sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  customerId: integer("customer_id").notNull(),
  token: text("token").unique().notNull(),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  expiresAt: text("expires_at").notNull(),
  ip: text("ip"),
  userAgent: text("user_agent"),
  deviceName: text("device_name"),
});

export const apiKeys = sqliteTable("api_keys", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  customerId: integer("customer_id"),
  key: text("key").unique().notNull(),
  label: text("label").notNull(),
  active: integer("active", { mode: "boolean" }).default(true),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

export const wallets = sqliteTable("wallets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  customerId: integer("customer_id").notNull().unique(),
  balance: integer("balance").notNull().default(0),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
});

export const walletTransactions = sqliteTable("wallet_transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  customerId: integer("customer_id").notNull(),
  type: text("type").notNull(),
  amount: integer("amount").notNull(),
  description: text("description").notNull(),
  reference: text("reference"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

export const referrals = sqliteTable("referrals", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  referrerId: integer("referrer_id").notNull(),
  referralCode: text("referral_code").unique().notNull(),
  refereeEmail: text("referee_email"),
  status: text("status").default("pending"),
  rewardAmount: integer("reward_amount").default(0),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

export const insertTransactionSchema = createInsertSchema(transactions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Customer = typeof customers.$inferSelect;
export type CustomerSession = typeof customerSessions.$inferSelect;
export type ApiKey = typeof apiKeys.$inferSelect;
export type Wallet = typeof wallets.$inferSelect;
export type WalletTransaction = typeof walletTransactions.$inferSelect;
export type Referral = typeof referrals.$inferSelect;

export interface SubscriptionPlan {
  name: string;
  price: number;
  duration: string;
  features: string[];
  shared: boolean;
  maxUsers: number;
  popular?: boolean;
  category?: string;
  categoryIcon?: string;
  categoryColor?: string;
}

export interface PlanCategory {
  category: string;
  icon: string;
  color: string;
  plans: Record<string, SubscriptionPlan>;
}

export interface AccountEntry {
  id: string;
  email?: string;
  username?: string;
  password?: string;
  activationCode?: string;
  redeemLink?: string;
  instructions?: string;
  currentUsers: number;
  maxUsers: number;
  fullyUsed: boolean;
  disabled?: boolean;
  usedBy: Array<{
    customerEmail: string;
    customerName: string;
    assignedAt: string;
  }>;
  addedAt: string;
}

export interface AccountsData {
  [planId: string]: AccountEntry[];
}

// ─── WhatsApp Bot Deployment ─────────────────────────────────────────────────

export const bots = sqliteTable("bots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description").notNull(),
  repoUrl: text("repo_url").notNull(),
  imageUrl: text("image_url"),
  price: integer("price").notNull().default(70),
  features: text("features").notNull().default("[]"),
  requiresSessionId: integer("requires_session_id", { mode: "boolean" }).default(true),
  requiresDbUrl: integer("requires_db_url", { mode: "boolean" }).default(false),
  active: integer("active", { mode: "boolean" }).default(true),
  category: text("category").default("general"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

export const botOrders = sqliteTable("bot_orders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  reference: text("reference").unique().notNull(),
  botId: integer("bot_id").notNull(),
  botName: text("bot_name").notNull(),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  customerPhone: text("customer_phone").notNull(),
  sessionId: text("session_id"),
  dbUrl: text("db_url"),
  mode: text("mode").default("public"),
  timezone: text("timezone").default("Africa/Nairobi"),
  amount: integer("amount").notNull(),
  status: text("status").default("pending"),
  paystackReference: text("paystack_reference"),
  deploymentNotes: text("deployment_notes"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
});

export type Bot = typeof bots.$inferSelect;
export type InsertBot = typeof bots.$inferInsert;
export type BotOrder = typeof botOrders.$inferSelect;
export type InsertBotOrder = typeof botOrders.$inferInsert;

export const planPreviews = sqliteTable("plan_previews", {
  planId: text("plan_id").primaryKey(),
  mediaType: text("media_type").notNull(), // 'image' | 'video'
  mimeType: text("mime_type").notNull(),
  mediaData: text("media_data").notNull(), // base64
  fileName: text("file_name"),
  sizeBytes: integer("size_bytes").default(0),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
});

export type PlanPreview = typeof planPreviews.$inferSelect;



export const flashSales = sqliteTable("flash_sales", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  label: text("label").notNull(),
  planId: text("plan_id"),
  discountPercent: integer("discount_percent").notNull().default(10),
  startsAt: text("starts_at").notNull(),
  endsAt: text("ends_at").notNull(),
  active: integer("active", { mode: "boolean" }).default(true),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});
export type FlashSale = typeof flashSales.$inferSelect;

// ── Trading Bot Subscriptions ─────────────────────────────────────────────────
export const tradingBotSubscriptions = sqliteTable("trading_bot_subscriptions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  customerId: integer("customer_id"),
  customerEmail: text("customer_email").notNull(),
  customerName: text("customer_name"),
  plan: text("plan").notNull(),
  amount: integer("amount").notNull(),
  paystackReference: text("paystack_reference").unique(),
  status: text("status").default("pending"),
  expiresAt: text("expires_at"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
});

export type TradingBotSubscription = typeof tradingBotSubscriptions.$inferSelect;
export type InsertTradingBotSubscription = typeof tradingBotSubscriptions.$inferInsert;
