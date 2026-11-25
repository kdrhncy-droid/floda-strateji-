import React from 'react';
import {
  BuildingType,
  GameModeId,
  TechArtKey,
  TechBranch,
  TerrainType,
} from '../../types/game';
import { getTechArtwork } from '../drawers/techArtwork';

export type AoH3GlyphName =
  | 'sword'
  | 'shield'
  | 'cavalry'
  | 'artillery'
  | 'speed'
  | 'gold'
  | 'crown'
  | 'anchor'
  | 'caravan'
  | 'globe'
  | 'festival'
  | 'fortress'
  | 'scroll'
  | 'horn'
  | 'bolt'
  | 'science'
  | 'star'
  | 'alert'
  | 'lock'
  | 'check'
  | 'flag'
  | 'pin'
  | 'gift'
  | 'fleur'
  | 'heart'
  | 'revolt'
  | 'dove'
  | 'scale'
  | 'hammer'
  | 'users'
  | 'handshake'
  | 'trophy'
  | 'ban'
  | 'compass'
  | 'book';

/**
 * Unified Obsidian & Antique Gold Custom Vector Glyph Set.
 * Replaces static Unicode emojis across all menus with crisp, theme-matched SVGs.
 */
export const AoH3GlyphSvg: React.FC<{
  name: AoH3GlyphName;
  className?: string;
}> = ({ name, className = 'w-3.5 h-3.5' }) => {
  switch (name) {
    case 'sword':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <path d="M14.5 3.5L20.5 3.5L20.5 9.5L9.5 20.5L3.5 14.5Z" />
          <path d="M5 19L3 21" />
          <path d="M12.5 5.5L18.5 11.5" />
          <path d="M7.5 12.5L11.5 16.5" />
        </svg>
      );
    case 'shield':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <path d="M12 2.5L19.5 5.5V11.5C19.5 16.5 15.8 20 12 21.5C8.2 20 4.5 16.5 4.5 11.5V5.5L12 2.5Z" />
          <path d="M12 6.5V17.5" />
          <path d="M8.5 10.5H15.5" />
        </svg>
      );
    case 'cavalry':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <path d="M5 19L19 5" />
          <path d="M15 4H20V9" />
          <path d="M7 15C7 10.5 10 7.5 13.5 7.5C14.8 7.5 15.8 8.5 15.8 9.8C15.8 11.2 14.6 12.2 13 12.2H11L9.5 19" />
        </svg>
      );
    case 'artillery':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <path d="M4 13L18 7L20 11L7 17Z" />
          <circle cx="9" cy="17" r="3.5" />
          <path d="M19 5L21 4M20.5 7.5L22 7" />
        </svg>
      );
    case 'speed':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <path d="M6 17L11 12L6 7" />
          <path d="M13 17L18 12L13 7" />
        </svg>
      );
    case 'gold':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <circle cx="12" cy="12" r="8.5" />
          <circle cx="12" cy="12" r="5" />
          <path d="M12 9V15" />
        </svg>
      );
    case 'crown':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <path d="M3.5 17.5L5 7.5L9.5 12L12 5.5L14.5 12L19 7.5L20.5 17.5H3.5Z" />
          <path d="M4.5 20H19.5" />
        </svg>
      );
    case 'anchor':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <circle cx="12" cy="5.5" r="2.2" />
          <path d="M12 7.7V20.5" />
          <path d="M7.5 11H16.5" />
          <path d="M4.5 14C4.5 18 7.8 20.5 12 20.5C16.2 20.5 19.5 18 19.5 14" />
        </svg>
      );
    case 'caravan':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <path d="M3.5 15.5L6 8.5H16.5L19.5 15.5H3.5Z" />
          <path d="M8.5 8.5V15.5M14 8.5V15.5" />
          <circle cx="7.5" cy="18" r="2" />
          <circle cx="16.5" cy="18" r="2" />
        </svg>
      );
    case 'globe':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <ellipse cx="12" cy="12" rx="4" ry="9" />
          <path d="M3.5 9.5H20.5M3.5 14.5H20.5" />
        </svg>
      );
    case 'festival':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <path d="M12 3V21" />
          <path d="M12 4L19.5 7.5L12 11" />
          <path d="M5 17C5 14.5 8 13.5 12 13.5C16 13.5 19 14.5 19 17" />
          <path d="M7.5 21H16.5" />
        </svg>
      );
    case 'fortress':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <path d="M4 20V7H7V10H10V7H14V10H17V7H20V20H4Z" />
          <path d="M10 20V15C10 13.9 10.9 13 12 13C13.1 13 14 13.9 14 15V20" />
        </svg>
      );
    case 'scroll':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <path d="M7 4H18C19.6 4 20.5 5 20.5 6.5C20.5 8 19.6 9 18 9H17V18.5C17 19.9 15.9 21 14.5 21H5.5C4.1 21 3 19.9 3 18.5C3 17.1 4.1 16 5.5 16H7V4Z" />
          <path d="M10 8.5H14M10 12.5H14M10 16.5H13" />
        </svg>
      );
    case 'horn':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <path d="M4 14.5L17 6V18L4 14.5Z" />
          <path d="M17 9.5C19.2 10.2 20.5 11.2 20.5 12C20.5 12.8 19.2 13.8 17 14.5" />
          <path d="M7.5 15.5L8.5 19.5" />
        </svg>
      );
    case 'bolt':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <path d="M13 2.5L4.5 13.5H11.5L10.5 21.5L19.5 10.5H12.5L13 2.5Z" />
        </svg>
      );
    case 'science':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <path d="M9 3.5H15" />
          <path d="M10.5 3.5V9.5L5.2 18.2C4.6 19.2 5.3 20.5 6.5 20.5H17.5C18.7 20.5 19.4 19.2 18.8 18.2L13.5 9.5V3.5" />
          <path d="M7.8 15H16.2" />
        </svg>
      );
    case 'star':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
          <path d="M12 2.8L14.8 8.6L21.2 9.5L16.6 14L17.7 20.4L12 17.3L6.3 20.4L7.4 14L2.8 9.5L9.2 8.6L12 2.8Z" />
        </svg>
      );
    case 'alert':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <path d="M12 3.5L21 19.5H3L12 3.5Z" />
          <path d="M12 9.5V13.8" />
          <circle cx="12" cy="16.8" r="0.7" fill="currentColor" />
        </svg>
      );
    case 'lock':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <rect x="5" y="10.5" width="14" height="10" rx="2" />
          <path d="M8 10.5V7.5C8 5.3 9.8 3.5 12 3.5C14.2 3.5 16 5.3 16 7.5V10.5" />
        </svg>
      );
    case 'check':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <path d="M4.5 12.5L9.5 17.5L19.5 6.5" />
        </svg>
      );
    case 'flag':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <path d="M5 3.5V20.5" />
          <path d="M5 4.5H18.5L16 9L18.5 13.5H5" />
        </svg>
      );
    case 'pin':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <path d="M12 21C12 21 18.5 15 18.5 9.8C18.5 6.1 15.6 3.2 12 3.2C8.4 3.2 5.5 6.1 5.5 9.8C5.5 15 12 21 12 21Z" />
          <circle cx="12" cy="9.8" r="2.4" />
        </svg>
      );
    case 'gift':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <rect x="4" y="8" width="16" height="4" rx="1" />
          <path d="M5.5 12V20H18.5V12" />
          <path d="M12 8V20" />
          <path d="M12 8C10 8 8 6.8 8 5.2C8 4 9 3.2 10.2 3.2C11.4 3.2 12 4.8 12 8Z" />
          <path d="M12 8C14 8 16 6.8 16 5.2C16 4 15 3.2 13.8 3.2C12.6 3.2 12 4.8 12 8Z" />
        </svg>
      );
    case 'fleur':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <path d="M12 3C14 6 14 9 12 12C10 9 10 6 12 3Z" />
          <path d="M12 12C15 10 18.5 10.5 19.5 13C20.5 15.5 17.5 17 15 15.5" />
          <path d="M12 12C9 10 5.5 10.5 4.5 13C3.5 15.5 6.5 17 9 15.5" />
          <path d="M6.5 15H17.5" />
          <path d="M12 12V21" />
        </svg>
      );
    case 'heart':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <path d="M12 20C12 20 4.5 15 4.5 9.2C4.5 6.5 6.6 4.5 9.1 4.5C10.6 4.5 11.6 5.3 12 6.4C12.4 5.3 13.4 4.5 14.9 4.5C17.4 4.5 19.5 6.5 19.5 9.2C19.5 15 12 20 12 20Z" />
        </svg>
      );
    case 'revolt':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <path d="M12.5 3C13.5 6.5 17.5 8.5 17.5 13.5C17.5 17 15 20 12 20C9 20 6.5 17.5 6.5 14C6.5 11.5 8 9.5 9.5 8.5C9.5 10.5 11 11.5 11.5 11.5C11.5 8.5 11.8 5.8 12.5 3Z" />
        </svg>
      );
    case 'dove':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <path d="M4 16C7.5 16 10.5 13.5 12.5 10C13.5 8 15 6 17.5 5.5C16.8 7.5 17.2 9.5 19.5 10.5C17 12 16 14 14.5 16.5C12.5 19 8.5 19.5 4 16Z" />
          <path d="M9.5 11.5C7 10 5.5 7.8 5.5 5.5C8 6.5 9.8 8 11.2 10" />
        </svg>
      );
    case 'scale':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <path d="M12 4V20M7 20H17" />
          <path d="M5 7.5H19" />
          <path d="M5 7.5L3 13H7L5 7.5ZM19 7.5L17 13H21L19 7.5Z" />
        </svg>
      );
    case 'hammer':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <path d="M14.5 5.5L18.5 9.5L15.5 12.5L11.5 8.5L14.5 5.5Z" />
          <path d="M13 10.5L5 18.5" />
          <path d="M10.5 4.5L15.5 4.5" />
        </svg>
      );
    case 'users':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <circle cx="9.5" cy="8.5" r="3" />
          <path d="M4 19C4 16 6.5 14 9.5 14C12.5 14 15 16 15 19" />
          <circle cx="16.5" cy="9.5" r="2.2" />
          <path d="M16.5 14.5C18.5 14.8 20 16.3 20 19" />
        </svg>
      );
    case 'handshake':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <path d="M3.5 11.5L7.5 7.5L12 10L16.5 7.5L20.5 11.5" />
          <path d="M7.5 13.5L10.5 16.5C11.4 17.4 12.6 17.4 13.5 16.5L17.5 12.5" />
        </svg>
      );
    case 'trophy':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <path d="M7 4.5H17V10.5C17 13.3 14.8 15.5 12 15.5C9.2 15.5 7 13.3 7 10.5V4.5Z" />
          <path d="M7 6.5H4.5V9.5C4.5 10.9 5.6 12 7 12M17 6.5H19.5V9.5C19.5 10.9 18.4 12 17 12" />
          <path d="M12 15.5V19.5M8.5 19.5H15.5" />
        </svg>
      );
    case 'ban':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <circle cx="12" cy="12" r="8.5" />
          <path d="M6.2 6.2L17.8 17.8" />
        </svg>
      );
    case 'compass':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <polygon points="15.5,8.5 13.5,13.5 8.5,15.5 10.5,10.5" />
        </svg>
      );
    case 'book':
    default:
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <path d="M4.5 5.5C4.5 4.4 5.4 3.5 6.5 3.5H19.5V18.5H6.5C5.4 18.5 4.5 19.4 4.5 20.5V5.5Z" />
          <path d="M4.5 18.5C4.5 17.4 5.4 16.5 6.5 16.5H19.5" />
        </svg>
      );
  }
};

