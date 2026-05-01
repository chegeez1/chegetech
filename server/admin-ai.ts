import OpenAI from "openai";
import { storage } from "./storage";
import { accountManager } from "./accounts";
import { subscriptionPlans } from "./plans";
import { planOverridesManager } from "./plan-overrides";
import { promoManager } from "./promo";
import { getAppConfig } from "./app-config";
import { sendBulkEmail } from "./email";

function getOpenAIClient(): OpenAI | null {
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  if (baseURL && apiKey) return new OpenAI({ apiKey, baseURL });
  return null;
}

function getAllPlansFlat() {
  const plans: { id: string; name: string; price: number; duration: string; category: string }[] = [];
  for (const [, cat] of Object.entries(subscriptionPlans)) {
    const c = cat as any;
    for (const [, plan] of Object.entries(c.plans || {})) {
      const p = plan as any;
      plans.push({ id: p.planId, name: p.name, price: p.price, duration: p.duration, category: c.category });
    }
  }
  const custom = planOverridesManager.getCustomPlans();
  for (const cp of custom) {
    plans.push({ id: cp.id, name: cp.name, price: cp.price, duration: cp.duration, category: "Custom" });
  }
  return plans;
}

// ─── Tool definitions ──────────────────────────────────────────────────────

const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "get_stats",
      description: "Get business statistics: revenue totals (today, this week, this month, all time), order counts, number of customers, pending orders.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "list_customers",
      description: "List registered customers. Returns name, email, status (active/suspended), wallet balance, order count, registration date.",
      parameters: {
        type: "object",
        properties: {
          search: { type: "string", description: "Optional search string (matches name or email)" },
          limit: { type: "number", description: "Max results to return (default 10)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_customer",
      description: "Get full details for one customer by email: profile, wallet balance, recent orders, suspension status.",
      parameters: {
        type: "object",
        properties: {
          email: { type: "string", description: "Customer email address" },
        },
        required: ["email"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "suspend_customer",
      description: "Suspend a customer account so they cannot log in.",
      parameters: {
        type: "object",
        properties: {
          email: { type: "string", description: "Customer email address" },
          reason: { type: "string", description: "Optional reason for suspension" },
        },
        required: ["email"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "unsuspend_customer",
      description: "Re-activate a previously suspended customer account.",
      parameters: {
        type: "object",
        properties: {
          email: { type: "string", description: "Customer email address" },
        },
        required: ["email"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "credit_wallet",
      description: "Add credit (money) to a customer's wallet balance.",
      parameters: {
        type: "object",
        properties: {
          email: { type: "string", description: "Customer email address" },
          amount: { type: "number", description: "Amount in KES to add" },
          description: { type: "string", description: "Reason or note for the credit (e.g. 'Refund', 'Bonus')" },
        },
        required: ["email", "amount"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "debit_wallet",
      description: "Deduct an amount from a customer's wallet balance.",
      parameters: {
        type: "object",
        properties: {
          email: { type: "string", description: "Customer email address" },
          amount: { type: "number", description: "Amount in KES to deduct" },
          description: { type: "string", description: "Reason for the debit" },
        },
        required: ["email", "amount"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_orders",
      description: "List recent orders/transactions with customer name, plan, amount, status, and date.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["success", "pending", "failed", "all"], description: "Filter by status (default all)" },
          limit: { type: "number", description: "Max results (default 10)" },
          email: { type: "string", description: "Optional: filter by customer email" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_order",
      description: "Get details for a specific order by its payment reference.",
      parameters: {
        type: "object",
        properties: {
          reference: { type: "string", description: "Payment reference code" },
        },
        required: ["reference"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_tickets",
      description: "List support tickets. By default returns open and escalated tickets.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["open", "escalated", "closed", "all"], description: "Filter by status (default: open + escalated)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_ticket",
      description: "Get the full conversation thread for a support ticket by its ID.",
      parameters: {
        type: "object",
        properties: {
          ticket_id: { type: "number", description: "Ticket ID number" },
        },
        required: ["ticket_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "reply_ticket",
      description: "Send a reply message to a support ticket as admin.",
      parameters: {
        type: "object",
        properties: {
          ticket_id: { type: "number", description: "Ticket ID number" },
          message: { type: "string", description: "Reply message to send" },
        },
        required: ["ticket_id", "message"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "close_ticket",
      description: "Close a support ticket.",
      parameters: {
        type: "object",
        properties: {
          ticket_id: { type: "number", description: "Ticket ID number" },
        },
        required: ["ticket_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "escalate_ticket",
      description: "Escalate a support ticket to high priority.",
      parameters: {
        type: "object",
        properties: {
          ticket_id: { type: "number", description: "Ticket ID number" },
        },
        required: ["ticket_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "check_stock",
      description: "Check stock levels for all plans or a specific plan — shows available slots, total slots.",
      parameters: {
        type: "object",
        properties: {
          plan_name: { type: "string", description: "Optional plan name or ID to filter" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_promos",
      description: "List all promo/discount codes with their discount type, value, usage, and status.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "create_promo",
      description: "Create a new promo/discount code.",
      parameters: {
        type: "object",
        properties: {
          code: { type: "string", description: "The promo code (e.g. SAVE20)" },
          discount_type: { type: "string", enum: ["percent", "fixed"], description: "Percent off or fixed KES amount off" },
          discount_value: { type: "number", description: "Discount amount (e.g. 20 for 20% off)" },
          label: { type: "string", description: "Display label for the promo" },
          max_uses: { type: "number", description: "Max number of uses (null = unlimited)" },
        },
        required: ["code", "discount_type", "discount_value"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_promo",
      description: "Delete a promo code.",
      parameters: {
        type: "object",
        properties: {
          code: { type: "string", description: "The promo code to delete" },
        },
        required: ["code"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "toggle_promo",
      description: "Enable or disable a promo code.",
      parameters: {
        type: "object",
        properties: {
          code: { type: "string", description: "The promo code" },
          active: { type: "boolean", description: "true to enable, false to disable" },
        },
        required: ["code", "active"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_plans",
      description: "List all subscription plans with price, duration, category, and current stock.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "send_broadcast",
      description: "Send an email broadcast message to all registered customers.",
      parameters: {
        type: "object",
        properties: {
          subject: { type: "string", description: "Email subject line" },
          message: { type: "string", description: "Email body message (plain text or simple HTML)" },
        },
        required: ["subject", "message"],
      },
    },
  },
];

// ─── Tool executor ─────────────────────────────────────────────────────────

async function executeTool(name: string, args: any): Promise<string> {
  try {
    switch (name) {

      case "get_stats": {
        const txs = await storage.getAllTransactions();
        const customers = await storage.getAllCustomers();
        const now = new Date();
        const todayStr = now.toISOString().slice(0, 10);
        const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10);
        const monthStr = now.toISOString().slice(0, 7);

        const done = txs.filter((t: any) => t.status === "success");
        const pending = txs.filter((t: any) => t.status === "pending");
        const todayTx = done.filter((t: any) => (t.createdAt || "").startsWith(todayStr));
        const weekTx  = done.filter((t: any) => (t.createdAt || "") >= weekAgo);
        const monthTx = done.filter((t: any) => (t.createdAt || "").startsWith(monthStr));

        const sum = (arr: any[]) => arr.reduce((s: number, t: any) => s + (t.amount || 0), 0);

        return JSON.stringify({
          customers_total: customers.length,
          customers_active: customers.filter((c: any) => !c.isSuspended).length,
          customers_suspended: customers.filter((c: any) => c.isSuspended).length,
          orders_today: todayTx.length,
          revenue_today: sum(todayTx),
          orders_this_week: weekTx.length,
          revenue_this_week: sum(weekTx),
          orders_this_month: monthTx.length,
          revenue_this_month: sum(monthTx),
          orders_all_time: done.length,
          revenue_all_time: sum(done),
          orders_pending: pending.length,
        });
      }

      case "list_customers": {
        const all = await storage.getAllCustomers();
        const search = (args.search || "").toLowerCase();
        const limit = args.limit || 10;
        let filtered = search
          ? all.filter((c: any) => c.email.toLowerCase().includes(search) || (c.name || "").toLowerCase().includes(search))
          : all;
        filtered = filtered.slice(0, limit);

        const result = await Promise.all(filtered.map(async (c: any) => {
          const wallet = await storage.getWallet(c.id).catch(() => ({ balance: 0 }));
          const txs = await storage.getTransactionsByEmail(c.email).catch(() => []);
          return {
            id: c.id,
            name: c.name,
            email: c.email,
            status: c.isSuspended ? "suspended" : "active",
            wallet_balance: wallet.balance,
            order_count: txs.filter((t: any) => t.status === "success").length,
            registered: c.createdAt ? new Date(c.createdAt).toLocaleDateString() : "unknown",
          };
        }));
        return JSON.stringify(result);
      }

      case "get_customer": {
        const cust = await storage.getCustomerByEmail(args.email);
        if (!cust) return JSON.stringify({ error: `No customer found with email: ${args.email}` });
        const wallet = await storage.getWallet(cust.id).catch(() => ({ balance: 0 }));
        const txs = await storage.getTransactionsByEmail(cust.email).catch(() => []);
        const recentOrders = txs.slice(0, 5).map((t: any) => ({
          plan: t.planName,
          amount: t.amount,
          status: t.status,
          date: t.createdAt ? new Date(t.createdAt).toLocaleDateString() : "",
          reference: t.reference,
        }));
        return JSON.stringify({
          id: cust.id,
          name: cust.name,
          email: cust.email,
          phone: null,
          status: cust.suspended ? "suspended" : "active",
          wallet_balance: wallet.balance,
          total_orders: txs.filter((t: any) => t.status === "success").length,
          total_spent: txs.filter((t: any) => t.status === "success").reduce((s: number, t: any) => s + (t.amount || 0), 0),
          recent_orders: recentOrders,
          registered: cust.createdAt,
        });
      }

      case "suspend_customer": {
        const cust = await storage.getCustomerByEmail(args.email);
        if (!cust) return JSON.stringify({ error: `No customer found: ${args.email}` });
        await storage.updateCustomer(cust.id, { isSuspended: true } as any);
        return JSON.stringify({ success: true, message: `Customer ${args.email} has been suspended.` });
      }

      case "unsuspend_customer": {
        const cust = await storage.getCustomerByEmail(args.email);
        if (!cust) return JSON.stringify({ error: `No customer found: ${args.email}` });
        await storage.updateCustomer(cust.id, { isSuspended: false } as any);
        return JSON.stringify({ success: true, message: `Customer ${args.email} has been unsuspended.` });
      }

      case "credit_wallet": {
        const cust = await storage.getCustomerByEmail(args.email);
        if (!cust) return JSON.stringify({ error: `No customer found: ${args.email}` });
        const desc = args.description || "Admin credit";
        await storage.creditWallet(cust.id, args.amount, desc);
        const wallet = await storage.getWallet(cust.id);
        return JSON.stringify({ success: true, message: `Added KES ${args.amount} to ${args.email}'s wallet. New balance: KES ${wallet.balance}.` });
      }

      case "debit_wallet": {
        const cust = await storage.getCustomerByEmail(args.email);
        if (!cust) return JSON.stringify({ error: `No customer found: ${args.email}` });
        const desc = args.description || "Admin debit";
        const ok = await storage.debitWallet(cust.id, args.amount, desc);
        if (!ok) {
          const wallet = await storage.getWallet(cust.id);
          return JSON.stringify({ error: `Insufficient balance. Current balance: KES ${wallet.balance}.` });
        }
        const wallet = await storage.getWallet(cust.id);
        return JSON.stringify({ success: true, message: `Debited KES ${args.amount} from ${args.email}'s wallet. New balance: KES ${wallet.balance}.` });
      }

      case "list_orders": {
        const txs = await storage.getAllTransactions();
        const statusFilter = args.status || "all";
        const limit = args.limit || 10;
        const emailFilter = args.email ? args.email.toLowerCase() : null;
        let filtered = txs;
        if (statusFilter !== "all") filtered = filtered.filter((t: any) => t.status === statusFilter);
        if (emailFilter) filtered = filtered.filter((t: any) => (t.customerEmail || "").toLowerCase() === emailFilter);
        filtered = filtered.slice(0, limit);
        return JSON.stringify(filtered.map((t: any) => ({
          reference: t.reference,
          plan: t.planName,
          amount: t.amount,
          status: t.status,
          email: t.customerEmail,
          date: t.createdAt ? new Date(t.createdAt).toLocaleDateString() : "",
        })));
      }

      case "get_order": {
        const txs = await storage.getAllTransactions();
        const order = txs.find((t: any) => (t.reference || "").toLowerCase().includes(args.reference.toLowerCase()));
        if (!order) return JSON.stringify({ error: `Order not found: ${args.reference}` });
        return JSON.stringify(order);
      }

      case "list_tickets": {
        const statusFilter = args.status || "open";
        let tickets: any[];
        if (statusFilter === "all") {
          tickets = await storage.getAllTickets().catch(() => storage.getOpenTickets());
        } else if (statusFilter === "open") {
          tickets = await storage.getOpenTickets();
          tickets = tickets.filter((t: any) => t.status === "open" || t.status === "escalated");
        } else {
          tickets = await storage.getAllTickets().catch(() => storage.getOpenTickets());
          tickets = tickets.filter((t: any) => t.status === statusFilter);
        }
        return JSON.stringify(tickets.map((t: any) => ({
          id: t.id,
          subject: t.subject,
          status: t.status,
          email: t.customerEmail,
          created: t.createdAt ? new Date(t.createdAt).toLocaleDateString() : "",
        })));
      }

      case "get_ticket": {
        const ticket = await storage.getTicketById(args.ticket_id);
        if (!ticket) return JSON.stringify({ error: `Ticket #${args.ticket_id} not found.` });
        const messages = await storage.getMessages(args.ticket_id);
        return JSON.stringify({
          id: ticket.id,
          subject: ticket.subject,
          status: ticket.status,
          email: ticket.customerEmail,
          messages: messages.map((m: any) => ({ sender: m.sender, message: m.message, time: m.createdAt })),
        });
      }

      case "reply_ticket": {
        const ticket = await storage.getTicketById(args.ticket_id);
        if (!ticket) return JSON.stringify({ error: `Ticket #${args.ticket_id} not found.` });
        await storage.addMessage({ ticketId: args.ticket_id, sender: "admin", message: args.message });
        return JSON.stringify({ success: true, message: `Reply sent to ticket #${args.ticket_id}.` });
      }

      case "close_ticket": {
        const ticket = await storage.getTicketById(args.ticket_id);
        if (!ticket) return JSON.stringify({ error: `Ticket #${args.ticket_id} not found.` });
        await storage.updateTicket(args.ticket_id, { status: "closed" });
        return JSON.stringify({ success: true, message: `Ticket #${args.ticket_id} closed.` });
      }

      case "escalate_ticket": {
        const ticket = await storage.getTicketById(args.ticket_id);
        if (!ticket) return JSON.stringify({ error: `Ticket #${args.ticket_id} not found.` });
        await storage.updateTicket(args.ticket_id, { status: "escalated" });
        return JSON.stringify({ success: true, message: `Ticket #${args.ticket_id} escalated to high priority.` });
      }

      case "check_stock": {
        const plans = getAllPlansFlat();
        const query = (args.plan_name || "").toLowerCase();
        const filtered = query ? plans.filter(p => p.name.toLowerCase().includes(query) || p.id.toLowerCase().includes(query)) : plans;
        const result = filtered.map(p => {
          const info = accountManager.getStockInfo(p.id);
          return {
            plan: p.name,
            category: p.category,
            price: p.price,
            available: info.available,
            total: info.total,
            status: info.available === 0 ? "out_of_stock" : info.available <= 2 ? "low_stock" : "in_stock",
          };
        });
        return JSON.stringify(result);
      }

      case "list_promos": {
        const promos = promoManager.getAll();
        return JSON.stringify(promos.map(p => ({
          code: p.code,
          label: p.label,
          discount: `${p.discountValue}${p.discountType === "percent" ? "%" : " KES"}`,
          uses: `${p.uses}${p.maxUses ? "/" + p.maxUses : ""}`,
          active: p.active,
          expires: p.expiresAt || "never",
        })));
      }

      case "create_promo": {
        const promo = promoManager.create({
          code: args.code.toUpperCase(),
          label: args.label || args.code,
          discountType: args.discount_type,
          discountValue: args.discount_value,
          maxUses: args.max_uses || null,
          expiresAt: null,
          active: true,
          applicablePlans: null,
        });
        return JSON.stringify({ success: true, message: `Promo code ${promo.code} created (${promo.discountValue}${promo.discountType === "percent" ? "%" : " KES"} off).` });
      }

      case "delete_promo": {
        const ok = promoManager.delete(args.code);
        if (!ok) return JSON.stringify({ error: `Promo code ${args.code} not found.` });
        return JSON.stringify({ success: true, message: `Promo code ${args.code} deleted.` });
      }

      case "toggle_promo": {
        const updated = promoManager.update(args.code, { active: args.active });
        if (!updated) return JSON.stringify({ error: `Promo code ${args.code} not found.` });
        return JSON.stringify({ success: true, message: `Promo code ${args.code} is now ${args.active ? "enabled" : "disabled"}.` });
      }

      case "list_plans": {
        const plans = getAllPlansFlat();
        const result = plans.map(p => {
          const info = accountManager.getStockInfo(p.id);
          return { ...p, available_slots: info.available, total_slots: info.total };
        });
        return JSON.stringify(result);
      }

      case "send_broadcast": {
        const customers = await storage.getAllCustomers();
        const emails = customers.map((c: any) => c.email).filter(Boolean);
        if (!emails.length) return JSON.stringify({ error: "No customers to broadcast to." });
        await sendBulkEmail(
          emails,
          args.subject,
          `<div style="font-family:sans-serif;line-height:1.6;">${args.message.replace(/\n/g, "<br>")}</div>`
        );
        return JSON.stringify({ success: true, message: `Broadcast sent to ${emails.length} customers.` });
      }

      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
  } catch (err: any) {
    return JSON.stringify({ error: err.message || "Operation failed" });
  }
}

// ─── System prompt ──────────────────────────────────────────────────────────

function buildSystemPrompt(): string {
  const { siteName } = getAppConfig();
  return `You are the Admin AI Assistant for ${siteName}, a premium subscription store. You are talking directly to the store admin.

You have full access to admin tools to manage everything: customers, orders, support tickets, stock, promo codes, plans, and sending email broadcasts.

Your role:
- Understand what the admin wants to do in natural language
- Call the appropriate tools to get data or perform actions
- Report results clearly and concisely
- For dangerous actions (suspend, debit, delete), confirm that the action was taken and what the result was
- Format numbers with commas for readability (e.g. KES 12,500)
- Keep responses concise and action-focused

You can do anything the admin web panel can do. Be direct and efficient.`;
}

// ─── Session history ────────────────────────────────────────────────────────

const sessions = new Map<string, OpenAI.Chat.Completions.ChatCompletionMessageParam[]>();

export async function getAdminAIResponse(
  sessionId: string,
  userMessage: string
): Promise<{ response: string; sessionId: string }> {
  const client = getOpenAIClient();
  if (!client) {
    return {
      response: "AI assistant is not configured. Please set up the OpenAI API key in Settings.",
      sessionId,
    };
  }

  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, [{ role: "system", content: buildSystemPrompt() }]);
  }

  const messages = sessions.get(sessionId)!;
  messages.push({ role: "user", content: userMessage });

  try {
    let iterations = 0;
    while (iterations < 5) {
      iterations++;

      const completion = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages,
        tools,
        tool_choice: "auto",
        max_tokens: 800,
        temperature: 0.2,
      });

      const choice = completion.choices[0];
      const msg = choice.message;
      messages.push(msg as any);

      if (choice.finish_reason === "tool_calls" && msg.tool_calls?.length) {
        for (const toolCall of msg.tool_calls) {
          const toolName = (toolCall as any).function.name;
          let toolArgs: any = {};
          try { toolArgs = JSON.parse((toolCall as any).function.arguments || "{}"); } catch {}
          const result = await executeTool(toolName, toolArgs);
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: result,
          });
        }
        continue;
      }

      const text = msg.content || "Done.";

      if (messages.length > 30) {
        const sys = messages[0];
        const recent = messages.slice(-24);
        messages.length = 0;
        messages.push(sys, ...recent);
      }

      return { response: text, sessionId };
    }

    return { response: "I completed the operations. Let me know if you need anything else.", sessionId };
  } catch (err: any) {
    console.error("[admin-ai] Error:", err.message);
    return { response: `Error: ${err.message || "Something went wrong. Please try again."}`, sessionId };
  }
}

export function clearAdminAISession(sessionId: string): void {
  sessions.delete(sessionId);
}
