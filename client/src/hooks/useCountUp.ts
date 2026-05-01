import { useState, useEffect, useRef } from 'react';

export function useCountUp(
  target: number,
  durationMs: number = 1800,
  delayMs: number = 0,
  startOnMount = true,
) {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!startOnMount) return;
    let timer: ReturnType<typeof setTimeout> | null = null;

    timer = setTimeout(() => {
      const startTime = performance.now();
      const tick = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / durationMs, 1);
        const eased = 1 - Math.pow(1 - progress, 3); // ease out cubic
        setValue(Math.floor(eased * target));
        if (progress < 1) rafRef.current = requestAnimationFrame(tick);
        else setValue(target);
      };
      rafRef.current = requestAnimationFrame(tick);
    }, delayMs);

    return () => {
      if (timer) clearTimeout(timer);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, durationMs, delayMs, startOnMount]);

  return value;
}

export function formatCount(n: number, suffix = ''): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K${suffix}`;
  return `${n}${suffix}`;
}