/**
 * Custom Vector Resource SVG Icons in unified Antique Gold + Parchment Scale
 */
export const ResourceSvg: React.FC<{
  resource: string;
  className?: string;
}> = ({ resource, className = 'w-3.5 h-3.5' }) => {
  switch (resource) {
    case 'KERESTE':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <path d="M12 3L6 10H10L5 16H19L14 10H18L12 3Z" />
          <path d="M12 16V21" />
        </svg>
      );
    case 'SIGIR':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <path d="M5 7C5 5 6.8 4 8.5 5.5M19 7C19 5 17.2 4 15.5 5.5" />
          <rect x="6.5" y="7" width="11" height="10.5" rx="3" />
          <path d="M9.5 13.5H14.5" />
        </svg>
      );
    case 'PAMUK':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <circle cx="9" cy="10" r="3" />
          <circle cx="15" cy="10" r="3" />
          <circle cx="12" cy="7" r="3" />
          <path d="M12 13V20.5M9 17.5L12 15.5L15 17.5" />
        </svg>
      );
    case 'TAHIL':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <path d="M12 3V21" />
          <path d="M12 7L8.5 4.5M12 7L15.5 4.5" />
          <path d="M12 11L8 8.5M12 11L16 8.5" />
          <path d="M12 15L8.5 12.5M12 15L15.5 12.5" />
        </svg>
      );
    case 'DEMIR_CELIK':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <path d="M4 17L8 9H16L20 17H4Z" />
          <path d="M8.5 13H15.5" />
        </svg>
      );
    case 'ALTIN':
      return <AoH3GlyphSvg name="gold" className={className} />;
    case 'PETROL':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <rect x="6.5" y="4.5" width="11" height="15" rx="1.5" />
          <path d="M6.5 9.5H17.5M6.5 14.5H17.5" />
        </svg>
      );
    case 'DOGALGAZ':
      return <AoH3GlyphSvg name="revolt" className={className} />;
    case 'TICARET_BOGAZI':
      return <AoH3GlyphSvg name="anchor" className={className} />;
    case 'FINANS_MERKEZI':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <path d="M3.5 9L12 4L20.5 9H3.5Z" />
          <path d="M6.5 9V18M12 9V18M17.5 9V18M4 19.5H20" />
        </svg>
      );
    case 'YARI_ILETKEN':
      return <AoH3GlyphSvg name="science" className={className} />;
    case 'NADIR_TOPRAK':
    default:
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <polygon points="12,3 20,9 12,21 4,9" />
          <path d="M4 9H20M12 3V21" />
        </svg>
      );
  }
};

