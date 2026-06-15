import { useRef, useState, useLayoutEffect } from 'react';
import { abbrevName } from '../domain/sim/helpers';

const cleanName = (n: string) => n.replace(/\s*\([^)]*\)\s*$/, '').trim() || n;

/**
 * Shows the player's FULL name when it fits the available width; otherwise
 * falls back to the abbreviated "F. Last '97" form (never a mid-word ellipsis).
 * Measures its own box after layout and downgrades only if the full name
 * overflows. The host element should be a constrained, overflow-hidden box.
 */
export function FitName({ name, className }: { name: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [abbrev, setAbbrev] = useState(false);

  // New name → optimistically try the full version again.
  useLayoutEffect(() => { setAbbrev(false); }, [name]);
  // If the full name overflows its box, drop to the abbreviated form.
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && !abbrev && el.scrollWidth > el.clientWidth + 1) setAbbrev(true);
  });

  return <span ref={ref} className={className}>{abbrev ? abbrevName(name) : cleanName(name)}</span>;
}
