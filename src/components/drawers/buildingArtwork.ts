import { BuildingType, UnitType } from '../../types/game';
import { SpecialtyProductionId } from '../../engine/empireAndArmyActions';
import { TECH_ARTWORK_MAP, TechArtworkAsset } from './techArtwork';

import bldBarracksGarrison from '../../assets/images/bld_barracks_garrison_1795623057346.jpg';
import bldMadrasaAcademy from '../../assets/images/bld_madrasa_academy_1795623061411.jpg';
import bldShipyardHarbor from '../../assets/images/bld_shipyard_harbor_1795623065246.jpg';
import bldFoundryWorkshop from '../../assets/images/bld_foundry_workshop_1795623059165.jpg';
import bldGranarySupply from '../../assets/images/bld_granary_supply_1795623059617.jpg';

import unitEra1MedievalInfantry from '../../assets/images/unit_era1_medieval_infantry_1795830738797.jpg';
import unitEra1MedievalCavalry from '../../assets/images/floda_loading_cavalry_charge_1795459893299.jpg';
import unitEra1MedievalSiege from '../../assets/images/floda_loading_siege_bastion_1795459892243.jpg';
import unitEra2GunpowderSipahi from '../../assets/images/unit_era2_gunpowder_sipahi_1795830740837.jpg';
import unitEra3IndustrialInfantry from '../../assets/images/unit_era3_industrial_infantry_1795830743151.jpg';
import unitEra3MechanizedTank from '../../assets/images/unit_era3_mechanized_tank_1795830742883.jpg';
import unitEra3FieldArtillery from '../../assets/images/unit_era3_field_artillery_1795830744154.jpg';
import unitEra4ModernCommando from '../../assets/images/unit_era4_modern_commando_clean_1795830770768.jpg';
import unitEra4ModernMbt from '../../assets/images/unit_era4_modern_mbt_1795830746627.jpg';
import unitEra4ModernUcav from '../../assets/images/unit_era4_modern_ucav_1795830747226.jpg';

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

export type UnitVisualEraIndex = 0 | 1 | 2 | 3;

export const UNIT_ERA_ARTWORK: Record<
  UnitVisualEraIndex,
  Record<UnitType | 'MIXED', TechArtworkAsset>
> = {
  // Era 0: Medieval & Classical (1440 Tier 0-1: Kılıç/Okçu Piyade, Akıncı Süvari, Mancınık/Darbzen)
  0: {
    infantry: {
      src: unitEra1MedievalInfantry,
      fallbackGradient: 'linear-gradient(135deg, #3b2316 0%, #6c4128 55%, #19120e 100%)',
      objectPosition: 'center 38%',
    },
    armor: {
      src: unitEra1MedievalCavalry,
      fallbackGradient: 'linear-gradient(135deg, #432218 0%, #7c3b24 55%, #1a110e 100%)',
      objectPosition: 'center 42%',
    },
    airDrone: {
      src: unitEra1MedievalSiege,
      fallbackGradient: 'linear-gradient(135deg, #35271d 0%, #634833 55%, #17120e 100%)',
      objectPosition: 'center 45%',
    },
    MIXED: BESPOKE_BUILDING_ART.BARRACKS,
  },
  // Era 1: Gunpowder & Nizam-ı Cedid (1440 Tier 2-4: Tüfekli Yeniçeri, Zırhlı Sipahi, Şahi Kuşatma Topu)
  1: {
    infantry: TECH_ARTWORK_MAP.INFANTRY,
    armor: {
      src: unitEra2GunpowderSipahi,
      fallbackGradient: 'linear-gradient(135deg, #471d18 0%, #863626 55%, #1b100e 100%)',
      objectPosition: 'center 38%',
    },
    airDrone: TECH_ARTWORK_MAP.ARTILLERY,
    MIXED: TECH_ARTWORK_MAP.INFANTRY,
  },
  // Era 2: Industrial & Mechanized Warfare (1440 Tier 5-6 / 2026 Tier 0-1: Mavzerli Piyade, Zırhlı Tank, Sahra Obüsü)
  2: {
    infantry: {
      src: unitEra3IndustrialInfantry,
      fallbackGradient: 'linear-gradient(135deg, #1f2b27 0%, #3d5249 55%, #111614 100%)',
      objectPosition: 'center 36%',
    },
    armor: {
      src: unitEra3MechanizedTank,
      fallbackGradient: 'linear-gradient(135deg, #2b291f 0%, #565039 55%, #151410 100%)',
      objectPosition: 'center 46%',
    },
    airDrone: {
      src: unitEra3FieldArtillery,
      fallbackGradient: 'linear-gradient(135deg, #38251a 0%, #6f472d 55%, #18120e 100%)',
      objectPosition: 'center 44%',
    },
    MIXED: {
      src: unitEra3MechanizedTank,
      fallbackGradient: 'linear-gradient(135deg, #2b291f 0%, #565039 55%, #151410 100%)',
      objectPosition: 'center 46%',
    },
  },
  // Era 3: Modern Digital & Autonomous Warfare (1440 Tier 7 / 2026 Tier 2-7: Modern Komando, AMT Tank, SİHA & Füze)
  3: {
    infantry: {
      src: unitEra4ModernCommando,
      fallbackGradient: 'linear-gradient(135deg, #162936 0%, #2b5068 55%, #0e161c 100%)',
      objectPosition: 'center 38%',
    },
    armor: {
      src: unitEra4ModernMbt,
      fallbackGradient: 'linear-gradient(135deg, #2c2419 0%, #5d4a31 55%, #14110c 100%)',
      objectPosition: 'center 45%',
    },
    airDrone: {
      src: unitEra4ModernUcav,
      fallbackGradient: 'linear-gradient(135deg, #172338 0%, #2f4870 55%, #0e131d 100%)',
      objectPosition: 'center 42%',
    },
    MIXED: {
      src: unitEra4ModernMbt,
      fallbackGradient: 'linear-gradient(135deg, #2c2419 0%, #5d4a31 55%, #14110c 100%)',
      objectPosition: 'center 45%',
    },
  },
};

