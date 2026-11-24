import React, { useEffect, useRef } from 'react';
import { normalizeFlagCode } from '../utils/formatters';

function drawRegularStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  points: number,
  outerR: number,
  innerR: number,
  color: string,
  rotationOffset = -Math.PI / 2
) {
  ctx.save();
  ctx.beginPath();
  const totalSteps = points * 2;
  for (let i = 0; i < totalSteps; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = (i * Math.PI) / points + rotationOffset;
    const px = cx + Math.cos(angle) * r;
    const py = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

function drawFivePointStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  color: string
) {
  drawRegularStar(ctx, cx, cy, 5, outerR, innerR, color, -Math.PI / 2);
}

function drawEightPointStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  outerR: number,
  color: string
) {
  // Authentic Ottoman 8-pointed star (Sekiz Köşeli Yıldız / Rub el Hizb silhouette)
  drawRegularStar(ctx, cx, cy, 8, outerR, outerR * 0.44, color, -Math.PI / 8);
}

function drawStarOfDavid(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  color: string
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(0.85, r * 0.19);
  ctx.lineJoin = 'miter';
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const a = (i * 2 * Math.PI) / 3 + (dir === 1 ? -Math.PI / 2 : Math.PI / 2);
      const px = cx + Math.cos(a) * r;
      const py = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
  }
  ctx.restore();
}

function drawCrescentAndStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  fgColor: string,
  bgColor: string,
  starPoints: 5 | 8 = 5
) {
  ctx.save();
  // Outer lunar disc
  ctx.beginPath();
  ctx.arc(cx - r * 0.16, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = fgColor;
  ctx.fill();

  // Inner cutout shifted right to form a crisp crescent horn
  ctx.beginPath();
  ctx.arc(cx + r * 0.14, cy, r * 0.79, 0, Math.PI * 2);
  ctx.fillStyle = bgColor;
  ctx.fill();

  // Paired star inside crescent opening
  if (starPoints === 8) {
    drawEightPointStar(ctx, cx + r * 0.66, cy, r * 0.44, fgColor);
  } else {
    drawFivePointStar(ctx, cx + r * 0.64, cy, r * 0.42, r * 0.17, fgColor);
  }
  ctx.restore();
}

function drawHorizontalTricolor(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  c1: string,
  c2: string,
  c3: string
) {
  ctx.fillStyle = c1;
  ctx.fillRect(x, y, w, h / 3);
  ctx.fillStyle = c2;
  ctx.fillRect(x, y + h / 3, w, h / 3);
  ctx.fillStyle = c3;
  ctx.fillRect(x, y + (2 * h) / 3, w, h / 3);
}

function drawVerticalTricolor(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  c1: string,
  c2: string,
  c3: string
) {
  ctx.fillStyle = c1;
  ctx.fillRect(x, y, w / 3, h);
  ctx.fillStyle = c2;
  ctx.fillRect(x + w / 3, y, w / 3, h);
  ctx.fillStyle = c3;
  ctx.fillRect(x + (2 * w) / 3, y, w / 3, h);
}

function drawUnionJackCanton(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const minDim = Math.min(w, h);
  ctx.fillStyle = '#012169';
  ctx.fillRect(x, y, w, h);

  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = Math.max(1.2, minDim * 0.16);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y + h);
  ctx.moveTo(x + w, y);
  ctx.lineTo(x, y + h);
  ctx.stroke();

  ctx.strokeStyle = '#C8102E';
  ctx.lineWidth = Math.max(0.7, minDim * 0.08);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y + h);
  ctx.moveTo(x + w, y);
  ctx.lineTo(x, y + h);
  ctx.stroke();

  const cx = x + w / 2;
  const cy = y + h / 2;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(cx - w * 0.14, y, w * 0.28, h);
  ctx.fillRect(x, cy - h * 0.18, w, h * 0.36);
  ctx.fillStyle = '#C8102E';
  ctx.fillRect(cx - w * 0.08, y, w * 0.16, h);
  ctx.fillRect(x, cy - h * 0.1, w, h * 0.2);
}

/**
 * Draws an authentic graphical flag for any nation, formable empire, or 1440 historical realm on a 2D Canvas.
 */
