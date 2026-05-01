import { motion } from 'framer-motion';

// SVG logo components for each service
function NetflixLogo() {
  return (
    <svg viewBox="0 0 111 30" width="72" height="20" fill="#E50914">
      <path d="M105.062 0.00139409L93.3533 25.9325C91.6455 25.6804 89.9377 25.4547 88.1771 25.2819L96.8703 5.45355L85.5136 0.00139409H105.062ZM28.3994 0.00139409H8.85117L0 30H19.5482L28.3994 0.00139409ZM52.9004 0.00139409H33.3522L24.5009 30H44.0491L52.9004 0.00139409ZM63.9524 0.00139409V30H44.4042L53.2554 0.00139409H63.9524ZM77.4524 0.00139409V22.7768C75.6918 22.5776 73.9578 22.4311 72.1972 22.2848V0.00139409H77.4524ZM77.4524 30V25.9325C79.2131 26.1581 80.9473 26.3573 82.7078 26.6094V30H77.4524Z"/>
    </svg>
  );
}

function SpotifyLogo() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="#1DB954">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
    </svg>
  );
}

function DisneyPlusLogo() {
  return (
    <svg viewBox="0 0 50 30" width="60" height="36">
      <text x="0" y="24" fontFamily="Arial Black, sans-serif" fontSize="22" fontWeight="900" fill="#113CCF">Disney+</text>
    </svg>
  );
}

function YoutubeLogo() {
  return (
    <svg viewBox="0 0 90 20" width="80" height="18">
      <rect x="0" y="0" width="28" height="20" rx="4" fill="#FF0000"/>
      <polygon points="11,4 11,16 21,10" fill="white"/>
      <text x="33" y="15" fontFamily="Arial, sans-serif" fontSize="14" fontWeight="700" fill="#ffffff">Premium</text>
    </svg>
  );
}

function CanvaLogo() {
  return (
    <div className="flex items-center gap-1.5">
      <svg viewBox="0 0 40 40" width="28" height="28">
        <circle cx="20" cy="20" r="20" fill="#7B2FBE"/>
        <text x="10" y="26" fontFamily="Arial Black" fontSize="18" fontWeight="900" fill="white">C</text>
      </svg>
      <span style={{ fontFamily: 'var(--font-display)', fontWeight: 900, color: '#7B2FBE', fontSize: 16 }}>Canva</span>
    </div>
  );
}

const SERVICES = [
  {
    name: 'Netflix',
    tier: 'Premium 4K',
    color: '#E50914',
    screens: '4 screens',
    desc: 'Ultra HD · HDR · Dolby Atmos',
    logo: <NetflixLogo />,
    bgPattern: 'linear-gradient(135deg, #E5091420 0%, #0a0a0a 60%)',
  },
  {
    name: 'Disney+',
    tier: 'Premium',
    color: '#113CCF',
    screens: 'Unlimited',
    desc: 'Marvel · Star Wars · Pixar · Nat Geo',
    logo: <DisneyPlusLogo />,
    bgPattern: 'linear-gradient(135deg, #113CCF20 0%, #0a0a0a 60%)',
  },
  {
    name: 'Prime Video',
    tier: 'Unlimited',
    color: '#00A8E0',
    screens: '3 screens',
    desc: 'Originals · Movies · Live Sports',
    logo: (
      <svg viewBox="0 0 100 30" width="90" height="27">
        <text x="0" y="22" fontFamily="Arial, sans-serif" fontSize="17" fontWeight="700" fill="#ffffff">prime </text>
        <text x="48" y="22" fontFamily="Arial, sans-serif" fontSize="17" fontWeight="300" fill="#00A8E0">video</text>
      </svg>
    ),
    bgPattern: 'linear-gradient(135deg, #00A8E020 0%, #0a0a0a 60%)',
  },
  {
    name: 'Showmax',
    tier: 'Pro',
    color: '#ec4899',
    screens: '5 screens',
    desc: 'African content · Sport · International',
    logo: (
      <svg viewBox="0 0 100 28" width="90" height="25">
        <text x="0" y="22" fontFamily="Arial Black, sans-serif" fontSize="20" fontWeight="900" fill="#ec4899">Showmax</text>
      </svg>
    ),
    bgPattern: 'linear-gradient(135deg, #ec489920 0%, #0a0a0a 60%)',
  },
  {
    name: 'Spotify',
    tier: 'Premium',
    color: '#1DB954',
    screens: 'Family Plan',
    desc: 'No ads · Offline · Hi-Fi quality',
    logo: (
      <div className="flex items-center gap-2">
        <SpotifyLogo />
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 900, color: '#1DB954', fontSize: 16 }}>Spotify</span>
      </div>
    ),
    bgPattern: 'linear-gradient(135deg, #1DB95420 0%, #0a0a0a 60%)',
  },
  {
    name: 'YouTube',
    tier: 'Premium',
    color: '#FF0000',
    screens: 'Ad-Free',
    desc: 'No ads · Background play · Downloads',
    logo: <YoutubeLogo />,
    bgPattern: 'linear-gradient(135deg, #FF000020 0%, #0a0a0a 60%)',
  },
  {
    name: 'Canva',
    tier: 'Pro',
    color: '#7B2FBE',
    screens: '1 user',
    desc: 'Premium templates · Brand Kit · AI tools',
    logo: <CanvaLogo />,
    bgPattern: 'linear-gradient(135deg, #7B2FBE20 0%, #0a0a0a 60%)',
  },
  {
    name: 'ChatGPT',
    tier: 'Plus',
    color: '#22c55e',
    screens: '1 user',
    desc: 'GPT-4o · DALL·E · Code Interpreter',
    logo: (
      <div className="flex items-center gap-2">
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none">
          <circle cx="12" cy="12" r="11" stroke="#22c55e" strokeWidth="1.5"/>
          <path d="M7 12h10M12 7v10" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 900, color: '#22c55e', fontSize: 16 }}>ChatGPT</span>
      </div>
    ),
    bgPattern: 'linear-gradient(135deg, #22c55e20 0%, #0a0a0a 60%)',
  },
];