export function resolveUnitVisualEraIndex(
  gameMode: string = 'EMPIRES_1440',
  tier: number = 0
): UnitVisualEraIndex {
  const safeTier = Math.max(0, Math.min(7, Math.floor(tier || 0)));
  if (gameMode !== 'EMPIRES_1440') {
    return safeTier <= 1 ? 2 : 3;
  }
  if (safeTier <= 1) return 0;
  if (safeTier <= 4) return 1;
  if (safeTier <= 6) return 2;
  return 3;
}

export function getUnitVisualEraLabel(
  gameMode: string = 'EMPIRES_1440',
  tier: number = 0
): string {
  const eraIdx = resolveUnitVisualEraIndex(gameMode, tier);
  if (eraIdx === 0) return 'Klasik Çağ';
  if (eraIdx === 1) return 'Barut Çağı';
  if (eraIdx === 2) return 'Sanayi Çağı';
  return 'Modern Çağ';
}

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
> = UNIT_ERA_ARTWORK[0];

export function getBuildingArtwork(building: BuildingType): TechArtworkAsset {
  return BUILDING_ARTWORK_MAP[building] || BESPOKE_BUILDING_ART.FOUNDRY;
}

export function getSpecialtyArtwork(
  specialtyId: Exclude<SpecialtyProductionId, 'AUTO_NATURAL'>
): TechArtworkAsset {
  return SPECIALTY_ARTWORK_MAP[specialtyId] || BESPOKE_BUILDING_ART.FOUNDRY;
}

export function getRecruitUnitArtwork(
  unitMode: UnitType | 'MIXED',
  gameMode: string = 'EMPIRES_1440',
  tier: number = 0
): TechArtworkAsset {
  const eraIdx = resolveUnitVisualEraIndex(gameMode, tier);
  const eraMap = UNIT_ERA_ARTWORK[eraIdx] || UNIT_ERA_ARTWORK[0];
  return eraMap[unitMode] || eraMap.infantry;
}

// Eagerly preload bespoke architectural & unit era paintings so iOS Safari paints immediately inside scroll containers.
const preloadedBuildingArtwork: HTMLImageElement[] = [];
if (typeof window !== 'undefined' && typeof Image !== 'undefined') {
  const allAssets: TechArtworkAsset[] = [
    ...Object.values(BESPOKE_BUILDING_ART),
    ...Object.values(UNIT_ERA_ARTWORK).flatMap((m) => Object.values(m)),
  ];
  const seenSrc = new Set<string>();
  allAssets.forEach((asset) => {
    if (!asset?.src || seenSrc.has(asset.src)) return;
    seenSrc.add(asset.src);
    const img = new Image();
    img.decoding = 'sync';
    img.src = asset.src;
    preloadedBuildingArtwork.push(img);
    img.decode?.().catch(() => undefined);
  });
}
