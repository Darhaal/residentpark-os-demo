// Title: Vehicle Top-Down Icon
// Path: src/components/ui/vehicle-top-down-icon.tsx
// Functionality: Generates a dynamic SVG top-down view of a vehicle based on make, model, and color.

import * as React from 'react';
import { cn } from '@/lib/utils';

export type VehicleKind = 'sedan' | 'suv' | 'pickup' | 'van' | 'motorcycle' | 'compact' | 'unknown';

interface VehicleTopDownIconProps {
  color?: string | null;
  make?: string | null;
  model?: string | null;
  kind?: VehicleKind;
  privacy?: boolean;
  className?: string;
}

const PAINT: Record<string, string> = {
  black: '#18181b', white: '#f8fafc', silver: '#e2e8f0', grey: '#64748b', gray: '#64748b',
  red: '#dc2626', blue: '#2563eb', green: '#16a34a', yellow: '#ca8a04', orange: '#ea580c',
  brown: '#78350f', gold: '#b45309', purple: '#7c3aed', navy: '#1e3a8a', beige: '#d6c7b0',
  cyan: '#06b6d4', teal: '#14b8a6', olive: '#4d7c0f', lime: '#84cc16', pink: '#ec4899',
  maroon: '#831843', burgundy: '#9f1239', champagne: '#fcd34d', charcoal: '#334155'
};

const RU_COLORS: Record<string, string> = {
  'черный': 'black', 'белый': 'white', 'серебристый': 'silver', 'серый': 'grey',
  'красный': 'red', 'синий': 'blue', 'зеленый': 'green', 'желтый': 'yellow',
  'оранжевый': 'orange', 'коричневый': 'brown', 'золотой': 'gold', 'бронзовый': 'bronze',
  'фиолетовый': 'purple', 'розовый': 'pink', 'бордовый': 'burgundy', 'бежевый': 'beige',
  'голубой': 'cyan', 'темно-синий': 'navy', 'оливковый': 'olive'
};

function paintFromName(name: string | null | undefined, privacy: boolean) {
  if (privacy) return '#71717a';
  let normalized = (name || '').trim().toLowerCase();

  // Translate Russian colors to English keys
  if (RU_COLORS[normalized]) {
    normalized = RU_COLORS[normalized];
  }

  // Return the hex color or a special keyword 'fallback' which triggers the SVG pattern
  return PAINT[normalized] || 'fallback';
}

function inferKind(make?: string | null, model?: string | null, fallback: VehicleKind = 'sedan'): VehicleKind {
  const text = `${make || ''} ${model || ''}`.toLowerCase();
  if (/(motorcycle|moto|bike|harley|ducati|yamaha|kawasaki|suzuki)/.test(text)) return 'motorcycle';
  if (/(pickup|truck|f-150|f150|silverado|ram|tacoma|tundra|ranger)/.test(text)) return 'pickup';
  if (/(van|transit|sienna|odyssey|sprinter|promaster)/.test(text)) return 'van';
  if (/(suv|rav4|cr-v|crv|pilot|highlander|explorer|escape|x5|q5|crosstrek|forester|suburban|tahoe)/.test(text)) return 'suv';
  if (/(mini|fiat|smart|compact|cooper|yaris|versa|fit)/.test(text)) return 'compact';
  return fallback;
}

function getShape(kind: VehicleKind) {
  switch (kind) {
    case 'compact': return { x: 16, y: 13, w: 32, h: 70, r: 14, cabinY: 34, cabinH: 19 };
    case 'suv': return { x: 10, y: 9, w: 44, h: 78, r: 12, cabinY: 31, cabinH: 25 };
    case 'pickup': return { x: 11, y: 8, w: 42, h: 80, r: 10, cabinY: 27, cabinH: 22 };
    case 'van': return { x: 9, y: 7, w: 46, h: 82, r: 10, cabinY: 27, cabinH: 31 };
    default: return { x: 12, y: 10, w: 40, h: 76, r: 15, cabinY: 32, cabinH: 23 };
  }
}