export function drawNationFlagOnCanvas(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  nationId: string,
  flagCode: string,
  baseColor: string
): void {
  const code = normalizeFlagCode(flagCode);
  const baseId = (nationId || '').split('_')[0];

  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  const cx = x + w / 2;
  const cy = y + h / 2;
  const minDim = Math.min(w, h);

  // 1. OSMANLI DEVLETİ (OSM) & TÜRKİYE (TR / 792)
  if (code === 'OSM' || code === 'TR' || baseId === '792') {
    const bg = '#E30A17';
    ctx.fillStyle = bg;
    ctx.fillRect(x, y, w, h);
    const isOttoman = code === 'OSM';
    drawCrescentAndStar(
      ctx,
      cx - w * 0.03,
      cy,
      minDim * 0.32,
      '#FFFFFF',
      bg,
      isOttoman ? 8 : 5
    );
  }
  // 2. KURULABİLİR İMPARATORLUKLAR (Formable Empires)
  else if (code === 'TRN') {
    // Büyük Turan Hakanlığı
    ctx.fillStyle = '#0284C7';
    ctx.fillRect(x, y, w, h);
    drawCrescentAndStar(ctx, cx, cy, minDim * 0.3, '#F8FAFC', '#0284C7', 8);
  } else if (code === 'IMP') {
    // Kayser-i Rum & Doğu Akdeniz İmparatorluğu
    ctx.fillStyle = '#991B1B';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#FBBF24';
    ctx.fillRect(cx - w * 0.08, y, w * 0.16, h);
    ctx.fillRect(x, cy - h * 0.11, w, h * 0.22);
    drawEightPointStar(ctx, cx, cy, minDim * 0.24, '#FFFBEB');
  } else if (code === 'EUF') {
    // Birleşik Avrupa İmparatorluğu
    ctx.fillStyle = '#003399';
    ctx.fillRect(x, y, w, h);
    const ringR = minDim * 0.28;
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI * 2) / 12 - Math.PI / 2;
      drawFivePointStar(
        ctx,
        cx + Math.cos(a) * ringR,
        cy + Math.sin(a) * ringR,
        minDim * 0.07,
        minDim * 0.03,
        '#FFCC00'
      );
    }
  } else if (code === 'HEG') {
    // Nizam-ı Alem & Cihan İmparatorluğu
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(x, y, w, h);
    drawEightPointStar(ctx, cx, cy, minDim * 0.31, '#FBBF24');
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.arc(cx, cy, minDim * 0.11, 0, Math.PI * 2);
    ctx.fill();
  }
  // 3. BİZANS (BIZ) & YUNANİSTAN (300, GR)
  else if (code === 'BIZ') {
    // Palaiologos Imperial Banner: Crimson/Tyrian field + Golden Cross + 4 Gold Symmetrical B Crests
    ctx.fillStyle = '#881337';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#FBBF24';
    ctx.fillRect(cx - w * 0.08, y, w * 0.16, h);
    ctx.fillRect(x, cy - h * 0.11, w, h * 0.22);
    const qx = w * 0.27;
    const qy = h * 0.26;
    const arcR = Math.max(1.4, minDim * 0.1);
    ctx.strokeStyle = '#FDE047';
    ctx.lineWidth = Math.max(0.9, minDim * 0.07);
    [
      [cx - qx, cy - qy, true],
      [cx + qx, cy - qy, false],
      [cx - qx, cy + qy, true],
      [cx + qx, cy + qy, false],
    ].forEach(([px, py, flip]) => {
      const startA = flip ? -Math.PI * 0.5 : Math.PI * 0.5;
      const endA = flip ? Math.PI * 0.5 : Math.PI * 1.5;
      ctx.beginPath();
      ctx.arc(Number(px), Number(py) - arcR * 0.45, arcR * 0.6, startA, endA);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(Number(px), Number(py) + arcR * 0.45, arcR * 0.6, startA, endA);
      ctx.stroke();
    });
  } else if (baseId === '300' || code === 'GR') {
    ctx.fillStyle = '#0D5EAF';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#FFFFFF';
    for (let s = 1; s < 9; s += 2) {
      ctx.fillRect(x, y + (s * h) / 9, w, h / 9);
    }
    ctx.fillStyle = '#0D5EAF';
    ctx.fillRect(x, y, w * 0.42, (5 * h) / 9);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(x + w * 0.17, y, w * 0.08, (5 * h) / 9);
    ctx.fillRect(x, y + (2 * h) / 9, w * 0.42, h / 9);
  }
  // 4. AZERBAYCAN (AZ / 031) & KARAKOYUNLU / AKKOYUNLU (AKK)
  else if (code === 'AKK') {
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#E2E8F0';
    ctx.fillRect(x, y + h * 0.14, w, h * 0.12);
    drawCrescentAndStar(ctx, cx, cy + h * 0.05, minDim * 0.27, '#F8FAFC', '#0F172A', 8);
  } else if (baseId === '031' || code === 'AZ') {
    drawHorizontalTricolor(ctx, x, y, w, h, '#00B5E2', '#EF3340', '#509E2F');
    drawCrescentAndStar(ctx, cx, cy, minDim * 0.2, '#FFFFFF', '#EF3340', 8);
  }
  // 5. MEMLÜK SULTANLIĞI (MEM) & MISIR / SURİYE / IRAK
  else if (code === 'MEM') {
    ctx.fillStyle = '#CA8A04';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#78350F';
    ctx.fillRect(x, y, w * 0.16, h);
    drawCrescentAndStar(ctx, cx + w * 0.04, cy, minDim * 0.28, '#FFFFFF', '#CA8A04', 5);
  } else if (baseId === '760' || code === 'SY') {
    drawHorizontalTricolor(ctx, x, y, w, h, '#CE1126', '#FFFFFF', '#000000');
    drawFivePointStar(ctx, cx - w * 0.16, cy, minDim * 0.11, minDim * 0.045, '#007A3D');
    drawFivePointStar(ctx, cx + w * 0.16, cy, minDim * 0.11, minDim * 0.045, '#007A3D');
  } else if (baseId === '368' || code === 'IQ') {
    drawHorizontalTricolor(ctx, x, y, w, h, '#CE1126', '#FFFFFF', '#000000');
    ctx.fillStyle = '#007A3D';
    ctx.fillRect(cx - w * 0.18, cy - h * 0.05, w * 0.36, h * 0.1);
  } else if (baseId === '818' || code === 'EG') {
    drawHorizontalTricolor(ctx, x, y, w, h, '#CE1126', '#FFFFFF', '#000000');
    drawFivePointStar(ctx, cx, cy, minDim * 0.13, minDim * 0.06, '#C09300');
  }
  // 6. TİMUR İMPARATORLUĞU (TIM) & İRAN (364, IR)
  else if (code === 'TIM') {
    // Authentic Black Silk Timurid Banner with 3 Golden Çintemani circles
    ctx.fillStyle = '#141418';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#FACC15';
    const r = minDim * 0.13;
    [
      [cx, cy - h * 0.18],
      [cx - w * 0.15, cy + h * 0.16],
      [cx + w * 0.15, cy + h * 0.16],
    ].forEach(([px, py]) => {
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
    });
  } else if (baseId === '364' || code === 'IR') {
    drawHorizontalTricolor(ctx, x, y, w, h, '#239F40', '#FFFFFF', '#DA0000');
    // Stylized Red Emblem Silhouette
    ctx.strokeStyle = '#DA0000';
    ctx.lineWidth = Math.max(0.9, minDim * 0.08);
    ctx.beginPath();
    ctx.arc(cx, cy, minDim * 0.11, 0.25 * Math.PI, 0.75 * Math.PI, true);
    ctx.stroke();
    ctx.fillStyle = '#DA0000';
    ctx.fillRect(cx - w * 0.025, cy - h * 0.11, w * 0.05, h * 0.22);
  }
  // 7. ALTIN ORDA (ORD) & RUSYA (643, RU)
  else if (code === 'ORD') {
    ctx.fillStyle = '#991B1B';
    ctx.fillRect(x, y, w, h);
    drawCrescentAndStar(ctx, cx, cy, minDim * 0.29, '#FACC15', '#991B1B', 8);
  } else if (baseId === '643' || code === 'RU') {
    drawHorizontalTricolor(ctx, x, y, w, h, '#FFFFFF', '#0039A6', '#D52B1E');
  }
  // 8. KUTSAL ROMA (KRI) & ALMANYA (276, DE) & AVUSTURYA (040, AT) & BELÇİKA (056, BE)
  else if (code === 'KRI') {
    ctx.fillStyle = '#FACC15';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#0F172A';
    // Stylized Imperial Eagle silhouette
    ctx.beginPath();
    ctx.arc(cx, cy - h * 0.06, minDim * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.3, cy - h * 0.12);
    ctx.lineTo(cx + w * 0.3, cy - h * 0.12);
    ctx.lineTo(cx, cy + h * 0.26);
    ctx.closePath();
    ctx.fill();
  } else if (baseId === '276' || code === 'DE') {
    drawHorizontalTricolor(ctx, x, y, w, h, '#000000', '#DD0000', '#FFCE00');
  } else if (baseId === '040' || code === 'AT') {
    drawHorizontalTricolor(ctx, x, y, w, h, '#ED2939', '#FFFFFF', '#ED2939');
  } else if (baseId === '056' || code === 'BE') {
    drawVerticalTricolor(ctx, x, y, w, h, '#000000', '#FDDA24', '#EF3340');
  }
  // 9. MACARİSTAN (MAC/348/HU), BULGARİSTAN (100/BG), HOLLANDA (528/NL), ROMANYA (642/RO)
  else if (baseId === '348' || code === 'MAC' || code === 'HU') {
    drawHorizontalTricolor(ctx, x, y, w, h, '#CD2A3E', '#FFFFFF', '#436F4D');
    if (code === 'MAC') {
      ctx.fillStyle = '#FACC15';
      ctx.fillRect(cx - w * 0.03, y + h * 0.18, w * 0.06, h * 0.64);
      ctx.fillRect(cx - w * 0.11, y + h * 0.36, w * 0.22, h * 0.1);
    }
  } else if (baseId === '100' || code === 'BG') {
    drawHorizontalTricolor(ctx, x, y, w, h, '#FFFFFF', '#00966E', '#D62612');
  } else if (baseId === '528' || code === 'NL') {
    drawHorizontalTricolor(ctx, x, y, w, h, '#AE1C28', '#FFFFFF', '#21468B');
  } else if (baseId === '642' || code === 'RO') {
    drawVerticalTricolor(ctx, x, y, w, h, '#002B7F', '#FCD116', '#CE1126');
  }
  // 10. FRANSA (250, FRA, FR) & İRLANDA (372, IE)
  else if (code === 'FRA') {
    ctx.fillStyle = '#1E3A8A';
    ctx.fillRect(x, y, w, h);
    drawFivePointStar(ctx, cx - w * 0.2, cy - h * 0.15, minDim * 0.14, minDim * 0.06, '#FACC15');
    drawFivePointStar(ctx, cx + w * 0.2, cy - h * 0.15, minDim * 0.14, minDim * 0.06, '#FACC15');
    drawFivePointStar(ctx, cx, cy + h * 0.18, minDim * 0.14, minDim * 0.06, '#FACC15');
  } else if (baseId === '250' || code === 'FR') {
    drawVerticalTricolor(ctx, x, y, w, h, '#002654', '#FFFFFF', '#ED2939');
  } else if (baseId === '372' || code === 'IE') {
    drawVerticalTricolor(ctx, x, y, w, h, '#169B62', '#FFFFFF', '#FF883E');
  }
  // 11. VENEDİK (VEN) & İTALYA (380, IT) & İSVİÇRE (756, CH)
  else if (code === 'VEN') {
    ctx.fillStyle = '#B91C1C';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#FACC15';
    ctx.fillRect(x + w * 0.08, y + h * 0.12, w * 0.28, h * 0.76);
    ctx.fillStyle = '#7C2D12';
    ctx.fillRect(x + w * 0.14, cy - h * 0.12, w * 0.16, h * 0.24);
  } else if (baseId === '380' || code === 'IT') {
    drawVerticalTricolor(ctx, x, y, w, h, '#009246', '#FFFFFF', '#CE2B37');
  } else if (baseId === '756' || code === 'CH') {
    ctx.fillStyle = '#FF0000';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(cx - minDim * 0.1, cy - minDim * 0.3, minDim * 0.2, minDim * 0.6);
    ctx.fillRect(cx - minDim * 0.3, cy - minDim * 0.1, minDim * 0.6, minDim * 0.2);
  }
  // 12. İNGİLTERE / BİRLEŞİK KRALLIK (826, ING, GB)
  else if (baseId === '826' || code === 'ING' || code === 'GB') {
    if (code === 'ING') {
      // St George's Cross (1440 Kingdom of England)
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#CE1124';
      ctx.fillRect(cx - w * 0.09, y, w * 0.18, h);
      ctx.fillRect(x, cy - h * 0.12, w, h * 0.24);
    } else {
      drawUnionJackCanton(ctx, x, y, w, h);
    }
  }
  // 13. KASTİLYA-ARAGON (KAS) & İSPANYA (724, ES) & PORTEKİZ (620, PT)
  else if (code === 'KAS') {
    // Castile-Leon-Aragon Quartered Banner
    ctx.fillStyle = '#AA151B';
    ctx.fillRect(x, y, w / 2, h / 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(cx, y, w / 2, h / 2);
    ctx.fillRect(x, cy, w / 2, h / 2);
    ctx.fillStyle = '#FACC15';
    ctx.fillRect(cx, cy, w / 2, h / 2);
    // Aragon Crimson Vertical Bars in bottom-right quarter
    ctx.fillStyle = '#AA151B';
    ctx.fillRect(cx + w * 0.12, cy, w * 0.08, h / 2);
    ctx.fillRect(cx + w * 0.3, cy, w * 0.08, h / 2);
    // Castile golden castle dot in top-left quarter
    ctx.fillStyle = '#FACC15';
    ctx.fillRect(x + w * 0.17, y + h * 0.14, w * 0.16, h * 0.22);
  } else if (baseId === '724' || code === 'ES') {
    ctx.fillStyle = '#AA151B';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#F1BF00';
    ctx.fillRect(x, y + h * 0.25, w, h * 0.5);
    ctx.fillStyle = '#AA151B';
    ctx.fillRect(x + w * 0.22, cy - h * 0.12, w * 0.13, h * 0.24);
  } else if (baseId === '620' || code === 'PT') {
    ctx.fillStyle = '#046A38';
    ctx.fillRect(x, y, w * 0.4, h);
    ctx.fillStyle = '#DA291C';
    ctx.fillRect(x + w * 0.4, y, w * 0.6, h);
    ctx.fillStyle = '#FFE900';
    ctx.beginPath();
    ctx.arc(x + w * 0.4, cy, minDim * 0.2, 0, Math.PI * 2);
    ctx.fill();
  }
  // 14. LEHİSTAN-LİTVANYA (LEH) & POLONYA (616, PL)
  else if (code === 'LEH') {
    // Polish-Lithuanian Red-White-Red Chorągiew banner with centered golden royal escutcheon
    drawHorizontalTricolor(ctx, x, y, w, h, '#DC143C', '#FFFFFF', '#DC143C');
    ctx.fillStyle = '#B91C1C';
    ctx.fillRect(cx - w * 0.12, cy - h * 0.18, w * 0.24, h * 0.36);
    ctx.strokeStyle = '#FACC15';
    ctx.lineWidth = Math.max(0.8, minDim * 0.07);
    ctx.strokeRect(cx - w * 0.12, cy - h * 0.18, w * 0.24, h * 0.36);
  } else if (baseId === '616' || code === 'PL') {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(x, y, w, h / 2);
    ctx.fillStyle = '#DC143C';
    ctx.fillRect(x, y + h / 2, w, h / 2);
  }
  // 15. UKRAYNA (804, UA), KAZAKİSTAN (398, KZ), BELARUS (112, BY), ÇEKYA (203, CZ)
  else if (baseId === '804' || code === 'UA') {
    ctx.fillStyle = '#0057B7';
    ctx.fillRect(x, y, w, h / 2);
    ctx.fillStyle = '#FFD700';
    ctx.fillRect(x, y + h / 2, w, h / 2);
  } else if (baseId === '398' || code === 'KZ') {
    ctx.fillStyle = '#00AFCA';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#FEC50C';
    ctx.fillRect(x + w * 0.07, y, w * 0.06, h);
    ctx.beginPath();
    ctx.arc(cx + w * 0.04, cy, minDim * 0.21, 0, Math.PI * 2);
    ctx.fill();
  } else if (baseId === '112' || code === 'BY') {
    ctx.fillStyle = '#D22730';
    ctx.fillRect(x, y, w, h * 0.67);
    ctx.fillStyle = '#009739';
    ctx.fillRect(x, y + h * 0.67, w, h * 0.33);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(x, y, w * 0.14, h);
  } else if (baseId === '203' || code === 'CZ') {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(x, y, w, h / 2);
    ctx.fillStyle = '#D7141A';
    ctx.fillRect(x, y + h / 2, w, h / 2);
    ctx.fillStyle = '#11457E';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(cx, cy);
    ctx.lineTo(x, y + h);
    ctx.closePath();
    ctx.fill();
  }
  // 16. İSKANDİNAVYA / KALMAR BİRLİĞİ (752, 578, 208, 246, 352, KAL, SE, NO)
  else if (
    baseId === '752' ||
    baseId === '578' ||
    baseId === '208' ||
    baseId === '246' ||
    baseId === '352' ||
    code === 'KAL' ||
    code === 'SE' ||
    code === 'NO'
  ) {
    const bg =
      code === 'KAL'
        ? '#FACC15'
        : baseId === '578' || code === 'NO' || baseId === '208'
        ? '#BA0C2F'
        : baseId === '352'
        ? '#02529C'
        : baseId === '246'
        ? '#FFFFFF'
        : '#006AA7';
    const cross =
      code === 'KAL'
        ? '#DC2626'
        : baseId === '578' || code === 'NO' || baseId === '246'
        ? '#00205B'
        : baseId === '352'
        ? '#DC1E35'
        : baseId === '208'
        ? '#FFFFFF'
        : '#FECC02';
    ctx.fillStyle = bg;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = cross;
    ctx.fillRect(x + w * 0.28, y, w * 0.14, h);
    ctx.fillRect(x, cy - h * 0.1, w, h * 0.2);
  }
  // 17. KUZEY & GÜNEY AMERİKA (US, CA, MX, AR, CL, CO, PE, BR, AZT, INK)
  else if (baseId === '840' || code === 'US') {
    ctx.fillStyle = '#B22234';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#FFFFFF';
    for (let i = 1; i < 6; i += 2) {
      ctx.fillRect(x, y + (i * h) / 6, w, h / 6);
    }
    ctx.fillStyle = '#3C3B6E';
    ctx.fillRect(x, y, w * 0.48, h * 0.55);
    drawFivePointStar(ctx, x + w * 0.24, y + h * 0.27, minDim * 0.16, minDim * 0.07, '#FFFFFF');
  } else if (baseId === '124' || code === 'CA') {
    drawVerticalTricolor(ctx, x, y, w, h, '#D80621', '#FFFFFF', '#D80621');
    // Maple leaf diamond-star silhouette
    drawRegularStar(ctx, cx, cy, 7, minDim * 0.26, minDim * 0.11, '#D80621', -Math.PI / 2);
  } else if (code === 'AZT') {
    ctx.fillStyle = '#0F766E';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#DC2626';
    ctx.fillRect(x, y, w, h * 0.16);
    ctx.fillRect(x, y + h * 0.84, w, h * 0.16);
    drawEightPointStar(ctx, cx, cy, minDim * 0.27, '#FACC15');
  } else if (baseId === '484' || code === 'MX') {
    drawVerticalTricolor(ctx, x, y, w, h, '#006847', '#FFFFFF', '#CE1126');
    ctx.fillStyle = '#78350F';
    ctx.beginPath();
    ctx.arc(cx, cy, minDim * 0.13, 0, Math.PI * 2);
    ctx.fill();
  } else if (baseId === '032' || code === 'AR') {
    drawHorizontalTricolor(ctx, x, y, w, h, '#74ACDF', '#FFFFFF', '#74ACDF');
    drawEightPointStar(ctx, cx, cy, minDim * 0.15, '#F6B40E');
  } else if (baseId === '152' || code === 'CL') {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(x, y, w, h / 2);
    ctx.fillStyle = '#D52B1E';
    ctx.fillRect(x, y + h / 2, w, h / 2);
    ctx.fillStyle = '#0039A6';
    ctx.fillRect(x, y, w * 0.36, h / 2);
    drawFivePointStar(ctx, x + w * 0.18, y + h * 0.25, minDim * 0.13, minDim * 0.055, '#FFFFFF');
  } else if (baseId === '170' || code === 'CO') {
    ctx.fillStyle = '#FCD116';
    ctx.fillRect(x, y, w, h * 0.5);
    ctx.fillStyle = '#003893';
    ctx.fillRect(x, y + h * 0.5, w, h * 0.25);
    ctx.fillStyle = '#CE1126';
    ctx.fillRect(x, y + h * 0.75, w, h * 0.25);
  } else if (baseId === '604' || code === 'PE') {
    drawVerticalTricolor(ctx, x, y, w, h, '#D91023', '#FFFFFF', '#D91023');
  } else if (code === 'INK') {
    // Inka Tawantinsuyu Rainbow Solar Standard
    const stripes = ['#DC2626', '#F97316', '#FACC15', '#22C55E', '#38BDF8', '#6366F1'];
    stripes.forEach((col, i) => {
      ctx.fillStyle = col;
      ctx.fillRect(x, y + (i * h) / stripes.length, w, h / stripes.length + 0.5);
    });
    ctx.fillStyle = '#FEF08A';
    ctx.beginPath();
    ctx.arc(cx, cy, minDim * 0.2, 0, Math.PI * 2);
    ctx.fill();
  } else if (baseId === '076' || code === 'BR') {
    ctx.fillStyle = '#009739';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#FEDD00';
    ctx.beginPath();
    ctx.moveTo(cx, y + h * 0.12);
    ctx.lineTo(x + w * 0.88, cy);
    ctx.lineTo(cx, y + h * 0.88);
    ctx.lineTo(x + w * 0.12, cy);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#012169';
    ctx.beginPath();
    ctx.arc(cx, cy, minDim * 0.16, 0, Math.PI * 2);
    ctx.fill();
  }
  // 18. DOĞU & GÜNEYDOĞU ASYA + OKYANUSYA (MIN, CN, SOG, JP, KR, KP, MAJ, ID, VN, TH, MY, PH, AU, NZ)
  else if (baseId === '156' || code === 'MIN' || code === 'CN') {
    ctx.fillStyle = '#DE2910';
    ctx.fillRect(x, y, w, h);
    if (code === 'MIN') {
      ctx.fillStyle = '#FACC15';
      ctx.beginPath();
      ctx.arc(cx, cy, minDim * 0.25, 0, Math.PI * 2);
      ctx.fill();
    } else {
      drawFivePointStar(ctx, x + w * 0.24, y + h * 0.34, minDim * 0.2, minDim * 0.08, '#FFDE00');
    }
  } else if (baseId === '392' || code === 'SOG' || code === 'JP') {
    ctx.fillStyle = code === 'SOG' ? '#FEF3C7' : '#FFFFFF';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#BC002D';
    ctx.beginPath();
    ctx.arc(cx, cy, minDim * 0.27, 0, Math.PI * 2);
    ctx.fill();
  } else if (baseId === '410' || code === 'KR') {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(x, y, w, h);
    // Taegeuk
    ctx.fillStyle = '#CD2E3A';
    ctx.beginPath();
    ctx.arc(cx, cy, minDim * 0.24, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#0047A0';
    ctx.beginPath();
    ctx.arc(cx, cy, minDim * 0.24, 0, Math.PI);
    ctx.fill();
    // Black corner trigrams
    ctx.fillStyle = '#0F172A';
    const bx = w * 0.28;
    const by = h * 0.26;
    ctx.fillRect(cx - bx - 2, cy - by - 1, 5, 2.2);
    ctx.fillRect(cx + bx - 3, cy - by - 1, 5, 2.2);
    ctx.fillRect(cx - bx - 2, cy + by - 1, 5, 2.2);
    ctx.fillRect(cx + bx - 3, cy + by - 1, 5, 2.2);
  } else if (baseId === '408' || code === 'KP') {
    ctx.fillStyle = '#024FA2';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(x, y + h * 0.18, w, h * 0.64);
    ctx.fillStyle = '#ED1C27';
    ctx.fillRect(x, y + h * 0.24, w, h * 0.52);
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(x + w * 0.34, cy, minDim * 0.2, 0, Math.PI * 2);
    ctx.fill();
    drawFivePointStar(ctx, x + w * 0.34, cy, minDim * 0.16, minDim * 0.065, '#ED1C27');
  } else if (code === 'MAJ') {
    // Majapahit 7 red-and-white stripes
    for (let i = 0; i < 7; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#CE1126' : '#FFFFFF';
      ctx.fillRect(x, y + (i * h) / 7, w, h / 7 + 0.4);
    }
  } else if (baseId === '360' || code === 'ID') {
    ctx.fillStyle = '#FF0000';
    ctx.fillRect(x, y, w, h / 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(x, y + h / 2, w, h / 2);
  } else if (baseId === '704' || code === 'VN') {
    ctx.fillStyle = '#DA251D';
    ctx.fillRect(x, y, w, h);
    drawFivePointStar(ctx, cx, cy, minDim * 0.28, minDim * 0.11, '#FFFF00');
  } else if (baseId === '764' || code === 'TH') {
    ctx.fillStyle = '#A51931';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#F4F5F8';
    ctx.fillRect(x, y + h * 0.18, w, h * 0.64);
    ctx.fillStyle = '#2D2A4A';
    ctx.fillRect(x, y + h * 0.34, w, h * 0.32);
  } else if (baseId === '458' || code === 'MY') {
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#CC0001' : '#FFFFFF';
      ctx.fillRect(x, y + (i * h) / 6, w, h / 6 + 0.4);
    }
    ctx.fillStyle = '#010066';
    ctx.fillRect(x, y, w * 0.5, h * 0.55);
    drawCrescentAndStar(ctx, x + w * 0.24, y + h * 0.28, minDim * 0.18, '#FFCC00', '#010066', 8);
  } else if (baseId === '608' || code === 'PH') {
    ctx.fillStyle = '#0038A8';
    ctx.fillRect(x, y, w, h / 2);
    ctx.fillStyle = '#CE1126';
    ctx.fillRect(x, y + h / 2, w, h / 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w * 0.45, cy);
    ctx.lineTo(x, y + h);
    ctx.closePath();
    ctx.fill();
    drawEightPointStar(ctx, x + w * 0.17, cy, minDim * 0.14, '#FCD116');
  } else if (baseId === '036' || code === 'AU' || baseId === '554' || code === 'NZ') {
    ctx.fillStyle = '#012169';
    ctx.fillRect(x, y, w, h);
    drawUnionJackCanton(ctx, x, y, w * 0.48, h * 0.52);
    const starCol = baseId === '554' || code === 'NZ' ? '#C8102E' : '#FFFFFF';
    drawFivePointStar(ctx, x + w * 0.74, y + h * 0.25, minDim * 0.1, minDim * 0.04, starCol);
    drawFivePointStar(ctx, x + w * 0.85, y + h * 0.45, minDim * 0.09, minDim * 0.036, starCol);
    drawFivePointStar(ctx, x + w * 0.74, y + h * 0.76, minDim * 0.11, minDim * 0.045, starCol);
    if (baseId === '036' || code === 'AU') {
      drawFivePointStar(ctx, x + w * 0.24, y + h * 0.76, minDim * 0.14, minDim * 0.06, '#FFFFFF');
    }
  }
  // 19. GÜNEY ASYA (DEL, 356/IN, 050/BD)
  else if (baseId === '356' || code === 'DEL' || code === 'IN') {
    if (code === 'DEL') {
      ctx.fillStyle = '#047857';
      ctx.fillRect(x, y, w, h);
      drawCrescentAndStar(ctx, cx, cy, minDim * 0.28, '#FACC15', '#047857', 8);
    } else {
      drawHorizontalTricolor(ctx, x, y, w, h, '#FF9933', '#FFFFFF', '#138808');
      ctx.strokeStyle = '#000080';
      ctx.lineWidth = Math.max(0.8, minDim * 0.07);
      ctx.beginPath();
      ctx.arc(cx, cy, minDim * 0.12, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (baseId === '050' || code === 'BD') {
    ctx.fillStyle = '#006A4E';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#F42A41';
    ctx.beginPath();
    ctx.arc(cx - w * 0.04, cy, minDim * 0.27, 0, Math.PI * 2);
    ctx.fill();
  }
  // 20. İSRAİL (376, IL)
  else if (baseId === '376' || code === 'IL') {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#0038B8';
    ctx.fillRect(x, y + h * 0.13, w, h * 0.13);
    ctx.fillRect(x, y + h * 0.74, w, h * 0.13);
    drawStarOfDavid(ctx, cx, cy, minDim * 0.2, '#0038B8');
  }
  // 21. AFRİKA (HAB/231/ET, MAL, ZIM/710/ZA, 566/NG)
  else if (code === 'HAB' || baseId === '231' || code === 'ET') {
    drawHorizontalTricolor(ctx, x, y, w, h, '#078930', '#FCDD09', '#DA121A');
    ctx.fillStyle = code === 'HAB' ? '#B45309' : '#0F47AF';
    ctx.beginPath();
    ctx.arc(cx, cy, minDim * 0.17, 0, Math.PI * 2);
    ctx.fill();
    drawFivePointStar(ctx, cx, cy, minDim * 0.13, minDim * 0.055, '#FCDD09');
  } else if (code === 'MAL') {
    // Mali & Songhay Imperial Gold/Crimson/Emerald Standard
    drawVerticalTricolor(ctx, x, y, w, h, '#14B53A', '#FCD116', '#CE1126');
    drawEightPointStar(ctx, cx, cy, minDim * 0.19, '#78350F');
  } else if (code === 'ZIM') {
    // Kilwa & Great Zimbabwe Banner
    ctx.fillStyle = '#006400';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#FFD200';
    ctx.fillRect(x, cy - h * 0.14, w, h * 0.28);
    ctx.fillStyle = '#D40000';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w * 0.38, cy);
    ctx.lineTo(x, y + h);
    ctx.closePath();
    ctx.fill();
    drawFivePointStar(ctx, x + w * 0.14, cy, minDim * 0.12, minDim * 0.05, '#FFD200');
  } else if (baseId === '710' || code === 'ZA') {
    ctx.fillStyle = '#E03C31';
    ctx.fillRect(x, y, w, h * 0.42);
    ctx.fillStyle = '#001489';
    ctx.fillRect(x, y + h * 0.58, w, h * 0.42);
    ctx.fillStyle = '#007749';
    ctx.fillRect(x, y + h * 0.36, w, h * 0.28);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(cx, cy);
    ctx.lineTo(x, y + h);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.moveTo(x, y + h * 0.15);
    ctx.lineTo(cx * 0.78, cy);
    ctx.lineTo(x, y + h * 0.85);
    ctx.closePath();
    ctx.fill();
  } else if (baseId === '566' || code === 'NG') {
    drawVerticalTricolor(ctx, x, y, w, h, '#008751', '#FFFFFF', '#008751');
  }
  // 22. İSLAM ÜLKELERİ & KÖRFEZ (SA, PK, MAG, AE, KW, QA, OM, JO, LY, DZ, MA, TN, UZ, TM)
  else if (
    baseId === '784' ||
    baseId === '414' ||
    baseId === '400' ||
    code === 'AE' ||
    code === 'KW' ||
    code === 'JO'
  ) {
    drawHorizontalTricolor(ctx, x, y, w, h, '#00732F', '#FFFFFF', '#000000');
    ctx.fillStyle = '#FF0000';
    if (baseId === '784' || code === 'AE') {
      ctx.fillRect(x, y, w * 0.26, h);
    } else {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + w * 0.36, cy);
      ctx.lineTo(x, y + h);
      ctx.closePath();
      ctx.fill();
    }
  } else if (
    baseId === '682' ||
    baseId === '586' ||
    baseId === '012' ||
    baseId === '504' ||
    baseId === '788' ||
    baseId === '434' ||
    code === 'SA' ||
    code === 'PK' ||
    code === 'MAG'
  ) {
    const bg = baseId === '504' || baseId === '788' ? '#C1272D' : '#006C35';
    ctx.fillStyle = bg;
    ctx.fillRect(x, y, w, h);
    if (baseId === '586' || code === 'PK') {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(x, y, w * 0.25, h);
      drawCrescentAndStar(ctx, cx + w * 0.1, cy, minDim * 0.26, '#FFFFFF', bg, 5);
    } else if (baseId === '504') {
      // Morocco red with green pentagram star
      drawFivePointStar(ctx, cx, cy, minDim * 0.25, minDim * 0.1, '#006233');
    } else {
      drawCrescentAndStar(ctx, cx, cy, minDim * 0.28, '#FFFFFF', bg, 5);
    }
  }
  // 23. REMAINING NATIONS FALLBACK HERALDIC GENERATOR (Deterministic & clean)
  else {
    const hash =
      (code.charCodeAt(0) || 65) * 17 + (code.charCodeAt(1) || 70) * 31;
    const style = hash % 4;
    ctx.fillStyle = baseColor || '#3B82F6';
    ctx.fillRect(x, y, w, h);

    if (style === 0) {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(x, y + h * 0.33, w, h * 0.34);
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(x, y + h * 0.67, w, h * 0.33);
    } else if (style === 1) {
      ctx.fillStyle = '#F8FAFC';
      ctx.fillRect(x, y, w * 0.38, h);
      drawFivePointStar(ctx, x + w * 0.68, cy, minDim * 0.22, minDim * 0.09, '#FACC15');
    } else if (style === 2) {
      ctx.fillStyle = '#F8FAFC';
      ctx.fillRect(cx - w * 0.09, y, w * 0.18, h);
      ctx.fillRect(x, cy - h * 0.11, w, h * 0.22);
    } else {
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = Math.max(1.5, minDim * 0.18);
      ctx.beginPath();
      ctx.moveTo(x, y + h);
      ctx.lineTo(x + w, y);
      ctx.stroke();
      ctx.fillStyle = '#FACC15';
      ctx.beginPath();
      ctx.arc(cx, cy, minDim * 0.18, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Crisp subtle cloth border
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
  ctx.lineWidth = 0.8;
  ctx.strokeRect(x + 0.4, y + 0.4, w - 0.8, h - 0.8);
  ctx.restore();
}

/**
 * Reusable React Badge component that renders the nation's graphical flag on a crisp HTML5 Canvas.
 */
export const NationFlagCanvasBadge: React.FC<{
  nationId: string;
  flagCode: string;
  color: string;
  width?: number;
  height?: number;
  className?: string;
}> = ({
  nationId,
  flagCode,
  color,
  width = 36,
  height = 26,
  className = '',
}) => {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.save();
    ctx.scale(dpr, dpr);
    drawNationFlagOnCanvas(ctx, 0, 0, width, height, nationId, flagCode, color);
    ctx.restore();
  }, [nationId, flagCode, color, width, height]);

  return React.createElement('canvas', {
    ref,
    style: { width: `${width}px`, height: `${height}px` },
    className: `rounded-md border border-white/25 shadow-sm shrink-0 ${className}`,
  });
};