/**
 * Custom Vector Religion Symbol SVG in Antique Gold
 */
export const ReligionSvg: React.FC<{
  religionId?: string;
  className?: string;
}> = ({ religionId = 'ISLAM_SUNNI', className = 'w-3.5 h-3.5' }) => {
  if (religionId === 'CHRISTIAN_ORTHODOX' || religionId === 'CHRISTIAN_CATHOLIC') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={className} aria-hidden="true">
        <path d="M12 3.5V20.5M7 8.5H17" />
        {religionId === 'CHRISTIAN_ORTHODOX' && <path d="M9.5 15.5L14.5 13.5" />}
      </svg>
    );
  }
  if (religionId === 'TENGRISM' || religionId === 'PAGAN_SHAMAN') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
        <circle cx="12" cy="12" r="4.5" />
        <path d="M12 3V5.5M12 18.5V21M3 12H5.5M18.5 12H21M5.6 5.6L7.4 7.4M16.6 16.6L18.4 18.4M18.4 5.6L16.6 7.4M7.4 16.6L5.6 18.4" />
      </svg>
    );
  }
  if (religionId === 'BUDDHISM' || religionId === 'HINDUISM') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" className={className} aria-hidden="true">
        <circle cx="12" cy="12" r="7.5" />
        <circle cx="12" cy="12" r="2.2" />
        <path d="M12 4.5V9.8M12 14.2V19.5M4.5 12H9.8M14.2 12H19.5" />
      </svg>
    );
  }
  // Crescent & Star (default Islamic states)
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M14.5 4.5C10.5 5 7.5 8.2 7.5 12C7.5 15.8 10.5 19 14.5 19.5C11.8 20.5 8.5 19.8 6.4 17.6C4 15.1 4 8.9 6.4 6.4C8.5 4.2 11.8 3.5 14.5 4.5Z" />
      <path d="M17 10.5L18 12L19.5 12L18.3 13L18.8 14.5L17 13.6L15.2 14.5L15.7 13L14.5 12L16 12Z" />
    </svg>
  );
};

