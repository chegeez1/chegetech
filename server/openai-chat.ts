import OpenAI from "openai";
import { subscriptionPlans } from "./plans";
import { planOverridesManager } from "./plan-overrides";

const conversationHistory: Map<string, Array<{ role: "system" | "user" | "assistant"; content: string }>> = new Map();

function getOpenAIClient(): OpenAI | null {
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  if (baseURL && apiKey) {
    return new OpenAI({ apiKey, baseURL });
  }
  return null;
}

function buildSystemPrompt(): string {
  const planInfo: string[] = [];
  for (const [, category] of Object.entries(subscriptionPlans)) {
    const planNames = Object.entries(category.plans).map(
      ([, plan]) => `${plan.name} (${plan.duration}) - KES ${plan.price}`
    );
    planInfo.push(`${category.category}: ${planNames.join(", ")}`);
  }

  const customPlans = planOverridesManager.getCustomPlans();
  if (customPlans.length > 0) {
    const customPlanNames = customPlans.map(
      (cp) => `${cp.name} (${cp.duration}) - KES ${cp.price}`
    );
    planInfo.push(`Custom Plans: ${customPlanNames.join(", ")}`);
  }

  return `You are a helpful customer support assistant for Chege Tech, a digital subscription and streaming service store. You help customers with questions about plans, pricing, activation, payments, and account issues.

Available Plans:
${planInfo.join("\n")}

Key Information:
- Payments are processed via Paystack (M-Pesa, card, etc.)
- After payment, account credentials are delivered via email automatically
- Shared accounts mean multiple users share one subscription
- Customers can create accounts to track their orders and view their wallet balance
- Customers earn KES 100 wallet credit for each successful referral (when the referee makes their first purchase)
- Referred customers get KES 50 wallet credit on their first purchase
- Wallet balance can be used to pay for subscriptions
- If a customer has activation issues, they should check their email (including spam folder) for credentials
- For payment issues, customers should verify the transaction reference
- For refund requests or complex issues, suggest escalating to a human support agent

Guidelines:
- Be friendly, concise, and helpful
- If you cannot resolve an issue, suggest the customer talk to a human agent using the "Talk to human" button
- Do not make up information about plans or prices not listed above
- Respond in the same language the customer uses
- Keep responses brief and to the point`;
}

export async function getAIChatResponse(sessionId: string, userMessage: string): Promise<{ response: string; sessionId: string }> {
  const client = getOpenAIClient();
  if (!client) {
    return {
      response: "Our AI assistant is being set up. Please use the **Talk to human** button to speak with our support team directly.",
      sessionId,
    };
  }

  try {
    if (!conversationHistory.has(sessionId)) {
      conversationHistory.set(sessionId, [
        { role: "system", content: buildSystemPrompt() }
      ]);
    }

    const messages = conversationHistory.get(sessionId)!;
    messages.push({ role: "user", content: userMessage });

    if (messages.length > 21) {
      const systemMsg = messages[0];
      const recentMessages = messages.slice(-20);
      messages.length = 0;
      messages.push(systemMsg, ...recentMessages);
    }

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: messages,
      max_tokens: 500,
      temperature: 0.7,
    });

    const assistantMessage = completion.choices[0]?.message?.content || "I'm sorry, I couldn't generate a response. Please try again.";
    messages.push({ role: "assistant", content: assistantMessage });

    return { response: assistantMessage, sessionId };
  } catch (error: any) {
    console.error("[ai-chat] Error:", error.message);
    return {
      response: "I'm having trouble right now. Please try again or tap **Talk to human** to speak with our team.",
      sessionId,
    };
  }
}

export function clearSession(sessionId: string): void {
  conversationHistory.delete(sessionId);
}
