import { initializeDatabase, getDb } from "./storage";
import { bots } from "@shared/schema";
import { eq } from "drizzle-orm";

const SEED_BOTS = [
  {
    name: "Atassa-MD",
    description: "A powerful multi-device WhatsApp bot with 200+ commands, auto-reply, group management, media tools, and AI chat features.",
    repoUrl: "https://github.com/chegeez1/Atassa-MD",
    imageUrl: "",
    price: 70,
    features: ["200+ Commands", "Auto-Reply", "Group Management", "Media Downloader", "AI Chat", "Anti-link Protection"],
    requiresSessionId: true,
    requiresDbUrl: false,
    category: "Multi-Purpose",
    active: true,
  },
  {
    name: "Gifted-MD",
    description: "Feature-rich WhatsApp bot with entertainment commands, sticker maker, YouTube downloader, and group tools.",
    repoUrl: "https://github.com/chegeez1/Gifted-MD",
    imageUrl: "",
    price: 70,
    features: ["Sticker Maker", "YouTube Download", "Group Tools", "Fun Commands", "Media Player", "Auto-Status View"],
    requiresSessionId: true,
    requiresDbUrl: false,
    category: "Multi-Purpose",
    active: true,
  },
  {
    name: "Noxious-MD",
    description: "Advanced WhatsApp bot with anti-spam, raid protection, welcome/goodbye messages, and extensive moderation tools for group admins.",
    repoUrl: "https://github.com/chegeez1/Noxious-MD",
    imageUrl: "",
    price: 80,
    features: ["Anti-Spam", "Raid Protection", "Welcome Messages", "Group Moderation", "Auto-Kick", "Poll Creator"],
    requiresSessionId: true,
    requiresDbUrl: false,
    category: "Moderation",
    active: true,
  },
  {
    name: "Turbo-MD",
    description: "Blazing-fast WhatsApp bot focused on media: download from YouTube, TikTok, Instagram, and Twitter with one command.",
    repoUrl: "https://github.com/chegeez1/Turbo-MD",
    imageUrl: "",
    price: 70,
    features: ["YouTube Download", "TikTok Download", "Instagram Reels", "Twitter/X Media", "Audio Converter", "Fast Delivery"],
    requiresSessionId: true,
    requiresDbUrl: false,
    category: "Media",
    active: true,
  },
  {
    name: "Leifo-MD",
    description: "AI-powered WhatsApp bot with GPT integration, image generation, voice transcription, and smart auto-replies.",
    repoUrl: "https://github.com/chegeez1/Leifo-MD",
    imageUrl: "",
    price: 100,
    features: ["GPT Integration", "Image Generation", "Voice Transcription", "Smart Auto-Reply", "Language Detection", "Translation"],
    requiresSessionId: true,
    requiresDbUrl: false,
    category: "AI-Powered",
    active: true,
  },
  {
    name: "DarkMatter-MD",
    description: "Premium all-in-one WhatsApp bot with business tools, auto-catalog, customer tracking, and invoice generation.",
    repoUrl: "https://github.com/chegeez1/DarkMatter-MD",
    imageUrl: "",
    price: 120,
    features: ["Business Tools", "Auto-Catalog", "Customer Tracking", "Invoice Generator", "Broadcast Lists", "CRM Lite"],
    requiresSessionId: true,
    requiresDbUrl: false,
    category: "Business",
    active: true,
  },
];

async function seed() {
  await initializeDatabase();
  const db = getDb();

  for (const bot of SEED_BOTS) {
    const existing = await db.select().from(bots).where(eq(bots.name, bot.name));
    if (existing.length === 0) {
      await db.insert(bots).values({ ...bot, features: JSON.stringify(bot.features) });
      console.log(`Seeded bot: ${bot.name}`);
    } else {
      console.log(`Bot already exists: ${bot.name}`);
    }
  }
  process.exit(0);
}

seed().catch((e) => { console.error(e); process.exit(1); });