/**
 * Reusable AoH3 Illustrated Oil-Painting Menu Header Banner
 * Brings consistent historical oil-painting artwork and fixed Obsidian + Antique Gold framing to every drawer/modal.
 */
export const AoH3MenuBanner: React.FC<{
  artKey: TechArtKey;
  branch?: TechBranch;
  title: string;
  subtitle?: string;
  icon?: AoH3GlyphName;
  rightSlot?: React.ReactNode;
  className?: string;
}> = ({
  artKey,
  branch = 'ADMINISTRATION',
  title,
  subtitle,
  icon = 'crown',
  rightSlot,
  className = 'h-16 sm:h-[72px]',
}) => {
  const artwork = getTechArtwork(artKey, branch);

  return (
    <div
      className={`relative w-full rounded-2xl overflow-hidden border border-[#caa15a]/40 ${className}`}
      style={{ background: artwork.fallbackGradient }}
    >
      <img
        src={artwork.src}
        alt={title}
        loading="eager"
        decoding="async"
        referrerPolicy="no-referrer"
        style={{ objectPosition: artwork.objectPosition }}
        className="absolute inset-0 w-full h-full object-cover brightness-85"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-[#0e0b08]/92 via-[#14100c]/75 to-[#0e0b08]/88" />
      <div className="relative h-full px-3.5 py-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-[#14100c]/85 border border-[#caa15a]/50 flex items-center justify-center text-[#e0b86e] shrink-0 shadow">
            <AoH3GlyphSvg name={icon} className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-xs sm:text-sm font-display font-bold text-[#faf3e3] truncate drop-shadow">
              {title}
            </div>
            {subtitle && (
              <div className="text-[10.5px] font-mono-num text-[#e0b86e] truncate">
                {subtitle}
              </div>
            )}
          </div>
        </div>
        {rightSlot && <div className="shrink-0">{rightSlot}</div>}
      </div>
    </div>
  );
};

/**
 * AoH3-Style Illustrated Terrain Panorama Banner (Unified Obsidian + Antique Gold Atmosphere)
 */
export const TerrainPanoramaSvg: React.FC<{
  terrain: TerrainType;
  fortLevel?: number;
  isCapital?: boolean;
  className?: string;
}> = ({ terrain, fortLevel = 1, isCapital = false, className = 'w-full h-24' }) => {
  switch (terrain) {
    case 'DAGLIK':
      return (
        <svg viewBox="0 0 320 96" className={className} preserveAspectRatio="xMidYMid slice">
          <defs>
            <linearGradient id="sky-dag" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#120f0c" />
              <stop offset="60%" stopColor="#26201a" />
              <stop offset="100%" stopColor="#3a3025" />
            </linearGradient>
            <linearGradient id="mtn-front" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7a6850" />
              <stop offset="100%" stopColor="#18130e" />
            </linearGradient>
          </defs>
          <rect width="320" height="96" fill="url(#sky-dag)" />
          <circle cx="265" cy="24" r="14" fill="#caa15a" fillOpacity="0.22" />
          <circle cx="265" cy="24" r="9" fill="#e8c682" fillOpacity="0.45" />
          <polygon points="0,84 48,26 98,84" fill="#2c241b" />
          <polygon points="48,26 36,42 60,42" fill="#e6dcc6" fillOpacity="0.45" />
          <polygon points="180,84 238,18 298,84" fill="#2c241b" />
          <polygon points="238,18 223,38 253,38" fill="#e6dcc6" fillOpacity="0.5" />
          <polygon points="65,92 138,14 212,92" fill="url(#mtn-front)" />
          <polygon points="138,14 118,38 132,34 142,42 158,36" fill="#f3ead7" fillOpacity="0.65" />
          {fortLevel > 0 && (
            <g transform="translate(122, 46)">
              <rect x="0" y="10" width="32" height="18" fill="#6b5c47" stroke="#14100c" strokeWidth="1" />
              <rect x="-4" y="4" width="10" height="24" fill="#8b775b" stroke="#14100c" strokeWidth="1" />
              <rect x="26" y="4" width="10" height="24" fill="#8b775b" stroke="#14100c" strokeWidth="1" />
              <polygon points="-5,4 1,-3 7,4" fill="#caa15a" />
              <polygon points="25,4 31,-3 37,4" fill="#caa15a" />
            </g>
          )}
          {isCapital && (
            <g transform="translate(45, 56)">
              <path d="M8,20 L8,10 Q16,0 24,10 L24,20 Z" fill="#e0b86e" fillOpacity="0.85" />
              <rect x="4" y="4" width="2" height="16" fill="#f3ead7" />
              <rect x="26" y="4" width="2" height="16" fill="#f3ead7" />
            </g>
          )}
          <rect x="0" y="82" width="320" height="14" fill="#0d0a07" />
        </svg>
      );

    case 'ORMAN':
      return (
        <svg viewBox="0 0 320 96" className={className} preserveAspectRatio="xMidYMid slice">
          <defs>
            <linearGradient id="sky-orman" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#120f0b" />
              <stop offset="65%" stopColor="#211c14" />
              <stop offset="100%" stopColor="#2d261a" />
            </linearGradient>
          </defs>
          <rect width="320" height="96" fill="url(#sky-orman)" />
          <circle cx="270" cy="22" r="12" fill="#e0b86e" fillOpacity="0.28" />
          <path d="M0,74 Q80,45 170,68 T320,62 L320,96 L0,96 Z" fill="#3a3321" fillOpacity="0.65" />
          <path d="M0,82 Q120,58 240,78 T320,74 L320,96 L0,96 Z" fill="#2a2417" />
          {[22, 46, 72, 104, 196, 224, 252, 284].map((x, idx) => (
            <g key={x} transform={`translate(${x}, ${42 + (idx % 2) * 6})`}>
              <rect x="7" y="24" width="4" height="10" fill="#3b2814" />
              <polygon points="9,0 0,16 18,16" fill="#5e5435" />
              <polygon points="9,8 -2,26 20,26" fill="#463e27" />
            </g>
          ))}
          {fortLevel > 0 && (
            <g transform="translate(142, 42)">
              <rect x="4" y="14" width="28" height="22" fill="#594328" stroke="#14100c" strokeWidth="1.2" />
              <polygon points="0,14 18,2 36,14" fill="#caa15a" />
              <rect x="14" y="22" width="8" height="14" fill="#18130e" />
            </g>
          )}
          <rect x="0" y="84" width="320" height="12" fill="#0d0a07" />
        </svg>
      );

    case 'COL':
      return (
        <svg viewBox="0 0 320 96" className={className} preserveAspectRatio="xMidYMid slice">
          <defs>
            <linearGradient id="sky-col" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1b1209" />
              <stop offset="55%" stopColor="#3d2914" />
              <stop offset="100%" stopColor="#6e4b22" />
            </linearGradient>
          </defs>
          <rect width="320" height="96" fill="url(#sky-col)" />
          <circle cx="250" cy="28" r="18" fill="#e0b86e" fillOpacity="0.28" />
          <circle cx="250" cy="28" r="11" fill="#f3ead7" fillOpacity="0.45" />
          <path d="M0,72 Q90,46 185,68 T320,58 L320,96 L0,96 Z" fill="#5c3f1c" />
          <path d="M0,80 Q135,58 245,76 T320,72 L320,96 L0,96 Z" fill="#422c13" />
          <g transform="translate(128, 44)">
            <rect x="0" y="12" width="54" height="22" fill="#9c7a44" stroke="#261a0c" strokeWidth="1" />
            <path d="M16,12 Q27,-2 38,12 Z" fill="#e0b86e" />
            <rect x="-6" y="6" width="10" height="28" fill="#caa15a" stroke="#261a0c" strokeWidth="1" />
            <rect x="50" y="6" width="10" height="28" fill="#caa15a" stroke="#261a0c" strokeWidth="1" />
          </g>
          <rect x="0" y="84" width="320" height="12" fill="#0d0a07" />
        </svg>
      );

    case 'METROPOL':
      return (
        <svg viewBox="0 0 320 96" className={className} preserveAspectRatio="xMidYMid slice">
          <defs>
            <linearGradient id="sky-metro" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#120e0a" />
              <stop offset="60%" stopColor="#261c12" />
              <stop offset="100%" stopColor="#4a361d" />
            </linearGradient>
          </defs>
          <rect width="320" height="96" fill="url(#sky-metro)" />
          <circle cx="64" cy="24" r="14" fill="#e0b86e" fillOpacity="0.28" />
          <path d="M0,80 L320,80 L320,96 L0,96 Z" fill="#0d0a07" />
          <g transform="translate(115, 26)">
            <path d="M18,36 Q45,4 72,36 Z" fill="#caa15a" stroke="#f3ead7" strokeWidth="1" />
            <rect x="14" y="36" width="62" height="22" fill="#5e4e3a" stroke="#2a2117" strokeWidth="1" />
            <rect x="4" y="8" width="5" height="50" fill="#b8a990" />
            <polygon points="3,8 6.5,0 10,8" fill="#e0b86e" />
            <rect x="81" y="8" width="5" height="50" fill="#b8a990" />
            <polygon points="80,8 83.5,0 87,8" fill="#e0b86e" />
          </g>
          <g transform="translate(0, 66)">
            <rect x="0" y="6" width="320" height="14" fill="#3a2f22" />
            {[10, 34, 58, 82, 106, 206, 230, 254, 278, 302].map((bx) => (
              <rect key={bx} x={bx} y="1" width="12" height="6" fill="#5b4a36" />
            ))}
          </g>
        </svg>
      );

    case 'OVA':
    default:
      return (
        <svg viewBox="0 0 320 96" className={className} preserveAspectRatio="xMidYMid slice">
          <defs>
            <linearGradient id="sky-ova" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#120f0c" />
              <stop offset="55%" stopColor="#231c14" />
              <stop offset="100%" stopColor="#352b1d" />
            </linearGradient>
          </defs>
          <rect width="320" height="96" fill="url(#sky-ova)" />
          <circle cx="262" cy="24" r="14" fill="#e0b86e" fillOpacity="0.3" />
          <path d="M0,66 Q95,48 190,64 T320,58 L320,96 L0,96 Z" fill="#463d28" fillOpacity="0.7" />
          <path d="M0,76 Q140,62 250,76 T320,72 L320,96 L0,96 Z" fill="#30291b" />
          <path d="M160,64 Q140,76 175,86 T145,96" fill="none" stroke="#8c7a56" strokeWidth="4" strokeOpacity="0.6" />
          {fortLevel > 0 && (
            <g transform="translate(92, 42)">
              <rect x="0" y="10" width="36" height="18" fill="#7c6b53" stroke="#1b1510" strokeWidth="1" />
              <rect x="-5" y="4" width="10" height="24" fill="#9c8769" stroke="#1b1510" strokeWidth="1" />
              <rect x="31" y="4" width="10" height="24" fill="#9c8769" stroke="#1b1510" strokeWidth="1" />
              <polygon points="-6,4 0,-3 6,4" fill="#caa15a" />
              <polygon points="30,4 36,-3 42,4" fill="#caa15a" />
            </g>
          )}
          <rect x="0" y="84" width="320" height="12" fill="#0d0a07" />
        </svg>
      );
  }
};

/**
 * AoH3-Style Unit Illustration Card Artwork — Unified Obsidian & Antique Gold Palette
 */
export const UnitTypeIllustrationSvg: React.FC<{
  unitType: 'infantry' | 'armor' | 'airDrone';
  modeId?: GameModeId;
  className?: string;
}> = ({ unitType, modeId = 'EMPIRES_1440', className = 'w-12 h-12' }) => {
  const isHistorical = modeId === 'EMPIRES_1440';

  if (unitType === 'infantry') {
    return (
      <svg viewBox="0 0 64 64" className={className}>
        <rect width="64" height="64" rx="10" fill="#18120c" stroke="#caa15a" strokeWidth="1.5" />
        <circle cx="32" cy="32" r="22" fill="#2b2116" fillOpacity="0.65" />
        <path d="M16,48 L46,16 M18,16 L48,48" stroke="#d8cbb5" strokeWidth="3" strokeLinecap="round" />
        <path d="M14,44 L22,50 M42,50 L50,44" stroke="#caa15a" strokeWidth="2.6" strokeLinecap="round" />
        <path
          d="M32,16 L44,21 L44,33 C44,42 32,49 32,49 C32,49 20,42 20,33 L20,21 Z"
          fill="#261c12"
          stroke="#e8c682"
          strokeWidth="2"
        />
        <circle cx="32" cy="31" r="5" fill="none" stroke="#e0b86e" strokeWidth="1.8" />
      </svg>
    );
  }

  if (unitType === 'armor') {
    return (
      <svg viewBox="0 0 64 64" className={className}>
        <rect width="64" height="64" rx="10" fill="#18120c" stroke="#caa15a" strokeWidth="1.5" />
        <circle cx="32" cy="32" r="22" fill="#2b2116" fillOpacity="0.65" />
        {isHistorical ? (
          <g>
            <path d="M14,50 L50,14" stroke="#e8c682" strokeWidth="2.5" strokeLinecap="round" />
            <polygon points="50,14 42,16 48,22" fill="#caa15a" />
            <path d="M20,38 Q32,14 44,38 Z" fill="#b8a990" stroke="#e0b86e" strokeWidth="2" />
            <line x1="32" y1="14" x2="32" y2="42" stroke="#e0b86e" strokeWidth="2" />
            <path d="M22,38 L42,38 L40,46 L24,46 Z" fill="#6e604c" />
          </g>
        ) : (
          <g>
            <rect x="12" y="34" width="40" height="12" rx="5" fill="#7c6e5a" stroke="#e0b86e" strokeWidth="1.5" />
            <rect x="20" y="24" width="20" height="10" rx="3" fill="#b8a990" stroke="#e0b86e" strokeWidth="1.5" />
            <line x1="40" y1="28" x2="54" y2="28" stroke="#f3ead7" strokeWidth="3.5" strokeLinecap="round" />
          </g>
        )}
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 64 64" className={className}>
      <rect width="64" height="64" rx="10" fill="#18120c" stroke="#caa15a" strokeWidth="1.5" />
      <circle cx="32" cy="32" r="22" fill="#2b2116" fillOpacity="0.65" />
      {isHistorical ? (
        <g>
          <path d="M16,38 L46,20 L50,27 L22,45 Z" fill="#b88d44" stroke="#f3ead7" strokeWidth="1.6" />
          <circle cx="24" cy="44" r="8" fill="#3a2c1c" stroke="#e0b86e" strokeWidth="2" />
          <circle cx="24" cy="44" r="2.5" fill="#f3ead7" />
          <circle cx="51" cy="18" r="3" fill="#e0b86e" />
        </g>
      ) : (
        <g>
          <polygon points="32,12 48,44 32,38 16,44" fill="#caa15a" stroke="#f3ead7" strokeWidth="1.5" />
        </g>
      )}
    </svg>
  );
};

/**
 * AoH3-Style Architectural Building Illustration — Unified Obsidian & Antique Gold Palette
 */
export const BuildingIllustrationSvg: React.FC<{
  buildingKey: BuildingType;
  className?: string;
}> = ({ buildingKey, className = 'w-11 h-11' }) => {
  switch (buildingKey) {
    case 'factory':
      return (
        <svg viewBox="0 0 56 56" className={className}>
          <rect width="56" height="56" rx="10" fill="#18120c" stroke="#caa15a" strokeWidth="1.5" />
          <rect x="10" y="28" width="36" height="18" fill="#4e3b23" stroke="#e8c682" strokeWidth="1" />
          <polygon points="10,28 19,20 28,28 37,20 46,28" fill="#9c7a44" />
          <rect x="36" y="12" width="6" height="16" fill="#362919" stroke="#e8c682" strokeWidth="1" />
          <circle cx="22" cy="37" r="5" fill="#e8c682" fillOpacity="0.85" />
        </svg>
      );
    case 'barracks':
      return (
        <svg viewBox="0 0 56 56" className={className}>
          <rect width="56" height="56" rx="10" fill="#18120c" stroke="#caa15a" strokeWidth="1.5" />
          <polygon points="28,12 46,30 10,30" fill="#7c5e34" stroke="#e8c682" strokeWidth="1.2" />
          <rect x="14" y="30" width="28" height="16" fill="#463520" stroke="#e8c682" strokeWidth="1" />
          <polygon points="28,30 22,46 34,46" fill="#14100c" />
          <line x1="28" y1="6" x2="28" y2="12" stroke="#e8c682" strokeWidth="2" />
        </svg>
      );
    case 'fortress':
      return (
        <svg viewBox="0 0 56 56" className={className}>
          <rect width="56" height="56" rx="10" fill="#18120c" stroke="#caa15a" strokeWidth="1.5" />
          <rect x="14" y="22" width="28" height="24" fill="#4b4032" stroke="#e8c682" strokeWidth="1.2" />
          <rect x="10" y="14" width="10" height="32" fill="#6b5c47" stroke="#e8c682" strokeWidth="1" />
          <rect x="36" y="14" width="10" height="32" fill="#6b5c47" stroke="#e8c682" strokeWidth="1" />
          <path d="M24,46 L24,34 Q28,30 32,34 L32,46 Z" fill="#14100c" />
        </svg>
      );
    case 'university':
    case 'school':
    case 'highSchool':
      return (
        <svg viewBox="0 0 56 56" className={className}>
          <rect width="56" height="56" rx="10" fill="#18120c" stroke="#caa15a" strokeWidth="1.5" />
          <path d="M16,28 Q28,10 40,28 Z" fill="#9c7a44" stroke="#f3ead7" strokeWidth="1.2" />
          <rect x="14" y="28" width="28" height="16" fill="#3a2f22" stroke="#e8c682" strokeWidth="1" />
          <line x1="20" y1="28" x2="20" y2="44" stroke="#e8c682" strokeWidth="2" />
          <line x1="28" y1="28" x2="28" y2="44" stroke="#e8c682" strokeWidth="2" />
          <line x1="36" y1="28" x2="36" y2="44" stroke="#e8c682" strokeWidth="2" />
        </svg>
      );
    case 'tradeHub':
      return (
        <svg viewBox="0 0 56 56" className={className}>
          <rect width="56" height="56" rx="10" fill="#18120c" stroke="#caa15a" strokeWidth="1.5" />
          <path d="M10,26 L28,14 L46,26 Z" fill="#caa15a" stroke="#f3ead7" strokeWidth="1.2" />
          <rect x="14" y="26" width="28" height="18" fill="#523f25" stroke="#e8c682" strokeWidth="1" />
          <circle cx="28" cy="35" r="5" fill="#e8c682" />
        </svg>
      );
    case 'shipyard':
      return (
        <svg viewBox="0 0 56 56" className={className}>
          <rect width="56" height="56" rx="10" fill="#18120c" stroke="#caa15a" strokeWidth="1.5" />
          <path d="M8,40 Q18,36 28,40 T48,40 L48,48 L8,48 Z" fill="#3b3123" />
          <path d="M14,35 L42,35 L37,42 L19,42 Z" fill="#8f6a34" stroke="#e8c682" strokeWidth="1.2" />
          <line x1="28" y1="12" x2="28" y2="35" stroke="#e8c682" strokeWidth="2" />
          <path d="M28,13 L42,27 L28,29 Z" fill="#f3ead7" stroke="#caa15a" strokeWidth="1" />
          <path d="M26,16 L16,28 L26,28 Z" fill="#d8cbb5" />
        </svg>
      );
    case 'mint':
    case 'capitalPalace':
      return (
        <svg viewBox="0 0 56 56" className={className}>
          <rect width="56" height="56" rx="10" fill="#18120c" stroke="#caa15a" strokeWidth="1.5" />
          <path d="M12,24 L28,12 L44,24 Z" fill="#caa15a" stroke="#f3ead7" strokeWidth="1.2" />
          <rect x="14" y="24" width="28" height="20" fill="#4a3922" stroke="#e8c682" strokeWidth="1" />
          <circle cx="28" cy="34" r="7" fill="#e0b86e" stroke="#f3ead7" strokeWidth="1.5" />
          <text x="28" y="37.5" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#14100c">A</text>
        </svg>
      );
    case 'granary':
      return (
        <svg viewBox="0 0 56 56" className={className}>
          <rect width="56" height="56" rx="10" fill="#18120c" stroke="#caa15a" strokeWidth="1.5" />
          <path d="M16,26 Q28,10 40,26 Z" fill="#b89146" stroke="#f3ead7" strokeWidth="1.2" />
          <rect x="16" y="26" width="24" height="18" fill="#544228" stroke="#e8c682" strokeWidth="1" />
          <path d="M10,44 L46,44" stroke="#caa15a" strokeWidth="2.5" />
          <path d="M28,29 L28,41 M24,33 L32,33" stroke="#f3ead7" strokeWidth="1.8" />
        </svg>
      );
    case 'supplyDepot':
    default:
      return (
        <svg viewBox="0 0 56 56" className={className}>
          <rect width="56" height="56" rx="10" fill="#18120c" stroke="#caa15a" strokeWidth="1.5" />
          <rect x="12" y="22" width="32" height="22" rx="3" fill="#463826" stroke="#e8c682" strokeWidth="1.2" />
          <line x1="12" y1="32" x2="44" y2="32" stroke="#e8c682" strokeWidth="1.5" />
          <line x1="28" y1="22" x2="28" y2="44" stroke="#e8c682" strokeWidth="1.5" />
        </svg>
      );
  }
};

/**
 * AoH3-Style Illustrated Commander / Pasha / Clan Lord Crest Portrait — Fixed Obsidian & Gold Palette
 */
export const CommanderPortraitSvg: React.FC<{
  specialty: 'OFFENSE' | 'DEFENSE' | 'LOGISTICS' | 'ARMOR';
  loyalty?: number;
  className?: string;
}> = ({ specialty, loyalty = 85, className = 'w-11 h-11' }) => {
  const helmTone =
    specialty === 'OFFENSE'
      ? '#e0b86e'
      : specialty === 'DEFENSE'
      ? '#d8cbb5'
      : '#caa15a';

  return (
    <svg viewBox="0 0 56 56" className={className}>
      <rect width="56" height="56" rx="12" fill="#18130d" stroke="#caa15a" strokeWidth="1.8" />
      <path d="M10,52 Q28,36 46,52 Z" fill="#caa15a" fillOpacity="0.32" />
      <path d="M18,26 Q28,10 38,26 Z" fill={helmTone} />
      <circle cx="28" cy="14" r="2.4" fill="#f3ead7" />
      <rect x="21" y="25" width="14" height="11" rx="4" fill="#c5b79e" />
      <line x1="28" y1="24" x2="28" y2="36" stroke="#2a2117" strokeWidth="1.8" />
      <circle
        cx="46"
        cy="10"
        r="4.2"
        fill={loyalty < 45 ? '#e11d48' : loyalty < 70 ? '#e0b86e' : '#34d399'}
        stroke="#0e0b08"
        strokeWidth="1.2"
      />
    </svg>
  );
};