export default function Scene4PremiumAccounts() {
  return (
    <motion.div
      className="absolute inset-0 flex flex-col px-12 py-9"
      style={{ backgroundColor: '#0a0a0a' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      <motion.div
        className="text-center mb-7"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.7 }}
      >
        <span className="text-sm font-mono uppercase tracking-widest" style={{ color: '#ec4899' }}>
          StreamVault Premium
        </span>
        <h2 className="text-5xl font-bold mt-2" style={{ fontFamily: 'var(--font-display)', color: '#ffffff' }}>
          Premium Accounts
        </h2>
        <p className="mt-2 text-sm" style={{ color: '#71717a' }}>
          Instant delivery · Verified · All in one subscription
        </p>
      </motion.div>

      <div className="grid grid-cols-4 gap-3 flex-1">
        {SERVICES.map((s, i) => (
          <motion.div
            key={s.name}
            className="rounded-2xl p-4 flex flex-col gap-3"
            style={{
              background: s.bgPattern,
              border: `1px solid ${s.color}22`,
            }}
            initial={{ opacity: 0, y: 22, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.28 + i * 0.07, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Logo area */}
            <div
              className="flex items-center justify-center rounded-xl overflow-hidden"
              style={{ height: 52, background: '#0d0d0d', border: `1px solid ${s.color}1a` }}
            >
              {s.logo}
            </div>

            <div className="flex items-center justify-between">
              <div className="text-sm font-bold" style={{ fontFamily: 'var(--font-display)', color: '#ffffff' }}>
                {s.name}
              </div>
              <div
                className="text-xs font-bold px-2 py-0.5 rounded-full"
                style={{ background: `${s.color}18`, color: s.color, fontFamily: 'var(--font-mono)', fontSize: '0.6rem' }}
              >
                {s.tier}
              </div>
            </div>

            <div className="text-xs leading-relaxed" style={{ color: '#52525b' }}>
              {s.desc}
            </div>

            <div className="flex items-center gap-1.5 mt-auto">
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#22c55e' }} />
              <span className="text-xs" style={{ color: '#71717a' }}>{s.screens}</span>
            </div>
          </motion.div>
        ))}
      </div>

      <motion.div
        className="mt-5 flex items-center justify-center gap-6"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9 }}
      >
        {[
          { icon: '⚡', text: 'Instant delivery' },
          { icon: '🔒', text: 'Secure & verified' },
          { icon: '♻️', text: 'Auto-renewal support' },
          { icon: '💬', text: '24/7 live chat' },
        ].map(tag => (
          <div key={tag.text} className="flex items-center gap-2 text-sm" style={{ color: '#52525b' }}>
            <span>{tag.icon}</span>
            <span>{tag.text}</span>
          </div>
        ))}
      </motion.div>
    </motion.div>
  );
}
