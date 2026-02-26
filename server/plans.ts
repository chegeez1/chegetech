import type { PlanCategory } from "@shared/schema";

export const subscriptionPlans: Record<string, PlanCategory> = {
  streaming: {
    category: "Streaming Services",
    icon: "Play",
    color: "#4169E1",
    plans: {
      netflix: { name: "Netflix", price: 150, duration: "1 Month", features: ["HD Streaming", "Multiple Devices", "Original Shows"], popular: true, shared: true, maxUsers: 5 },
      primevideo: { name: "Prime Video", price: 100, duration: "1 Month", features: ["HD Streaming", "Amazon Originals", "Offline Viewing"], popular: true, shared: true, maxUsers: 5 },
      primevideo_3m: { name: "Prime Video (3 Months)", price: 250, duration: "3 Months", features: ["HD Streaming", "Amazon Originals", "Offline Viewing"], shared: true, maxUsers: 5 },
      primevideo_6m: { name: "Prime Video (6 Months)", price: 550, duration: "6 Months", features: ["HD Streaming", "Amazon Originals", "Offline Viewing"], shared: true, maxUsers: 5 },
      showmax_1m: { name: "Showmax Pro", price: 100, duration: "1 Month", features: ["Live Sports", "Showmax Originals", "Multiple Devices"], shared: true, maxUsers: 5 },
      showmax_3m: { name: "Showmax Pro (3 Months)", price: 250, duration: "3 Months", features: ["Live Sports", "Showmax Originals", "Multiple Devices"], shared: true, maxUsers: 5 },
      showmax_1y: { name: "Showmax Pro (1 Year)", price: 900, duration: "1 Year", features: ["Live Sports", "Showmax Originals", "Multiple Devices"], popular: true, shared: true, maxUsers: 5 },
      peacock_tv: { name: "Peacock TV", price: 50, duration: "1 Month", features: ["Live Sports", "NBC Shows", "Next-Day TV"], shared: true, maxUsers: 5 },
    },
  },
  music: {
    category: "Music & Audio",
    icon: "Music",
    color: "#F7B801",
    plans: {
      spotify: { name: "Spotify Premium", price: 400, duration: "3 Months", features: ["Ad-Free Music", "Offline Mode", "High-Quality Audio"], popular: true, shared: true, maxUsers: 5 },
      applemusic: { name: "Apple Music", price: 250, duration: "1 Month", features: ["Ad-Free Music", "Offline Listening", "Lossless Audio"], shared: true, maxUsers: 5 },
      youtubepremium: { name: "YouTube Premium", price: 100, duration: "1 Month", features: ["Ad-Free Videos", "Background Play", "YouTube Music"], shared: true, maxUsers: 5 },
      deezer: { name: "Deezer Premium", price: 200, duration: "1 Month", features: ["Ad-Free Music", "Offline Listening", "High Quality Audio"], shared: true, maxUsers: 5 },
      tidal: { name: "Tidal HiFi", price: 250, duration: "1 Month", features: ["HiFi Audio", "Offline Mode", "Ad-Free"], shared: true, maxUsers: 5 },
      audible: { name: "Audible Premium Plus", price: 400, duration: "1 Month", features: ["Audiobooks Access", "Monthly Credits", "Offline Listening"], shared: true, maxUsers: 5 },
    },
  },
  productivity: {
    category: "Productivity Tools",
    icon: "Briefcase",
    color: "#45B7D1",
    plans: {
      canva: { name: "Canva Pro", price: 300, duration: "1 Month", features: ["Premium Templates", "Brand Kit", "Background Remover"], popular: true, shared: true, maxUsers: 5 },
      grammarly: { name: "Grammarly Premium", price: 250, duration: "1 Month", features: ["Advanced Grammar", "Tone Detection", "Plagiarism Check"], shared: true, maxUsers: 5 },
      skillshare: { name: "Skillshare Premium", price: 350, duration: "1 Month", features: ["Unlimited Classes", "Offline Access", "Creative Skills"], shared: true, maxUsers: 5 },
      masterclass: { name: "MasterClass", price: 600, duration: "1 Month", features: ["Expert Instructors", "Unlimited Lessons", "Offline Access"], shared: true, maxUsers: 5 },
      duolingo: { name: "Duolingo Super", price: 150, duration: "1 Month", features: ["Ad-Free Learning", "Offline Lessons", "Unlimited Hearts"], shared: true, maxUsers: 5 },
      notion: { name: "Notion Plus", price: 200, duration: "1 Month", features: ["Unlimited Blocks", "Collaboration Tools", "File Uploads"], shared: true, maxUsers: 5 },
      microsoft365: { name: "Microsoft 365", price: 500, duration: "1 Month", features: ["Office Apps", "Cloud Storage", "Collaboration Tools"], shared: true, maxUsers: 5 },
      adobecc: { name: "Adobe Creative Cloud", price: 700, duration: "1 Month", features: ["Full Suite Access", "Cloud Sync", "Regular Updates"], shared: true, maxUsers: 5 },
    },
  },
  vpn: {
    category: "VPN & Security",
    icon: "Shield",
    color: "#4ECDC4",
    plans: {
      nordvpn: { name: "NordVPN", price: 350, duration: "1 Month", features: ["Fast Servers", "Secure Encryption", "No Logs"], popular: true, shared: true, maxUsers: 5 },
      expressvpn: { name: "ExpressVPN", price: 400, duration: "1 Month", features: ["Ultra Fast", "Global Servers", "No Logs"], shared: true, maxUsers: 5 },
      surfshark: { name: "Surfshark VPN", price: 200, duration: "1 Month", features: ["Unlimited Devices", "Ad Blocker", "Fast Servers"], shared: true, maxUsers: 5 },
      protonvpn: { name: "ProtonVPN Plus", price: 300, duration: "1 Month", features: ["Secure Core", "No Logs", "High-Speed Servers"], shared: true, maxUsers: 5 },
      cyberghost: { name: "CyberGhost VPN", price: 250, duration: "1 Month", features: ["Global Servers", "Streaming Support", "No Logs"], shared: true, maxUsers: 5 },
    },
  },
  gaming: {
    category: "Gaming Services",
    icon: "Gamepad2",
    color: "#A28BFE",
    plans: {
      xbox: { name: "Xbox Game Pass", price: 400, duration: "1 Month", features: ["100+ Games", "Cloud Gaming", "Exclusive Titles"], popular: true, shared: true, maxUsers: 5 },
      playstation: { name: "PlayStation Plus", price: 400, duration: "1 Month", features: ["Multiplayer Access", "Monthly Games", "Discounts"], shared: true, maxUsers: 5 },
      eaplay: { name: "EA Play", price: 250, duration: "1 Month", features: ["EA Games Access", "Early Trials", "Member Rewards"], shared: true, maxUsers: 5 },
      ubisoft: { name: "Ubisoft+", price: 300, duration: "1 Month", features: ["Ubisoft Games Library", "New Releases", "Cloud Play"], shared: true, maxUsers: 5 },
      geforcenow: { name: "Nvidia GeForce Now", price: 350, duration: "1 Month", features: ["Cloud Gaming", "High Performance", "Cross-Device Access"], shared: true, maxUsers: 5 },
    },
  },
};