function MotorcycleIcon({ fill, stroke, className }: { fill: string; stroke: string; className?: string; }) {
  return (
    <svg viewBox="0 0 64 96" aria-hidden="true" className={cn(className)}>
      <circle cx="32" cy="15" r="7" fill={stroke} />
      <circle cx="32" cy="81" r="7" fill={stroke} />
      <rect x="24" y="22" width="16" height="52" rx="8" fill={fill} stroke={stroke} strokeWidth="2.5" />
      <rect x="27" y="36" width="10" height="20" rx="5" fill="#ffffff" opacity="0.35" />
      <path d="M22 33h-7M42 33h7M22 63h-7M42 63h7" stroke={stroke} strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function VehicleTopDownIcon({ color, make, model, kind, privacy = false, className }: VehicleTopDownIconProps) {
  const vehicleKind = kind || inferKind(make, model);
  const colorResolved = paintFromName(color, privacy);

  // Apply fallback pattern if color is unknown
  const fill = colorResolved === 'fallback' ? 'url(#striped-pattern)' : colorResolved;

  // Use strict zinc colors for the framework
  const stroke = privacy ? '#3f3f46' : '#18181b'; // zinc-700 or zinc-900
  const glass = privacy ? '#d4d4d8' : '#000000'; // dark tinted windows for enterprise look

  if (vehicleKind === 'motorcycle') {
    return <MotorcycleIcon fill={fill} stroke={stroke} className={className} />;
  }

  const s = getShape(vehicleKind);
  const isPickup = vehicleKind === 'pickup';

  return (
    <svg viewBox="0 0 64 96" aria-hidden="true" className={cn(className)}>
      <defs>
        {/* Strict B2B Fallback Pattern for unknown colors */}
        <pattern id="striped-pattern" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="8" height="8" fill="#ffffff" />
          <line x1="0" y1="0" x2="0" y2="8" stroke="#18181b" strokeWidth="4" />
        </pattern>
      </defs>

      {/* wheels */}
      <rect x={s.x - 3} y="25" width="5" height="14" rx="2.5" fill={stroke} />
      <rect x={s.x + s.w - 2} y="25" width="5" height="14" rx="2.5" fill={stroke} />
      <rect x={s.x - 3} y="58" width="5" height="14" rx="2.5" fill={stroke} />
      <rect x={s.x + s.w - 2} y="58" width="5" height="14" rx="2.5" fill={stroke} />

      {/* body */}
      <rect x={s.x} y={s.y} width={s.w} height={s.h} rx={s.r} fill={fill} stroke={stroke} strokeWidth="2.5" />

      {/* front windshield (Dark Tinted) */}
      <rect x={s.x + 8} y={s.cabinY} width={s.w - 16} height={s.cabinH} rx="6" fill={glass} opacity={privacy ? 0.45 : 0.85} stroke={stroke} strokeWidth="1.5" />

      {/* hood line */}
      <path d={`M${s.x + 10} ${s.y + 16}H${s.x + s.w - 10}`} stroke="#ffffff" strokeWidth="2" strokeLinecap="round" opacity="0.4" />

      {/* rear / pickup bed */}
      {isPickup ? (
        <rect x={s.x + 8} y="59" width={s.w - 16} height="20" rx="3" fill="none" stroke="#ffffff" strokeWidth="2" opacity="0.4" />
      ) : (
        <path d={`M${s.x + 11} 68H${s.x + s.w - 11}`} stroke="#ffffff" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
      )}

      {/* lights (Muted, professional colors instead of bright neon) */}
      <path d={`M${s.x + 10} ${s.y + 4}h7`} stroke="#d4d4d8" strokeWidth="2" strokeLinecap="round" />
      <path d={`M${s.x + s.w - 17} ${s.y + 4}h7`} stroke="#d4d4d8" strokeWidth="2" strokeLinecap="round" />
      <path d={`M${s.x + 10} ${s.y + s.h - 4}h7`} stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
      <path d={`M${s.x + s.w - 17} ${s.y + s.h - 4}h7`} stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}