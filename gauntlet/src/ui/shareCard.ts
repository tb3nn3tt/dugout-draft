// Dependency-free shareable team card. Renders the drafted roster to a <canvas>
// (no html2canvas) and hands it to the Web Share API on mobile, or downloads it
// on desktop. On-brand with the app: clean paper-white "championship card",
// stitch-red accents, a record to brag about, and a built-in challenge.

export interface ShareRow { pos: string; name: string; grade: string; color: string }
export interface ShareSection { title: string; rows: ShareRow[] }

const C = {
  paper: '#f4f1ea', panel: '#ffffff', line: '#ddd7ca', lineBright: '#bcb5a3',
  ink: '#16130d', dim: '#6a6456', faint: '#a8a08d', accent: '#c8102e', cyan: '#0e7490',
};
const FB = 'Inter, system-ui, -apple-system, sans-serif';

function drawSection(ctx: CanvasRenderingContext2D, s: ShareSection, x: number, y: number, w: number, rowH: number): number {
  ctx.textAlign = 'left';
  ctx.fillStyle = C.cyan;
  ctx.font = `700 13px ${FB}`;
  ctx.fillText(s.title, x, y);
  let yy = y + 8;
  for (const r of s.rows) {
    yy += rowH;
    ctx.fillStyle = C.faint;
    ctx.font = `800 11px ${FB}`;
    ctx.fillText(r.pos, x, yy);
    ctx.fillStyle = C.ink;
    ctx.font = `700 16px ${FB}`;
    ctx.fillText(r.name, x + 34, yy, w - 58);
    ctx.fillStyle = r.color;
    ctx.font = `800 16px ${FB}`;
    ctx.textAlign = 'right';
    ctx.fillText(r.grade, x + w, yy);
    ctx.textAlign = 'left';
  }
  return yy + 16;
}

/** Build the share card canvas. `sections[0]` (lineup) gets the left column. */
export function buildShareCanvas(teamName: string, record: string, subtitle: string, sections: ShareSection[]): HTMLCanvasElement {
  const W = 640, H = 940, dpr = 2;
  const cv = document.createElement('canvas');
  cv.width = W * dpr; cv.height = H * dpr;
  const ctx = cv.getContext('2d')!;
  ctx.scale(dpr, dpr);
  ctx.textBaseline = 'alphabetic';

  // Paper + frame
  ctx.fillStyle = C.paper; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = C.panel; ctx.fillRect(10, 10, W - 20, H - 20);
  ctx.strokeStyle = C.lineBright; ctx.lineWidth = 1; ctx.strokeRect(10, 10, W - 20, H - 20);
  // Red championship top bar
  ctx.fillStyle = C.accent; ctx.fillRect(10, 10, W - 20, 6);

  // Header
  const hY = 16;
  ctx.fillStyle = 'rgba(200,16,46,0.06)'; ctx.fillRect(10, hY, W - 20, 86);
  ctx.fillStyle = C.ink; ctx.textAlign = 'left';
  ctx.font = `800 33px ${FB}`;
  ctx.fillText(`🏆 ${teamName}`.toUpperCase(), 28, hY + 46, W - 200);
  ctx.fillStyle = C.accent; ctx.textAlign = 'right';
  ctx.font = `800 46px ${FB}`;
  ctx.fillText(record, W - 26, hY + 50);
  ctx.fillStyle = C.dim; ctx.textAlign = 'left';
  ctx.font = `600 14px ${FB}`;
  ctx.fillText(subtitle, 28, hY + 72);
  ctx.strokeStyle = C.line; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(10, hY + 86); ctx.lineTo(W - 10, hY + 86); ctx.stroke();

  // Two columns: lineup left, the rest right
  const colW = (W - 28 * 2 - 24) / 2;
  const leftX = 28, rightX = 28 + colW + 24;
  const top = 150, rowH = 29;
  if (sections[0]) drawSection(ctx, sections[0], leftX, top, colW, rowH);
  let ry = top;
  for (const s of sections.slice(1)) ry = drawSection(ctx, s, rightX, ry, colW, rowH);

  // Challenge banner
  const bY = H - 96;
  ctx.fillStyle = C.accent; ctx.fillRect(10, bY, W - 20, 44);
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
  ctx.font = `800 20px ${FB}`;
  ctx.fillText(`⚔  CAN YOU BEAT ${record}?  ⚔`, W / 2, bY + 29);

  // Footer
  ctx.fillStyle = C.dim; ctx.textAlign = 'center';
  ctx.font = `700 13px ${FB}`;
  ctx.fillText('DUGOUT GAUNTLET  ·  tb3nn3tt.github.io/dugout-draft', W / 2, H - 26);
  ctx.textAlign = 'left';
  return cv;
}

/** Render + share (mobile) or download (desktop). Returns 'shared' | 'saved'. */
export async function shareTeamImage(teamName: string, record: string, subtitle: string, sections: ShareSection[]): Promise<'shared' | 'saved'> {
  try { await (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts?.ready; } catch { /* fonts optional */ }
  const cv = buildShareCanvas(teamName, record, subtitle, sections);
  const blob: Blob | null = await new Promise(res => cv.toBlob(res, 'image/png'));
  if (!blob) return 'saved';
  const file = new File([blob], 'dugout-gauntlet.png', { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (d: unknown) => boolean; share?: (d: unknown) => Promise<void> };
  if (nav.canShare && nav.share && nav.canShare({ files: [file] })) {
    try {
      await nav.share({ files: [file], text: `My ${teamName} went ${record} in Dugout Gauntlet ⚾ Can you beat it? tb3nn3tt.github.io/dugout-draft` });
      return 'shared';
    } catch { /* user cancelled or unsupported → fall through to download */ }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'dugout-gauntlet.png';
  a.click();
  URL.revokeObjectURL(url);
  return 'saved';
}
