import { BuildingType, UnitType } from '../../types/game';
import { SpecialtyProductionId } from '../../engine/empireAndArmyActions';
import { TECH_ARTWORK_MAP, TechArtworkAsset } from './techArtwork';

import bldBarracksGarrison from '../../assets/images/bld_barracks_garrison_1795623057346.jpg';
import bldMadrasaAcademy from '../../assets/images/bld_madrasa_academy_1795623061411.jpg';
import bldShipyardHarbor from '../../assets/images/bld_shipyard_harbor_1795623065246.jpg';
import bldFoundryWorkshop from '../../assets/images/bld_foundry_workshop_1795623059165.jpg';
import bldGranarySupply from '../../assets/images/bld_granary_supply_1795623059617.jpg';

const BESPOKE_BUILDING_ART: Record<
  'BARRACKS' | 'MADRASA' | 'SHIPYARD' | 'FOUNDRY' | 'GRANARY',
  TechArtworkAsset
> = {
  BARRACKS: {
    src: bldBarracksGarrison,
    fallbackGradient: 'linear-gradient(135deg, #3b1719 0%, #6b2628 55%, #1d120f 100%)',
    objectPosition: 'center 42%',
  },
  MADRASA: {
    src: bldMadrasaAcademy,
    fallbackGradient: 'linear-gradient(135deg, #162e3c 0%, #2a5a6e 55%, #10171d 100%)',
    objectPosition: 'center 38%',
  },
  SHIPYARD: {
    src: bldShipyardHarbor,
    fallbackGradient: 'linear-gradient(135deg, #13283c 0%, #234966 55%, #101720 100%)',
    objectPosition: 'center 52%',
  },
  FOUNDRY: {
    src: bldFoundryWorkshop,
    fallbackGradient: 'linear-gradient(135deg, #3f2112 0%, #7d401b 55%, #1b120d 100%)',
    objectPosition: 'center 46%',
  },
  GRANARY: {
    src: bldGranarySupply,
    fallbackGradient: 'linear-gradient(135deg, #2d3417 0%, #636b28 55%, #17180d 100%)',
    objectPosition: 'center 45%',
  },
};

export const BUILDING_ARTWORK_MAP: Record<BuildingType, TechArtworkAsset> = {
  factory: BESPOKE_BUILDING_ART.FOUNDRY,
  barracks: BESPOKE_BUILDING_ART.BARRACKS,
  armyHearth: TECH_ARTWORK_MAP.INFANTRY,
  fortress: TECH_ARTWORK_MAP.FORTRESS,
  school: BESPOKE_BUILDING_ART.MADRASA,
  highSchool: TECH_ARTWORK_MAP.ENGINEERING,
  university: TECH_ARTWORK_MAP.OBSERVATORY,
  capitalPalace: TECH_ARTWORK_MAP.COURT,
  tradeHub: TECH_ARTWORK_MAP.TRADE,
  supplyDepot: BESPOKE_BUILDING_ART.GRANARY,
  shipyard: BESPOKE_BUILDING_ART.SHIPYARD,
  mint: TECH_ARTWORK_MAP.TREASURY,
  granary: TECH_ARTWORK_MAP.AGRICULTURE,
};

export const SPECIALTY_ARTWORK_MAP: Record<
  Exclude<SpecialtyProductionId, 'AUTO_NATURAL'>,
  TechArtworkAsset
> = {
  SIGIR_FARM: BESPOKE_BUILDING_ART.GRANARY,
  PAMUK_FIELD: TECH_ARTWORK_MAP.TRADE,
  KERESTE_MILL: BESPOKE_BUILDING_ART.FOUNDRY,
  TAHIL_GRANARY: TECH_ARTWORK_MAP.AGRICULTURE,
  DEMIR_FOUNDRY: BESPOKE_BUILDING_ART.FOUNDRY,
  ALTIN_MINT: TECH_ARTWORK_MAP.TREASURY,
  PETROL_REFINERY: TECH_ARTWORK_MAP.ENGINEERING,
  DOGALGAZ_PLANT: TECH_ARTWORK_MAP.ENGINEERING,
  TICARET_PORT: BESPOKE_BUILDING_ART.SHIPYARD,
  FINANS_EXCHANGE: TECH_ARTWORK_MAP.COURT,
  YARI_ILETKEN_FAB: TECH_ARTWORK_MAP.OBSERVATORY,
  NADIR_TOPRAK_MINE: TECH_ARTWORK_MAP.TREASURY,
};

export const RECRUIT_UNIT_ARTWORK_MAP: Record<
  UnitType | 'MIXED',
  TechArtworkAsset
> = {
  infantry: TECH_ARTWORK_MAP.INFANTRY,
  armor: BESPOKE_BUILDING_ART.BARRACKS,
  airDrone: TECH_ARTWORK_MAP.ARTILLERY,
  MIXED: BESPOKE_BUILDING_ART.BARRACKS,
};

export function getBuildingArtwork(building: BuildingType): TechArtworkAsset {
  return BUILDING_ARTWORK_MAP[building] || BESPOKE_BUILDING_ART.FOUNDRY;
}

export function getSpecialtyArtwork(
  specialtyId: Exclude<SpecialtyProductionId, 'AUTO_NATURAL'>
): TechArtworkAsset {
  return SPECIALTY_ARTWORK_MAP[specialtyId] || BESPOKE_BUILDING_ART.FOUNDRY;
}

export function getRecruitUnitArtwork(
  unitMode: UnitType | 'MIXED'
): TechArtworkAsset {
  return RECRUIT_UNIT_ARTWORK_MAP[unitMode] || TECH_ARTWORK_MAP.INFANTRY;
}

// Eagerly preload bespoke architectural paintings so iOS Safari paints immediately inside scroll containers.
const preloadedBuildingArtwork: HTMLImageElement[] = [];
if (typeof window !== 'undefined' && typeof Image !== 'undefined') {
  Object.values(BESPOKE_BUILDING_ART).forEach((asset) => {
    const img = new Image();
    img.decoding = 'sync';
    img.src = asset.src;
    preloadedBuildingArtwork.push(img);
    img.decode?.().catch(() => undefined);
  });
}
