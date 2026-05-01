import { useState, useEffect, useRef } from "react";
import { Play, Pause, SkipForward, Volume2, VolumeX, X } from "lucide-react";

interface Track {
  title: string;
  artist: string;
  preview: string;
}

const INTRO_TEXT = "This is Chege Tech Incorporative. Enjoy our cheap premium plans.";

export default function StoreAudioPlayer() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [visible, setVisible] = useState(true);
  const [phase, setPhase] = useState<"idle" | "intro" | "music">("idle");
  const [bars, setBars] = useState([30, 30, 30, 30]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const startedRef = useRef(false);
  const tracksRef = useRef<Track[]>([]);
  const idxRef = useRef(0);
  const mutedRef = useRef(false);

  useEffect(() => { tracksRef.current = tracks; }, [tracks]);
  useEffect(() => { idxRef.current = idx; }, [idx]);
  useEffect(() => { mutedRef.current = muted; }, [muted]);

  useEffect(() => {
    fetch("/api/music-tracks")
      .then(r => r.json())
      .then(d => { if (d.tracks?.length) setTracks(d.tracks); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (playing && phase === "music") {
      timer = setInterval(() => setBars([
        Math.random() * 70 + 20,
        Math.random() * 70 + 20,
        Math.random() * 70 + 20,
        Math.random() * 70 + 20,
      ]), 180);
    } else {
      setBars([30, 30, 30, 30]);
    }
    return () => clearInterval(timer);
  }, [playing, phase]);

  function playAudioTrack(track: Track) {
    const audio = audioRef.current;
    if (!audio) return;
    audio.src = track.preview;
    audio.muted = mutedRef.current;
    audio.volume = 0.7;
    audio.load();
    audio.play()
      .then(() => { setPhase("music"); setPlaying(true); })
      .catch(() => { setPhase("music"); setPlaying(false); });
  }

  function doIntroThenPlay() {
    if (!window.speechSynthesis) {
      const t = tracksRef.current;
      if (t.length) playAudioTrack(t[idxRef.current]);
      return;
    }
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(INTRO_TEXT);
    utt.rate = 0.82;
    utt.pitch = 0.65;
    utt.volume = 1;

    function pickVoiceAndSpeak() {
      const voices = window.speechSynthesis.getVoices();
      const male = voices.find(v =>
        v.lang.startsWith("en") &&
        /david|mark|guy|daniel|james|richard|george|fred|alex/i.test(v.name)
      ) || voices.find(v => v.lang.startsWith("en-US") || v.lang.startsWith("en-GB"))
        || voices.find(v => v.lang.startsWith("en"));
      if (male) utt.voice = male;

      utt.onend = () => {
        const t = tracksRef.current;
        if (t.length) playAudioTrack(t[idxRef.current]);
      };
      utt.onerror = () => {
        const t = tracksRef.current;
        if (t.length) playAudioTrack(t[idxRef.current]);
      };
      setPhase("intro");
      window.speechSynthesis.speak(utt);
    }

    if (window.speechSynthesis.getVoices().length > 0) {
      pickVoiceAndSpeak();
    } else {
      window.speechSynthesis.onvoiceschanged = pickVoiceAndSpeak;
    }
  }

  function handlePlay() {
    const audio = audioRef.current;
    if (!audio) return;

    if (!startedRef.current) {
      startedRef.current = true;
      if (tracksRef.current.length > 0) {
        audio.src = tracksRef.current[0].preview;
        audio.muted = true;
        audio.volume = 0;
        audio.play()
          .then(() => { audio.pause(); audio.muted = mutedRef.current; audio.volume = 0.7; })
          .catch(() => {});
      }
      doIntroThenPlay();
      return;
    }

    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.play()
        .then(() => setPlaying(true))
        .catch(() => {});
    }
  }

  function skip() {
    const t = tracksRef.current;
    if (!t.length) return;
    const next = (idxRef.current + 1) % t.length;
    setIdx(next);
    idxRef.current = next;
    if (phase === "music") playAudioTrack(t[next]);
  }

  function toggleMute() {
    setMuted(m => {
      const next = !m;
      mutedRef.current = next;
      if (audioRef.current) audioRef.current.muted = next;
      return next;
    });
  }

  const cur = tracks[idx];
  if (!visible) return null;

  return (
    <>
      <audio ref={audioRef} onEnded={skip} onError={skip} />
      <div
        className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2.5 rounded-2xl border border-white/10 shadow-2xl"
        style={{ background: "rgba(8,8,20,0.88)", backdropFilter: "blur(20px)", minWidth: 280, maxWidth: 400 }}
      >
        <div className="flex items-end gap-[3px] h-5 shrink-0">
          {bars.map((h, i) => (
            <div
              key={i}
              className="w-[3px] rounded-full bg-indigo-400 transition-all duration-150"
              style={{ height: `${playing && phase === "music" ? h : 22}%` }}
            />
          ))}
        </div>

        <div className="flex-1 min-w-0">
          {phase === "intro" ? (
            <p className="text-xs font-semibold text-white truncate">🎙️ Chege Tech Radio</p>
          ) : phase === "music" && cur ? (
            <>
              <p className="text-xs font-semibold text-white truncate">{cur.title}</p>
              <p className="text-[10px] text-white/50 truncate">{cur.artist}</p>
            </>
          ) : (
            <>
              <p className="text-xs font-medium text-indigo-300">🎵 Chege Tech Radio</p>
              <p className="text-[10px] text-white/40">Tap ▶ to play</p>
            </>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={handlePlay}
            className="w-7 h-7 rounded-full flex items-center justify-center transition-colors"
            style={{ background: "rgba(99,102,241,0.9)" }}
          >
            {playing && phase !== "idle" ? (
              <Pause className="w-3.5 h-3.5 text-white" />
            ) : (
              <Play className="w-3.5 h-3.5 text-white ml-0.5" />
            )}
          </button>
          <button onClick={skip} className="w-6 h-6 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors">
            <SkipForward className="w-3 h-3 text-white/70" />
          </button>
          <button onClick={toggleMute} className="w-6 h-6 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors">
            {muted ? <VolumeX className="w-3 h-3 text-white/50" /> : <Volume2 className="w-3 h-3 text-white/70" />}
          </button>
          <button onClick={() => { audioRef.current?.pause(); setVisible(false); }} className="w-6 h-6 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors">
            <X className="w-3 h-3 text-white/40" />
          </button>
        </div>
      </div>
    </>
  );
}
