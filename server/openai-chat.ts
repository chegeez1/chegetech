import OpenAI from "openai";
import { subscriptionPlans } from "./plans";
import { planOverridesManager } from "./plan-overrides";
import { getCredentialsOverride } from "./credentials-store";

const conversationHistory: Map<string, Array<{ role: "system" | "user" | "assistant"; content: string }>> = new Map();

function buildSystemPrompt(): string {
  const planInfo: string[] = [];
  for (const [categoryKey, category] of Object.entries(subscriptionPlans)) {
    const planNames = Object.entries(category.plans).map(
      ([id, plan]) => `${plan.name} (${plan.duration}) - KES ${plan.price}`
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
- Customers can create accounts to track their orders
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

export function getAIChatResponse(sessionId: string, userMessage: string): Promise<{ response: string; sessionId: string }> {
  return new Promise(async (resolve, reject) => {
    try {
      const override = getCredentialsOverride();
      const apiKey = override.openaiApiKey || process.env.OPENAI_API_KEY;
      if (!apiKey) {
        return resolve({
          response: "AI support is currently unavailable. Please try talking to a human agent instead.",
          sessionId,
        });
      }
      const openai = new OpenAI({ apiKey });

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

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: messages,
        max_tokens: 500,
        temperature: 0.7,
      });

      const assistantMessage = completion.choices[0]?.message?.content || "I'm sorry, I couldn't generate a response. Please try again.";
      messages.push({ role: "assistant", content: assistantMessage });

      resolve({ response: assistantMessage, sessionId });
    } catch (error: any) {
      console.error("[openai-chat] Error:", error.message);
      if (error.status === 401 || error.code === "invalid_api_key") {
        resolve({
          response: "AI support is currently unavailable. Please try talking to a human agent instead.",
          sessionId,
        });
      } else {
        resolve({
          response: "I'm having trouble processing your request right now. Please try again or talk to a human agent.",
          sessionId,
        });
      }
    }
  });
}

export function clearSession(sessionId: string): void {
  conversationHistory.delete(sessionId);
}
