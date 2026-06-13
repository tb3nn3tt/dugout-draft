// Dependency-free shareable team card. Renders the drafted roster to a <canvas>
// (no html2canvas) and hands it to the Web Share API on mobile, or downloads it
// on desktop. On-brand: night-game navy, infield-amber header, cyan section
// labels, tier-colored grades.

export interface ShareRow { pos: string; name: string; grade: string; color: string }
export interface ShareSection { title: string; rows: ShareRow[] }

const C = {
  bgTop: '#13243d', bgBot: '#070f1c', line: '#34527a', faint: '#56678a',
  ink: '#ecf3ff', dim: '#8194b3', amber: '#ffb224', cyan: '#2fe3ff',
};

function drawSection(ctx: CanvasRenderingContext2D, s: ShareSection, x: number, y: number, w: number, rowH: number): number {
  ctx.textAlign = 'left';
  ctx.fillStyle = C.cyan;
  ctx.font = '600 15px Oswald, "Arial Narrow", sans-serif';
  ctx.fillText(s.title, x, y);
  let yy = y + 10;
  for (const r of s.rows) {
    yy += rowH;
    ctx.fillStyle = C.faint;
    ctx.font = '800 12px Barlow, sans-serif';
    ctx.fillText(r.pos, x, yy);
    ctx.fillStyle = C.ink;
    ctx.font = '600 17px Oswald, "Arial Narrow", sans-serif';
    ctx.fillText(r.name, x + 34, yy, w - 60);
    ctx.fillStyle = r.color;
    ctx.font = '700 17px Barlow, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(r.grade, x + w, yy);
    ctx.textAlign = 'left';
  }
  return yy + 14;
}

/** Build the share card canvas. `sections[0]` (lineup) gets the left column. */
export function buildShareCanvas(teamName: string, record: string, subtitle: string, sections: ShareSection[]): HTMLCanvasElement {
  const W = 640, H = 940, dpr = 2;
  const cv = document.createElement('canvas');
  cv.width = W * dpr; cv.height = H * dpr;
  const ctx = cv.getContext('2d')!;
  ctx.scale(dpr, dpr);

  // Background + frame
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, C.bgTop); g.addColorStop(1, C.bgBot);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = C.line; ctx.lineWidth = 2; ctx.strokeRect(7, 7, W - 14, H - 14);

  // Header band
  ctx.fillStyle = 'rgba(255,178,36,0.13)'; ctx.fillRect(7, 7, W - 14, 92);
  ctx.fillStyle = C.amber; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(7, 99); ctx.lineTo(W - 7, 99); ctx.strokeStyle = C.amber; ctx.stroke();
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.ink; ctx.textAlign = 'left';
  ctx.font = '600 34px Oswald, "Arial Narrow", sans-serif';
  ctx.fillText(teamName.toUpperCase(), 26, 58, W - 190);
  ctx.fillStyle = C.amber; ctx.textAlign = 'right';
  ctx.font = '700 42px Oswald, "Arial Narrow", sans-serif';
  ctx.fillText(record, W - 26, 62);
  ctx.fillStyle = C.dim; ctx.textAlign = 'left';
  ctx.font = '600 14px Barlow, sans-serif';
  ctx.fillText(subtitle, 26, 84);

  // Two columns: lineup left, the rest right
  const colW = (W - 26 * 2 - 24) / 2;
  const leftX = 26, rightX = 26 + colW + 24;
  const top = 132, rowH = 30;
  if (sections[0]) drawSection(ctx, sections[0], leftX, top, colW, rowH);
  let ry = top;
  for (const s of sections.slice(1)) ry = drawSection(ctx, s, rightX, ry, colW, rowH);

  // Footer
  ctx.fillStyle = C.faint; ctx.textAlign = 'center';
  ctx.font = '600 13px Oswald, "Arial Narrow", sans-serif';
  ctx.fillText('⚾  DUGOUT GAUNTLET  ·  tb3nn3tt.github.io/dugout-draft', W / 2, H - 22);
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
      await nav.share({ files: [file], text: `${teamName} went ${record} in Dugout Gauntlet! ⚾` });
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
