import { TechArtKey, TechBranch } from '../../types/game';
import techInfantryRanks from '../../assets/images/tech_infantry_ranks_1795539777334.jpg';
import techSiegeArtillery from '../../assets/images/tech_siege_artillery_1795539777331.jpg';
import techNavalArmada from '../../assets/images/tech_naval_armada_1795539777741.jpg';
import techCitadelFortress from '../../assets/images/tech_citadel_fortress_1795539778067.jpg';
import techTreasuryMint from '../../assets/images/tech_treasury_mint_1795539777459.jpg';
import techSilkTrade from '../../assets/images/tech_silk_trade_1795539777531.jpg';
import techAgricultureHarvest from '../../assets/images/tech_agriculture_harvest_1795539778585.jpg';
import techImperialCourt from '../../assets/images/tech_imperial_court_1795539777929.jpg';
import techObservatoryScience from '../../assets/images/tech_observatory_science_1795539778908.jpg';
import techEngineeringPress from '../../assets/images/tech_engineering_press_1795539778099.jpg';

export interface TechArtworkAsset {
  src: string;
  fallbackGradient: string;
  objectPosition: string;
}

export const TECH_ARTWORK_MAP: Record<TechArtKey, TechArtworkAsset> = {
  INFANTRY: {
    src: techInfantryRanks,
    fallbackGradient: 'linear-gradient(135deg, #3b1719 0%, #6b2628 55%, #1d120f 100%)',
    objectPosition: 'center 32%',
  },
  ARTILLERY: {
    src: techSiegeArtillery,
    fallbackGradient: 'linear-gradient(135deg, #431c15 0%, #7d361d 55%, #1c1310 100%)',
    objectPosition: 'center 42%',
  },
  NAVAL: {
    src: techNavalArmada,
    fallbackGradient: 'linear-gradient(135deg, #13283c 0%, #234966 55%, #101720 100%)',
    objectPosition: 'center 45%',
  },
  FORTRESS: {
    src: techCitadelFortress,
    fallbackGradient: 'linear-gradient(135deg, #2d2621 0%, #57493a 55%, #171310 100%)',
    objectPosition: 'center 38%',
  },
  TREASURY: {
    src: techTreasuryMint,
    fallbackGradient: 'linear-gradient(135deg, #3d2c12 0%, #785620 55%, #1b140c 100%)',
    objectPosition: 'center 46%',
  },
  TRADE: {
    src: techSilkTrade,
    fallbackGradient: 'linear-gradient(135deg, #3a2716 0%, #6f4a24 55%, #1b140d 100%)',
    objectPosition: 'center 42%',
  },
  AGRICULTURE: {
    src: techAgricultureHarvest,
    fallbackGradient: 'linear-gradient(135deg, #2d3417 0%, #5c6626 55%, #16180d 100%)',
    objectPosition: 'center 45%',
  },
  COURT: {
    src: techImperialCourt,
    fallbackGradient: 'linear-gradient(135deg, #153129 0%, #245a49 55%, #101916 100%)',
    objectPosition: 'center 34%',
  },
  OBSERVATORY: {
    src: techObservatoryScience,
    fallbackGradient: 'linear-gradient(135deg, #12293a 0%, #21516c 55%, #0e161d 100%)',
    objectPosition: 'center 40%',
  },
  ENGINEERING: {
    src: techEngineeringPress,
    fallbackGradient: 'linear-gradient(135deg, #28241c 0%, #4e4532 55%, #14120e 100%)',
    objectPosition: 'center 44%',
  },
};

const BRANCH_DEFAULT_ART: Record<TechBranch, TechArtKey> = {
  MILITARY: 'INFANTRY',
  ECONOMY: 'TREASURY',
  ADMINISTRATION: 'COURT',
  SCIENCE: 'OBSERVATORY',
};

export function getTechArtwork(
  artKey?: TechArtKey,
  branch: TechBranch = 'SCIENCE'
): TechArtworkAsset {
  if (artKey && TECH_ARTWORK_MAP[artKey]) {
    return TECH_ARTWORK_MAP[artKey];
  }
  return TECH_ARTWORK_MAP[BRANCH_DEFAULT_ART[branch]];
}

// Eagerly preload and decode all local artwork so iOS Safari never delays painting inside scroll containers.
// References are kept at module scope so the images are not garbage-collected before they finish loading.
const preloadedTechArtwork: HTMLImageElement[] = [];
if (typeof window !== 'undefined' && typeof Image !== 'undefined') {
  Object.values(TECH_ARTWORK_MAP).forEach((asset) => {
    const img = new Image();
    img.decoding = 'sync';
    img.src = asset.src;
    preloadedTechArtwork.push(img);
    img.decode?.().catch(() => undefined);
  });
}
