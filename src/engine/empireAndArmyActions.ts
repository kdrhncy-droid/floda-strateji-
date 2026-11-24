import {
  ActiveBattle,
  ActiveWar,
  ArmyMovement,
  BuildingType,
  CrisisEventDefinition,
  CrisisEventOption,
  DiplomaticRelation,
  GameModeId,
  IdeologyId,
  Nation,
  PendingWarMoveRequest,
  ReligionId,
  SeaArmy,
  SpeedLevel,
  Territory,
  UnitType,
  WorldNewsEvent,
} from '../types/game';
import { RELIGIONS, resolveTerritoryReligion } from '../data/religionAndCultureData';
import {
  BUILDINGS,
  COMMANDERS,
  FORMABLE_EMPIRES,
  IDEOLOGIES,
  calculateArmyModernizationCost,
  getArmyGenerationInfo,
  getNationModernizedTier,
  getNationUnlockedMilTier,
  getReformsForMode,
  getTechTreeForMode,
} from '../data/world2026Data';
import {
  adjustAggressiveExpansionGain,
  calculateNationEconomy,
  formatGameDate,
  getOrCreateRelation,
  isAtWar,
  resolveSeaRegionName,
  resolveWarParticipants,
} from './simulationEngine';
import { isTerritoryCoastal, relationKey } from './worldBuilder';
import {
  DEFAULT_LORD_LOYALTY,
  getLordRetinueTroops,
} from './pashaAndFiefEngine';
import { findArmyRouteAStar } from './pathfindingEngine';
import { evaluateWartimeAiOperations } from './aiAndRebellionEngine';
import { scaleUnits } from './core/unitHelpers';
import { sound } from '../utils/soundEngine';

export interface EmpireActionPatch {
  nations?: Record<string, Nation>;
  relations?: Record<string, DiplomaticRelation>;
  territories?: Record<string, Territory>;
  wars?: ActiveWar[];
  movements?: ArmyMovement[];
  seaArmies?: SeaArmy[];
  newsEvents?: WorldNewsEvent[];
  activeCrisis?: CrisisEventDefinition | null;
  armyOrderSourceId?: string | null;
  selectedSeaArmyId?: string | null;
  seaArmyOrderSourceId?: string | null;
  pendingWarMove?: PendingWarMoveRequest | null;
  speed?: SpeedLevel;
  toastMessage?: string;
}

export function resolveCrisisDomain(params: {
  option: CrisisEventOption;
  nations: Record<string, Nation>;
  territories: Record<string, Territory>;
  playerNationId: string;
  activeCrisis: CrisisEventDefinition | null;
  tick: number;
  gameMode: GameModeId;
  newsEvents: WorldNewsEvent[];
}): EmpireActionPatch {
  const {
    option,
    nations,
    territories,
    playerNationId,
    activeCrisis,
    tick,
    gameMode,
    newsEvents,
  } = params;
  const p = nations[playerNationId];
  if (!p) return {};

  const eff = option.effects;
  const nextNations: Record<string, Nation> = {
    ...nations,
    [playerNationId]: {
      ...p,
      treasury: Math.max(0, p.treasury + (eff.treasuryDelta || 0)),
      manpower: Math.max(0, p.manpower + (eff.manpowerDelta || 0)),
      stability: Math.max(
        0,
        Math.min(100, p.stability + (eff.stabilityDelta || 0))
      ),
      inflation: Math.max(
        0.5,
        Math.min(
          65,
          Number((p.inflation + (eff.inflationDelta || 0)).toFixed(2))
        )
      ),
      researchPoints: Math.max(
        0,
        Number((p.researchPoints + (eff.researchDelta || 0)).toFixed(1))
      ),
      aggressiveExpansion: Math.max(
        0,
        Math.min(
          100,
          p.aggressiveExpansion + adjustAggressiveExpansionGain(p, eff.aeDelta || 0)
        )
      ),
    },
  };

  let nextTerritories = territories;
  if (eff.garrisonBonus) {
    const capId = p.capitalTerritoryId;
    const cap = territories[capId];
    if (cap) {
      nextTerritories = {
        ...territories,
        [capId]: {
          ...cap,
          garrison: cap.garrison + eff.garrisonBonus,
          units: {
            ...cap.units,
            infantry: cap.units.infantry + eff.garrisonBonus,
          },
        },
      };
    }
  }

  const nextNews = activeCrisis
    ? [
        {
          id: `news_${Date.now()}_crisis`,
          tick,
          dateStr: formatGameDate(tick, gameMode),
          title: `Kabine Kararı: ${activeCrisis.title}`,
          description: `${p.name} hükümeti "${option.label}" kararını yürürlüğe koydu (${option.effectSummary}).`,
          type: 'ECONOMY' as const,
        },
        ...newsEvents.slice(0, 39),
      ]
    : newsEvents;

  return {
    nations: nextNations,
    territories: nextTerritories,
    newsEvents: nextNews,
    activeCrisis: null,
    toastMessage: `Kabine kararı uygulandı: ${option.effectSummary}`,
  };
}

export function recruitUnitDomain(params: {
  territoryId: string;
  unitType: UnitType;
  amount: number;
  baseGoldCost: number;
  territories: Record<string, Territory>;
  nations: Record<string, Nation>;
  playerNationId: string;
}): EmpireActionPatch {
  const {
    territoryId,
    unitType,
    amount,
    baseGoldCost,
    territories,
    nations,
    playerNationId,
  } = params;
  const t = territories[territoryId];
  const p = nations[playerNationId];
  if (!t || !p || t.ownerId !== playerNationId) return {};

  let discount = p.enactedReforms.includes('ref_national_defense_industry')
    ? 0.8
    : 1.0;
  if (p.unlockedTechs?.includes('mil_4b')) {
    discount *= 0.9;
  }
  const goldCost = Math.round(baseGoldCost * discount);

  if (p.treasury < goldCost) {
    return { toastMessage: `Yetersiz hazine! (${goldCost} Altın gerekli)` };
  }
  if (p.manpower < amount) {
    return {
      toastMessage: `Yetersiz insan gücü! (${amount.toLocaleString('tr-TR')} gerekli)`,
    };
  }

  sound.playBuild();
  const currentUnits = t.units || {
    infantry: t.garrison,
    armor: 0,
    airDrone: 0,
  };
  const unitNames: Record<UnitType, string> = {
    infantry: 'Piyade Tümeni',
    armor: 'Zırhlı Tugay',
    airDrone: 'SİHA & Hava Filosu',
  };

  return {
    nations: {
      ...nations,
      [playerNationId]: {
        ...p,
        treasury: p.treasury - goldCost,
        manpower: p.manpower - amount,
      },
    },
    territories: {
      ...territories,
      [territoryId]: {
        ...t,
        garrison: t.garrison + amount,
        units: {
          ...currentUnits,
          [unitType]: currentUnits[unitType] + amount,
        },
      },
    },
    toastMessage: `${t.name}: +${amount.toLocaleString('tr-TR')} ${unitNames[unitType]} orduya katıldı.`,
  };
}

export interface MercenaryCompanyDef {
  id: string;
  name: string;
  historicalName: string;
  modernName: string;
  icon: string;
  troops: number;
  composition: {
    infantry: number;
    armor: number;
    airDrone: number;
  };
  costGold: number;
  tagline: string;
}

export const MERCENARY_COMPANIES: ReadonlyArray<MercenaryCompanyDef> = [
  {
    id: 'merc_vanguard',
    name: 'Sınır Akıncı & Öncü Bölüğü',
    historicalName: 'Rumeli Akıncı & Azeb Bölüğü',
    modernName: 'Taktik Sınır Güvenlik Grubu',
    icon: '⚔️',
    troops: 2500,
    composition: { infantry: 1900, armor: 600, airDrone: 0 },
    costGold: 420,
    tagline: 'İnsan gücü (İG) harcamadan anında cepheye katılan hızlı vurucu birlik.',
  },
  {
    id: 'merc_pikemen',
    name: 'Zırhlı Mızraklı & Tüfekçi Alayı',
    historicalName: 'İsviçre Mızraklı & Ceneviz Arbalet Alayı',
    modernName: 'Zırhlı Mekanize Paralı Tugay',
    icon: '🛡️',
    troops: 5000,
    composition: { infantry: 3400, armor: 1200, airDrone: 400 },
    costGold: 820,
    tagline: 'Yüksek savunma ve cephe yarma gücüne sahip profesyonel kiralık alay.',
  },
  {
    id: 'merc_siege_corps',
    name: 'Büyük Kuşatma & Topçu Ordusu',
    historicalName: 'Macar & Venedik Kuşatma Topçu Kolordusu',
    modernName: 'Ağır Topçu & SİHA Destekli Özel Kolordu',
    icon: '💣',
    troops: 9000,
    composition: { infantry: 5200, armor: 2200, airDrone: 1600 },
    costGold: 1450,
    tagline: 'Kaleleri ve ağır tahkimatları yıkmak için kiralanan tam teşekküllü paralı ordu.',
  },
];

export function hireMercenaryDomain(params: {
  territoryId: string;
  companyId: string;
  territories: Record<string, Territory>;
  nations: Record<string, Nation>;
  playerNationId: string;
  gameMode?: GameModeId;
}): EmpireActionPatch {
  const {
    territoryId,
    companyId,
    territories,
    nations,
    playerNationId,
    gameMode = 'EMPIRES_1440',
  } = params;
  const t = territories[territoryId];
  const p = nations[playerNationId];
  const company = MERCENARY_COMPANIES.find((c) => c.id === companyId);
  if (!t || !p || !company || t.ownerId !== playerNationId) return {};

  if (p.treasury < company.costGold) {
    return {
      toastMessage: `Paralı asker kiralamak için yeterli altın yok! (${company.costGold.toLocaleString('tr-TR')} Altın gerekli)`,
    };
  }

  sound.playWarHorn();
  const currentUnits = t.units || {
    infantry: t.garrison,
    armor: 0,
    airDrone: 0,
  };
  const displayName =
    gameMode === 'EMPIRES_1440' ? company.historicalName : company.modernName;

  return {
    nations: {
      ...nations,
      [playerNationId]: {
        ...p,
        treasury: p.treasury - company.costGold,
      },
    },
    territories: {
      ...territories,
      [territoryId]: {
        ...t,
        garrison: t.garrison + company.troops,
        units: {
          infantry: currentUnits.infantry + company.composition.infantry,
          armor: currentUnits.armor + company.composition.armor,
          airDrone: currentUnits.airDrone + company.composition.airDrone,
        },
      },
    },
    toastMessage: `🪙 ${t.name}: ${displayName} (+${company.troops.toLocaleString('tr-TR')} paralı asker) kiralandı!`,
  };
}

export function recruitOrAssignGeneralDomain(params: {
  generalId: string;
  nations: Record<string, Nation>;
  playerNationId: string;
}): EmpireActionPatch {
  const { generalId, nations, playerNationId } = params;
  const p = nations[playerNationId];
  const cmd = COMMANDERS.find((c) => c.id === generalId);
  if (!p || !cmd) return {};

  if (p.recruitedGeneralIds?.includes(generalId)) {
    sound.playTreaty();
    return {
      nations: {
        ...nations,
        [playerNationId]: { ...p, activeGeneralId: generalId },
      },
      toastMessage: `${cmd.name} Başkomutan olarak göreve atandı.`,
    };
  }

  if (p.treasury < cmd.costGold) {
    return {
      toastMessage: `Komutan ataması için ${cmd.costGold} Altın gerekli.`,
    };
  }

  sound.playTreaty();
  return {
    nations: {
      ...nations,
      [playerNationId]: {
        ...p,
        treasury: p.treasury - cmd.costGold,
        recruitedGeneralIds: [...(p.recruitedGeneralIds || []), generalId],
        activeGeneralId: generalId,
        lordLoyalties: {
          ...(p.lordLoyalties || {}),
          [generalId]: DEFAULT_LORD_LOYALTY,
        },
      },
    },
    toastMessage: `${cmd.name} Kurmay Heyetine katıldı ve Başkomutan olarak atandı!`,
  };
}

export function upgradeBuildingDomain(params: {
  territoryId: string;
  building: BuildingType;
  territories: Record<string, Territory>;
  nations: Record<string, Nation>;
  playerNationId: string;
}): EmpireActionPatch {
  const { territoryId, building, territories, nations, playerNationId } =
    params;
  const t = territories[territoryId];
  const p = nations[playerNationId];
  if (!t || !p || t.ownerId !== playerNationId) return {};
  const def = BUILDINGS.find((b) => b.id === building);
  if (!def) return {};

  if (def.requiresCoastal && !isTerritoryCoastal(t)) {
    return {
      toastMessage: `⚓ ${def.name} yalnızca denize kıyısı olan şehirlerde kurulabilir!`,
    };
  }

  if (def.requiresCapital && !t.isCapital && t.id !== p.capitalTerritoryId) {
    return {
      toastMessage: `👑 ${def.name} yalnızca devletin Başkentinde inşa edilebilir!`,
    };
  }

  if (def.requiredTechId && !(p.unlockedTechs || []).includes(def.requiredTechId)) {
    const reqTech =
      getTechTreeForMode('EMPIRES_1440').find((tc) => tc.id === def.requiredTechId) ||
      getTechTreeForMode('STANDARD_2026').find((tc) => tc.id === def.requiredTechId);
    return {
      toastMessage: `🔬 ${def.name} inşası için önce "${reqTech?.shortTitle || reqTech?.name || def.requiredTechId}" teknolojisini araştırmalısınız!`,
    };
  }

  const currentLvl = t.buildings[building] || 0;
  if (currentLvl >= def.maxLevel) return {};

  const queue = t.constructionQueue || [];
  if (queue.some((q) => q.building === building)) {
    const existing = queue.find((q) => q.building === building);
    const pct = existing ? Math.round((existing.progressDays / existing.totalDays) * 100) : 0;
    return { toastMessage: `Bu binanın inşası zaten devam ediyor (%${pct} tamamlandı).` };
  }

  let buildCostMult = 1.0;
  if (p.unlockedTechs?.includes('eco_2b')) buildCostMult *= 0.88;
  if (p.unlockedTechs?.includes('adm_1b')) buildCostMult *= 0.9;
  if (p.unlockedTechs?.includes('sci_4b')) buildCostMult *= 0.85;
  if (p.unlockedTechs?.includes('sci_6b')) buildCostMult *= 0.9;
  const cost = Math.max(
    80,
    Math.round(def.baseCost * Math.pow(1.35, currentLvl) * buildCostMult)
  );
  if (p.treasury < cost) {
    return { toastMessage: `Yetersiz hazine! (${cost} Altın gerekli)` };
  }

  const baseBuildDays = Math.max(14, 18 + currentLvl * 14);
  const totalDays = p.unlockedTechs?.includes('adm_3b')
    ? Math.max(10, Math.round(baseBuildDays * 0.8))
    : baseBuildDays;

  sound.playBuild();
  return {
    nations: {
      ...nations,
      [playerNationId]: { ...p, treasury: p.treasury - cost },
    },
    territories: {
      ...territories,
      [territoryId]: {
        ...t,
        constructionQueue: [
          ...queue,
          {
            id: `${territoryId}-${building}-${Date.now()}`,
            building,
            targetLevel: currentLvl + 1,
            progressDays: 0,
            totalDays,
            goldCost: cost,
          },
        ],
      },
    },
    toastMessage: `${t.name}: ${def.name} Seviye ${currentLvl + 1} inşası başladı (${totalDays} Gün Sürecek).`,
  };
}

export type SpecialtyProductionId =
  | 'AUTO_NATURAL'
  | 'SIGIR_FARM'
  | 'PAMUK_FIELD'
  | 'KERESTE_MILL'
  | 'TAHIL_GRANARY'
  | 'DEMIR_FOUNDRY'
  | 'ALTIN_MINT'
  | 'PETROL_REFINERY'
  | 'DOGALGAZ_PLANT'
  | 'TICARET_PORT'
  | 'FINANS_EXCHANGE'
  | 'YARI_ILETKEN_FAB'
  | 'NADIR_TOPRAK_MINE';

export interface SpecialtyProductionOption {
  id: Exclude<SpecialtyProductionId, 'AUTO_NATURAL'>;
  name: string;
  shortName: string;
  icon: string;
  resource: Territory['resource'];
  buildingBoost: BuildingType;
  costGold: number;
  gdpBonus: number;
  buildDays: number;
  description: string;
}

export const SPECIALTY_PRODUCTION_OPTIONS: ReadonlyArray<SpecialtyProductionOption> = [
  {
    id: 'SIGIR_FARM',
    name: 'İnek & Sığır Çiftliği',
    shortName: 'İnek Çiftliği',
    icon: '🐄',
    resource: 'SIGIR',
    buildingBoost: 'supplyDepot',
    costGold: 350,
    gdpBonus: 14,
    buildDays: 10,
    description: 'Sığır & Hayvancılık kaynağı olan şehirlerde +1 İkmal/Mera seviyesi ve +14 üretim değeri sağlar (10 gün).',
  },
  {
    id: 'PAMUK_FIELD',
    name: 'Pamuk Tarlası & Dokuma',
    shortName: 'Pamuk Tarlası',
    icon: '🌿',
    resource: 'PAMUK',
    buildingBoost: 'factory',
    costGold: 420,
    gdpBonus: 18,
    buildDays: 13,
    description: 'Pamuk kaynağı olan şehirlerde +1 Sanayi/Dokuma seviyesi ve +18 üretim değeri sağlar (13 gün).',
  },
  {
    id: 'KERESTE_MILL',
    name: 'Kereste & Odun Ocağı',
    shortName: 'Kereste Ocağı',
    icon: '🪵',
    resource: 'KERESTE',
    buildingBoost: 'factory',
    costGold: 360,
    gdpBonus: 15,
    buildDays: 12,
    description: 'Kereste kaynağı olan şehirlerde +1 Sanayi/Atölye seviyesi ve +15 üretim değeri sağlar (12 gün).',
  },
  {
    id: 'TAHIL_GRANARY',
    name: 'Tahıl Tarlası & Sulama',
    shortName: 'Tahıl Tarlası',
    icon: '🌾',
    resource: 'TAHIL',
    buildingBoost: 'supplyDepot',
    costGold: 340,
    gdpBonus: 13,
    buildDays: 10,
    description: 'Tahıl kaynağı olan şehirlerde +1 Erzak Ambarı seviyesi ve +13 üretim değeri sağlar (10 gün).',
  },
  {
    id: 'DEMIR_FOUNDRY',
    name: 'Demir & Çelik Dökümhanesi',
    shortName: 'Demir Ocağı',
    icon: '⛏',
    resource: 'DEMIR_CELIK',
    buildingBoost: 'factory',
    costGold: 450,
    gdpBonus: 20,
    buildDays: 14,
    description: 'Demir-Çelik kaynağı olan şehirlerde +1 Sanayi seviyesi ve +20 üretim değeri sağlar (14 gün).',
  },
  {
    id: 'ALTIN_MINT',
    name: 'Altın Madeni & Darphane',
    shortName: 'Altın Ocağı',
    icon: '🪙',
    resource: 'ALTIN',
    buildingBoost: 'tradeHub',
    costGold: 480,
    gdpBonus: 22,
    buildDays: 16,
    description: 'Altın kaynağı olan şehirlerde +1 Ticaret Merkezi seviyesi ve +22 üretim değeri sağlar (16 gün).',
  },
  {
    id: 'PETROL_REFINERY',
    name: 'Petrol & Enerji Rafinerisi',
    shortName: 'Rafineri',
    icon: '🛢',
    resource: 'PETROL',
    buildingBoost: 'factory',
    costGold: 520,
    gdpBonus: 25,
    buildDays: 18,
    description: 'Petrol kaynağı olan şehirlerde +1 Sanayi seviyesi ve +25 üretim değeri sağlar (18 gün).',
  },
  {
    id: 'DOGALGAZ_PLANT',
    name: 'Doğalgaz & Enerji Santrali',
    shortName: 'Doğalgaz Tesisi',
    icon: '🔥',
    resource: 'DOGALGAZ',
    buildingBoost: 'factory',
    costGold: 490,
    gdpBonus: 23,
    buildDays: 16,
    description: 'Doğalgaz kaynağı olan şehirlerde +1 Sanayi seviyesi ve +23 üretim değeri sağlar (16 gün).',
  },
  {
    id: 'TICARET_PORT',
    name: 'Ticaret Limanı & Kervansaray',
    shortName: 'Ticaret Limanı',
    icon: '⚓',
    resource: 'TICARET_BOGAZI',
    buildingBoost: 'tradeHub',
    costGold: 460,
    gdpBonus: 21,
    buildDays: 15,
    description: 'Ticaret Boğazı/Limanı kaynağı olan şehirlerde +1 Ticaret Merkezi ve +21 üretim değeri sağlar (15 gün).',
  },
  {
    id: 'FINANS_EXCHANGE',
    name: 'Bedesten & Finans Merkezi',
    shortName: 'Bedesten / Finans',
    icon: '🏛️',
    resource: 'FINANS_MERKEZI',
    buildingBoost: 'tradeHub',
    costGold: 470,
    gdpBonus: 22,
    buildDays: 15,
    description: 'Finans/Bedesten kaynağı olan şehirlerde +1 Ticaret Merkezi ve +22 üretim değeri sağlar (15 gün).',
  },
  {
    id: 'YARI_ILETKEN_FAB',
    name: 'İleri Teknoloji & Zanaat Külliyesi',
    shortName: 'Zanaat Külliyesi',
    icon: '🔬',
    resource: 'YARI_ILETKEN',
    buildingBoost: 'university',
    costGold: 500,
    gdpBonus: 24,
    buildDays: 18,
    description: 'İleri Zanaat/Teknoloji kaynağı olan şehirlerde +1 Akademi/Ar-Ge ve +24 üretim değeri sağlar (18 gün).',
  },
  {
    id: 'NADIR_TOPRAK_MINE',
    name: 'Nadir Maden & Cevher İşletmesi',
    shortName: 'Cevher Ocağı',
    icon: '💎',
    resource: 'NADIR_TOPRAK',
    buildingBoost: 'factory',
    costGold: 500,
    gdpBonus: 23,
    buildDays: 17,
    description: 'Nadir Maden kaynağı olan şehirlerde +1 Sanayi seviyesi ve +23 üretim değeri sağlar (17 gün).',
  },
];

export function getSpecialtyOptionForResource(
  resource: Territory['resource']
): SpecialtyProductionOption {
  return (
    SPECIALTY_PRODUCTION_OPTIONS.find((o) => o.resource === resource) ||
    SPECIALTY_PRODUCTION_OPTIONS[3]
  );
}

export function getSpecialtyTerritoryEligibility(
  territory: Territory,
  option: SpecialtyProductionOption
): { eligible: boolean; reason: 'OK' | 'MAXED' | 'IN_PROGRESS'; currentLvl: number; maxLvl: number } {
  const bDef = BUILDINGS.find((b) => b.id === option.buildingBoost);
  const maxLvl = bDef?.maxLevel ?? 5;
  const currentLvl = territory.buildings?.[option.buildingBoost] || 0;
  const queue = territory.constructionQueue || [];
  const hasQueuedSame = queue.some((q) => q.building === option.buildingBoost);

  if (currentLvl >= maxLvl) {
    return { eligible: false, reason: 'MAXED', currentLvl, maxLvl };
  }
  if (hasQueuedSame) {
    return { eligible: false, reason: 'IN_PROGRESS', currentLvl, maxLvl };
  }
  return { eligible: true, reason: 'OK', currentLvl, maxLvl };
}

export function investSpecialtyProductionDomain(params: {
  territoryIds: string[];
  specialtyId: SpecialtyProductionId;
  territories: Record<string, Territory>;
  nations: Record<string, Nation>;
  playerNationId: string;
}): EmpireActionPatch {
  const { territoryIds, specialtyId, territories, nations, playerNationId } = params;
  const p = nations[playerNationId];
  if (!p) return {};

  const validTerrs = Array.from(new Set(territoryIds))
    .map((id) => territories[id])
    .filter((t): t is Territory => Boolean(t && t.ownerId === playerNationId));

  if (validTerrs.length === 0) {
    return {
      toastMessage: 'Önce haritadan yatırım yapılacak kendi şehirlerinizi seçin.',
    };
  }

  let candidateEntries: { territory: Territory; option: SpecialtyProductionOption }[] = [];

  if (specialtyId === 'AUTO_NATURAL') {
    candidateEntries = validTerrs.map((t) => ({
      territory: t,
      option: getSpecialtyOptionForResource(t.resource),
    }));
  } else {
    const opt = SPECIALTY_PRODUCTION_OPTIONS.find((o) => o.id === specialtyId);
    if (!opt) return {};
    const matchingTerrs = validTerrs.filter((t) => t.resource === opt.resource);
    if (matchingTerrs.length === 0) {
      return {
        toastMessage: `🛑 Seçili şehirlerde ${opt.shortName} doğal kaynağı bulunmuyor! Yalnızca şehirde var olan kaynaklara yatırım yapılabilir.`,
      };
    }
    candidateEntries = matchingTerrs.map((t) => ({
      territory: t,
      option: opt,
    }));
  }

  const targetEntries: {
    territory: Territory;
    option: SpecialtyProductionOption;
    targetLevel: number;
  }[] = [];
  let maxedSkipCount = 0;
  let queuedSkipCount = 0;

  for (const entry of candidateEntries) {
    const check = getSpecialtyTerritoryEligibility(entry.territory, entry.option);
    if (!check.eligible) {
      if (check.reason === 'MAXED') maxedSkipCount += 1;
      else queuedSkipCount += 1;
      continue;
    }
    targetEntries.push({
      ...entry,
      targetLevel: Math.min(check.maxLvl, check.currentLvl + 1),
    });
  }

  if (targetEntries.length === 0) {
    if (maxedSkipCount > 0 && queuedSkipCount === 0) {
      return {
        toastMessage: '🛑 Seçili şehirlerdeki bu tesis türü azami seviyeye (5/5) ulaştı! Daha fazla inşa edilemez.',
      };
    }
    if (queuedSkipCount > 0 && maxedSkipCount === 0) {
      return {
        toastMessage: '⏳ Seçili şehirlerde bu tesisin inşaatı zaten devam ediyor!',
      };
    }
    return {
      toastMessage: '🛑 Seçili şehirler bu tesis için azami seviyede veya inşaatı sürüyor.',
    };
  }

  const totalCost = targetEntries.reduce((sum, e) => sum + e.option.costGold, 0);
  if (p.treasury < totalCost) {
    return {
      toastMessage: `Yetersiz hazine! ${targetEntries.length} şehirde kaynak yatırımı için ${totalCost.toLocaleString('tr-TR')} Altın gerekli (Mevcut: ${Math.floor(p.treasury).toLocaleString('tr-TR')}).`,
    };
  }

  const nextTerritories = { ...territories };
  const stamp = Date.now();

  targetEntries.forEach(({ territory: t, option: opt, targetLevel }, idx) => {
    const existingQueue = t.constructionQueue || [];
    nextTerritories[t.id] = {
      ...t,
      resource: t.resource,
      constructionQueue: [
        ...existingQueue,
        {
          id: `${t.id}-spec-${opt.id}-${stamp}-${idx}`,
          building: opt.buildingBoost,
          targetLevel,
          progressDays: 0,
          totalDays: opt.buildDays,
          goldCost: opt.costGold,
          gdpBonus: opt.gdpBonus,
          specialtyName: opt.shortName,
        },
      ],
    };
  });

  sound.playBuild();
  const cityNames =
    targetEntries.length <= 2
      ? targetEntries.map((e) => e.territory.name).join(', ')
      : `${targetEntries.slice(0, 2).map((e) => e.territory.name).join(', ')} +${targetEntries.length - 2} şehir`;

  const firstOpt = targetEntries[0].option;
  const minDays = Math.min(...targetEntries.map((e) => e.option.buildDays));
  const maxDays = Math.max(...targetEntries.map((e) => e.option.buildDays));
  const daysText = minDays === maxDays ? `${minDays} gün` : `${minDays}–${maxDays} gün`;
  const label =
    specialtyId === 'AUTO_NATURAL' && targetEntries.length > 1
      ? 'Doğal Kaynak Tesisleri'
      : firstOpt.name;

  const skippedTotal = maxedSkipCount + queuedSkipCount;
  const skipSuffix =
    skippedTotal > 0 ? ` (${skippedTotal} şehir sınır/inşaat nedeniyle atlandı)` : '';

  return {
    nations: {
      ...nations,
      [playerNationId]: {
        ...p,
        treasury: p.treasury - totalCost,
      },
    },
    territories: nextTerritories,
    toastMessage: `⏳ ${cityNames}: ${label} inşaatı başlatıldı (${daysText} · -${totalCost.toLocaleString('tr-TR')} Altın).${skipSuffix}`,
  };
}

export function assimilateTerritoryDomain(params: {
  territoryId: string;
  territories: Record<string, Territory>;
  nations: Record<string, Nation>;
  playerNationId: string;
}): EmpireActionPatch {
  const { territoryId, territories, nations, playerNationId } = params;
  const t = territories[territoryId];
  const p = nations[playerNationId];
  if (!t || !p || t.ownerId !== playerNationId) return {};

  if (t.isOccupied) {
    return {
      toastMessage: `${t.name} geçici savaş işgali altında! Savaş bitip Barış Konferansı ile kalıcı ilhak yapılmadan asimilasyon başlatılamaz.`,
    };
  }

  if (t.isAssimilating) {
    return {
      toastMessage: `${t.name} eyaletinde asimilasyon süreci zaten devam ediyor (%${Math.round(t.assimilation ?? 30)} tamamlandı).`,
    };
  }

  if (t.coreOwnerId === playerNationId && (t.assimilation ?? 100) >= 100) {
    return { toastMessage: `${t.name} zaten Öz Vatan (Core) toprağınızdır.` };
  }

  const cost = 180;
  if (p.treasury < cost) {
    return { toastMessage: `Asimilasyon idari fonu için ${cost} Altın gerekli.` };
  }

  const startingAssimilation =
    t.coreOwnerId !== playerNationId
      ? Math.min(t.assimilation ?? 25, 75)
      : Math.min(t.assimilation ?? 75, 90);

  sound.playTreaty();
  return {
    nations: {
      ...nations,
      [playerNationId]: { ...p, treasury: p.treasury - cost },
    },
    territories: {
      ...territories,
      [territoryId]: {
        ...t,
        isOccupied: false,
        occupiedById: undefined,
        isAssimilating: true,
        assimilation: startingAssimilation,
        unrest: Math.max(0, t.unrest - 12),
      },
    },
    toastMessage: `🌍 ${t.name}: Asimilasyon başlatıldı (%${Math.round(startingAssimilation)} → %100 Öz Vatan).`,
  };
}

export function startMissionaryDomain(params: {
  territoryId: string;
  targetReligion?: ReligionId;
  territories: Record<string, Territory>;
  nations: Record<string, Nation>;
  playerNationId: string;
}): EmpireActionPatch {
  const { territoryId, territories, nations, playerNationId } = params;
  const t = territories[territoryId];
  const p = nations[playerNationId];
  if (!t || !p || t.ownerId !== playerNationId) return {};

  const stateRel = params.targetReligion || p.stateReligion || 'ISLAM_SUNNI';
  const currentRel = t.religion || resolveTerritoryReligion(t, p);

  if (currentRel === stateRel) {
    return {
      toastMessage: `${t.name} ahalisi zaten ${RELIGIONS[stateRel]?.name || 'devlet dinine'} mensuptur.`,
    };
  }

  if (t.missionary) {
    const pct = Math.round(
      (t.missionary.progressDays / t.missionary.totalDays) * 100
    );
    return {
      toastMessage: `${t.name} eyaletinde dini tebliğ faaliyeti sürüyor (%${pct} tamamlandı).`,
    };
  }

  const cost = 120;
  if (p.treasury < cost) {
    return {
      toastMessage: `Misyoner ve ulema heyeti sevki için ${cost} Altın gerekli.`,
    };
  }

  sound.playTreaty();
  const totalDays = 60; // 60 oyun günü (~2 ay)

  return {
    nations: {
      ...nations,
      [playerNationId]: { ...p, treasury: p.treasury - cost },
    },
    territories: {
      ...territories,
      [territoryId]: {
        ...t,
        missionary: {
          targetReligion: stateRel,
          progressDays: 0,
          totalDays,
        },
      },
    },
    toastMessage: `${t.name} eyaletine tebliğ heyeti gönderildi! ${RELIGIONS[stateRel]?.name} irşadı başladı (${totalDays} Gün).`,
  };
}

export function formEmpireDomain(params: {
  empireId: string;
  nations: Record<string, Nation>;
  territories: Record<string, Territory>;
  playerNationId: string;
  tick: number;
  gameMode: GameModeId;
  newsEvents: WorldNewsEvent[];
}): EmpireActionPatch {
  const {
    empireId,
    nations,
    territories,
    playerNationId,
    tick,
    gameMode,
    newsEvents,
  } = params;
  const p = nations[playerNationId];
  const emp = FORMABLE_EMPIRES.find((e) => e.id === empireId);
  if (!p || !emp) return {};

  if (p.formedEmpireId === emp.id) {
    return {
      toastMessage: `${emp.name} zaten resmen ilan edildi!`,
    };
  }

  const territoryCount = Object.values(territories).filter(
    (t) => t.ownerId === playerNationId
  ).length;
  if (territoryCount < emp.requiredProvinces) {
    return {
      toastMessage: `${emp.name} ilanı için en az ${emp.requiredProvinces} eyalet gerekli! (Mevcut: ${territoryCount})`,
    };
  }

  if (emp.requiredTerritoryIds && emp.requiredTerritoryIds.length > 0) {
    const missingNames: string[] = [];
    emp.requiredTerritoryIds.forEach((reqId, idx) => {
      const reqTerr = territories[reqId];
      if (reqTerr && reqTerr.ownerId !== playerNationId) {
        missingNames.push(emp.requiredTerritoryNames?.[idx] || reqTerr.name);
      }
    });
    if (missingNames.length > 0) {
      return {
        toastMessage: `${emp.name} için şu kilit bölgeleri fethetmelisiniz: ${missingNames.join(', ')}`,
      };
    }
  }

  if (
    emp.requiredTechCount &&
    (p.unlockedTechs?.length || 0) < emp.requiredTechCount
  ) {
    return {
      toastMessage: `${emp.name} ilanı için en az ${emp.requiredTechCount} teknoloji araştırmış olmalısınız! (Mevcut: ${p.unlockedTechs?.length || 0})`,
    };
  }

  const goldCost = emp.goldCost || 0;
  if (goldCost > 0 && p.treasury < goldCost) {
    return {
      toastMessage: `${emp.name} ilanı için hazinede en az ${goldCost} Altın bulunmalıdır!`,
    };
  }

  sound.playWarHorn();
  return {
    nations: {
      ...nations,
      [playerNationId]: {
        ...p,
        name: emp.name,
        flagCode: emp.newFlagCode,
        color: emp.newColor,
        formedEmpireId: emp.id,
        treasury: Math.max(0, p.treasury - goldCost) + emp.treasuryReward,
        manpower: p.manpower + emp.manpowerReward,
        stability: Math.min(100, p.stability + emp.stabilityReward),
      },
    },
    newsEvents: [
      {
        id: `news_${Date.now()}_empire`,
        tick,
        dateStr: formatGameDate(tick, gameMode),
        title: `TARİHİ İLAN: ${emp.name} Kuruldu!`,
        description: `${emp.name} resmen ilan edildi (${emp.bonusSummary}).`,
        type: 'COALITION',
      },
      ...newsEvents.slice(0, 39),
    ],
    toastMessage: `Tebrikler! ${emp.name} resmen kuruldu!`,
  };
}

export function executeArmyMoveDomain(params: {
  fromId: string;
  toId: string;
  territories: Record<string, Territory>;
  nations: Record<string, Nation>;
  relations: Record<string, DiplomaticRelation>;
  wars: ActiveWar[];
  movements: ArmyMovement[];
  playerNationId: string;
  moveRatio: number;
  tick: number;
  gameMode: GameModeId;
  newsEvents: WorldNewsEvent[];
  speed: SpeedLevel;
  forceDeclareWar?: boolean;
}): EmpireActionPatch {
  const {
    fromId,
    toId,
    territories,
    nations,
    relations,
    wars,
    movements,
    playerNationId,
    moveRatio,
    tick,
    gameMode,
    newsEvents,
    speed,
    forceDeclareWar = false,
  } = params;

  const fromT = territories[fromId];
  const toT = territories[toId];
  const playerNation = nations[playerNationId];
  if (!fromT || !toT || !playerNation) return {};

  if (fromT.ownerId !== playerNationId) {
    return {
      toastMessage:
        'Sadece kendi kontrolünüzdeki bölgelerden ordu yürütebilirsiniz.',
    };
  }

  const isForeign = toT.ownerId !== playerNationId;
  const targetRelOwner = nations[toT.ownerId];
  const relWithTarget = isForeign
    ? getOrCreateRelation(relations, playerNationId, toT.ownerId)
    : null;
  const isAlliedOrVassalDest =
    Boolean(relWithTarget?.isAllied) ||
    Boolean(relWithTarget?.hasMilitaryAccess) ||
    targetRelOwner?.vassalOf === playerNationId ||
    playerNation.vassalOf === toT.ownerId;
  const alreadyAtWarWithTarget = Boolean(
    isForeign && isAtWar(wars, playerNationId, toT.ownerId)
  );

  // AoH3 Rule: Cannot march into a neutral foreign nation's territory without declaring war first!
  if (
    isForeign &&
    !isAlliedOrVassalDest &&
    !alreadyAtWarWithTarget &&
    !forceDeclareWar
  ) {
    return {
      pendingWarMove: {
        fromId,
        toId,
        targetNationId: toT.ownerId,
      },
      armyOrderSourceId: null,
      toastMessage: `🛑 ${targetRelOwner?.name || 'Yabancı Devlet'} ile savaşta değilsiniz! Sınır ötesi harekat için Savaş İlanını onaylayın.`,
    };
  }

  const route = findArmyRouteAStar({
    fromId,
    toId,
    moverNationId: playerNationId,
    territories,
    nations,
    relations,
    wars,
    allowTargetWarDeclaration: alreadyAtWarWithTarget || forceDeclareWar,
  });

  if (!route.reachable || route.hops.length === 0) {
    return {
      toastMessage:
        route.blockedReason || 'Hedef bölgeye ulaşılabilir bir rota bulunamadı.',
    };
  }

  const [firstHopId, ...remainingHops] = route.hops;
  const firstHopTerr = territories[firstHopId];

  const sendableTroops = Math.max(0, Math.floor(fromT.garrison - 500));
  const normalizedMoveRatio = Number.isFinite(moveRatio)
    ? Math.max(0, Math.min(1, moveRatio))
    : 0;
  const sendTroops = Math.min(
    sendableTroops,
    Math.round(sendableTroops * normalizedMoveRatio)
  );
  if (sendTroops < 1000) {
    return {
      toastMessage:
        'Hareket için en az 1.000 asker sevk edilmeli; kaynak eyalette 500 savunma askeri kalır.',
    };
  }

  let nextWars = wars;
  let nextNews = newsEvents;
  let toast: string | undefined;

  if (
    isForeign &&
    !isAlliedOrVassalDest &&
    !alreadyAtWarWithTarget &&
    forceDeclareWar
  ) {
    const targetNation = nations[toT.ownerId];
    const resolution = resolveWarParticipants(
      playerNationId,
      toT.ownerId,
      relations,
      nations
    );

    const defAllyNames = resolution.defensiveAlliesCalled
      .map((id) => nations[id]?.name)
      .filter(Boolean);
    const attAllyNames = resolution.offensiveAlliesCalled
      .map((id) => nations[id]?.name)
      .filter(Boolean);

    const newWar: ActiveWar = {
      id: `war_${Date.now()}`,
      name: `${playerNation.name} - ${targetNation?.name} Savaşı`,
      attackerId: playerNationId,
      defenderId: toT.ownerId,
      attackers: resolution.attackers,
      defenders: resolution.defenders,
      startedTick: tick,
      attackerWarScore: 0,
      casualtiesAttacker: 0,
      casualtiesDefender: 0,
    };
    nextWars = [...wars, newWar];

    let warDesc = `${playerNation.name} orduları ${toT.name} hedefine askeri harekat başlattı.`;
    if (attAllyNames.length > 0) {
      warDesc += ` Saldırı paktı ortağınız (${attAllyNames.join(', ')}) sizinle birlikte taarruza katıldı.`;
    }
    if (defAllyNames.length > 0) {
      warDesc += ` Hedefin savunma paktı müttefikleri (${defAllyNames.join(', ')}) savunmaya katıldı!`;
    }

    nextNews = [
      {
        id: `news_${Date.now()}_war`,
        tick,
        dateStr: formatGameDate(tick, gameMode),
        title: newWar.name,
        description: warDesc,
        type: 'WAR',
      },
      ...newsEvents.slice(0, 39),
    ];
    sound.playWarHorn();
    toast =
      defAllyNames.length > 0
        ? `${targetNation?.name} hedefine hareket başladı! Savunma Paktı (${defAllyNames.join(', ')}) savaşa dahil oldu!`
        : `${targetNation?.name} hedefine hareket başlatıldı ve savaş ilan edildi!`;
  } else {
    sound.playMarch();
    if (route.hops.length > 1) {
      toast = `🧭 Ordu ${route.hops.length} eyaletlik güzergâh üzerinden ${toT.name} hedefine harekete geçti!`;
    }
  }

  const calledLords = isForeign ? playerNation.bannerCalledLordIds || [] : [];
  const lordRetinueBonus = calledLords.reduce(
    (sum, lId) => sum + getLordRetinueTroops(lId, territories),
    0
  );

  const sourceUnits =
    fromT.units || { infantry: fromT.garrison, armor: 0, airDrone: 0 };
  const sentUnits = scaleUnits(
    sourceUnits,
    sendTroops / Math.max(1, fromT.garrison)
  );
  const remainingUnits = {
    infantry: Math.max(0, sourceUnits.infantry - sentUnits.infantry),
    armor: Math.max(0, sourceUnits.armor - sentUnits.armor),
    airDrone: Math.max(0, sourceUnits.airDrone - sentUnits.airDrone),
  };
  if (lordRetinueBonus > 0) {
    sentUnits.infantry += Math.round(lordRetinueBonus * 0.75);
    sentUnits.armor += Math.round(lordRetinueBonus * 0.25);
    toast = `Sancak Lordları harekete katıldı! (+${lordRetinueBonus.toLocaleString('tr-TR')} Lord Muhafızı orduya eklendi)`;
  }

  let workingNations: Record<string, Nation> =
    lordRetinueBonus > 0
      ? {
          ...nations,
          [playerNationId]: {
            ...playerNation,
            bannerCalledLordIds: [],
          },
        }
      : { ...nations };

  let workingTerritories: Record<string, Territory> = {
    ...territories,
    [fromId]: {
      ...fromT,
      garrison: Math.max(0, fromT.garrison - sendTroops),
      units: remainingUnits,
    },
  };

  let workingMovements: ArmyMovement[] = [
    ...movements,
    {
      id: `mv_${Date.now()}_${Math.random()}`,
      ownerId: playerNationId,
      fromTerritoryId: fromId,
      toTerritoryId: firstHopId,
      routeQueue: remainingHops,
      finalDestinationId: toId,
      troops: sendTroops + lordRetinueBonus,
      units: sentUnits,
      progress: 10,
      isAttack: Boolean(
        firstHopTerr &&
          firstHopTerr.ownerId !== playerNationId &&
          isAtWar(nextWars, playerNationId, firstHopTerr.ownerId)
      ),
    },
  ];

  // If this move declared a new war, trigger immediate enemy AI counter-mobilization & counter-attack!
  if (
    isForeign &&
    !isAlliedOrVassalDest &&
    !alreadyAtWarWithTarget &&
    forceDeclareWar
  ) {
    const aiCounter = evaluateWartimeAiOperations({
      nextTick: tick,
      playerNationId,
      nations: workingNations,
      territories: workingTerritories,
      relations,
      wars: nextWars,
      movements: workingMovements,
      aiAggressiveness: 'AGGRESSIVE',
      maxActionsPerPass: 2,
    });
    if (aiCounter) {
      workingNations = aiCounter.updatedNations;
      workingTerritories = aiCounter.updatedTerritories;
      if (aiCounter.newMovements.length > 0) {
        workingMovements = [...workingMovements, ...aiCounter.newMovements];
      }
      if (aiCounter.playerAlerts.length > 0) {
        toast = `${toast || ''} ${aiCounter.playerAlerts[0]}`.trim();
      }
    }
  }

  return {
    nations: workingNations,
    wars: nextWars,
    newsEvents: nextNews,
    territories: workingTerritories,
    movements: workingMovements,
    armyOrderSourceId: null,
    ...(speed === 0 ? { speed: 1 as SpeedLevel } : {}),
    ...(toast ? { toastMessage: toast } : {}),
  };
}

export function executeBatchArmyMoveDomain(params: {
  sourceIds: string[];
  toId: string;
  territories: Record<string, Territory>;
  nations: Record<string, Nation>;
  relations: Record<string, DiplomaticRelation>;
  wars: ActiveWar[];
  movements: ArmyMovement[];
  playerNationId: string;
  moveRatio: number;
  tick: number;
  gameMode: GameModeId;
  newsEvents: WorldNewsEvent[];
  speed: SpeedLevel;
  forceDeclareWar?: boolean;
}): EmpireActionPatch {
  const {
    sourceIds,
    toId,
    territories,
    nations,
    relations,
    wars,
    movements,
    playerNationId,
    moveRatio,
    tick,
    gameMode,
    newsEvents,
    speed,
    forceDeclareWar = false,
  } = params;

  const toT = territories[toId];
  const playerNation = nations[playerNationId];
  if (!toT || !playerNation) return {};

  const normalizedMoveRatio = Number.isFinite(moveRatio)
    ? Math.max(0, Math.min(1, moveRatio))
    : 1;

  const uniqueSourceIds = Array.from(new Set(sourceIds)).filter(
    (id) => id && id !== toId
  );
  if (uniqueSourceIds.length === 0) {
    return {
      toastMessage: 'Toplu sevk için önce en az 1 kaynak şehir seçin.',
    };
  }

  const eligibleSources: { terr: Territory; sendTroops: number }[] = [];
  for (const sId of uniqueSourceIds) {
    const t = territories[sId];
    if (!t || t.ownerId !== playerNationId) continue;
    const sendable = Math.max(0, Math.floor(t.garrison - 500));
    const sendTroops = Math.min(
      sendable,
      Math.round(sendable * normalizedMoveRatio)
    );
    if (sendTroops >= 1000) {
      eligibleSources.push({ terr: t, sendTroops });
    }
  }

  if (eligibleSources.length === 0) {
    return {
      toastMessage:
        'Seçili şehirlerde sevk edilebilir yeterli asker yok (en az 1.000 asker sevk edilmeli ve 500 garnizon kalmalıdır).',
    };
  }

  const isForeign = toT.ownerId !== playerNationId;
  const targetRelOwner = nations[toT.ownerId];
  const relWithTarget = isForeign
    ? getOrCreateRelation(relations, playerNationId, toT.ownerId)
    : null;
  const isAlliedOrVassalDest =
    Boolean(relWithTarget?.isAllied) ||
    Boolean(relWithTarget?.hasMilitaryAccess) ||
    targetRelOwner?.vassalOf === playerNationId ||
    playerNation.vassalOf === toT.ownerId;
  const alreadyAtWarWithTarget = Boolean(
    isForeign && isAtWar(wars, playerNationId, toT.ownerId)
  );

  const allowRouteWar = alreadyAtWarWithTarget || forceDeclareWar;

  // Check routes for each eligible city before triggering war declaration
  const routedSources = eligibleSources
    .map((item) => {
      const route = findArmyRouteAStar({
        fromId: item.terr.id,
        toId,
        moverNationId: playerNationId,
        territories,
        nations,
        relations,
        wars,
        allowTargetWarDeclaration:
          allowRouteWar ||
          (isForeign && !isAlliedOrVassalDest && !alreadyAtWarWithTarget),
      });
      return { ...item, route };
    })
    .filter((item) => item.route.reachable && item.route.hops.length > 0);

  if (routedSources.length === 0) {
    return {
      toastMessage:
        'Seçili şehirlerden hedef eyalete ulaşılabilir kara/boğaz rotası bulunamadı.',
    };
  }

  // AoH3 Rule: Confirm war declaration before crossing into neutral foreign territory
  if (
    isForeign &&
    !isAlliedOrVassalDest &&
    !alreadyAtWarWithTarget &&
    !forceDeclareWar
  ) {
    const validIds = routedSources.map((r) => r.terr.id);
    return {
      pendingWarMove: {
        fromId: validIds[0],
        sourceTerritoryIds: validIds,
        moveRatio: normalizedMoveRatio,
        toId,
        targetNationId: toT.ownerId,
      },
      armyOrderSourceId: null,
      toastMessage: `🛑 ${targetRelOwner?.name || 'Yabancı Devlet'} ile savaşta değilsiniz! ${validIds.length} orduluk toplu harekat için Savaş İlanını onaylayın.`,
    };
  }

  let nextWars = wars;
  let nextNews = newsEvents;
  let warNotice = '';

  if (
    isForeign &&
    !isAlliedOrVassalDest &&
    !alreadyAtWarWithTarget &&
    forceDeclareWar
  ) {
    const targetNation = nations[toT.ownerId];
    const resolution = resolveWarParticipants(
      playerNationId,
      toT.ownerId,
      relations,
      nations
    );
    const defAllyNames = resolution.defensiveAlliesCalled
      .map((id) => nations[id]?.name)
      .filter(Boolean);
    const attAllyNames = resolution.offensiveAlliesCalled
      .map((id) => nations[id]?.name)
      .filter(Boolean);

    const newWar: ActiveWar = {
      id: `war_${Date.now()}`,
      name: `${playerNation.name} - ${targetNation?.name} Savaşı`,
      attackerId: playerNationId,
      defenderId: toT.ownerId,
      attackers: resolution.attackers,
      defenders: resolution.defenders,
      startedTick: tick,
      attackerWarScore: 0,
      casualtiesAttacker: 0,
      casualtiesDefender: 0,
    };
    nextWars = [...wars, newWar];

    let warDesc = `${playerNation.name}, ${routedSources.length} eyaletlik toplu orduyu ${toT.name} hedefine sevk etti.`;
    if (attAllyNames.length > 0) {
      warDesc += ` Saldırı paktı ortağınız (${attAllyNames.join(', ')}) taarruza katıldı.`;
    }
    if (defAllyNames.length > 0) {
      warDesc += ` Savunma paktı müttefikleri (${defAllyNames.join(', ')}) savaşa dahil oldu!`;
    }

    nextNews = [
      {
        id: `news_${Date.now()}_war`,
        tick,
        dateStr: formatGameDate(tick, gameMode),
        title: newWar.name,
        description: warDesc,
        type: 'WAR',
      },
      ...newsEvents.slice(0, 39),
    ];
    sound.playWarHorn();
    warNotice =
      defAllyNames.length > 0
        ? ` Savaş ilan edildi (Savunma Paktı: ${defAllyNames.join(', ')})!`
        : ' Savaş ilan edildi!';
  } else {
    sound.playMarch();
  }

  const calledLords = isForeign ? playerNation.bannerCalledLordIds || [] : [];
  const lordRetinueBonus = calledLords.reduce(
    (sum, lId) => sum + getLordRetinueTroops(lId, territories),
    0
  );

  let workingNations: Record<string, Nation> =
    lordRetinueBonus > 0
      ? {
          ...nations,
          [playerNationId]: {
            ...playerNation,
            bannerCalledLordIds: [],
          },
        }
      : { ...nations };

  let workingTerritories: Record<string, Territory> = { ...territories };
  const addedMovements: ArmyMovement[] = [];
  let totalTroopsSent = 0;

  routedSources.forEach((item, idx) => {
    const src = workingTerritories[item.terr.id];
    if (!src) return;
    const [firstHopId, ...remainingHops] = item.route.hops;
    const firstHopTerr = workingTerritories[firstHopId];
    const sourceUnits =
      src.units || { infantry: src.garrison, armor: 0, airDrone: 0 };
    const sentUnits = scaleUnits(
      sourceUnits,
      item.sendTroops / Math.max(1, src.garrison)
    );
    const remainingUnits = {
      infantry: Math.max(0, sourceUnits.infantry - sentUnits.infantry),
      armor: Math.max(0, sourceUnits.armor - sentUnits.armor),
      airDrone: Math.max(0, sourceUnits.airDrone - sentUnits.airDrone),
    };

    let bonusTroops = 0;
    if (idx === 0 && lordRetinueBonus > 0) {
      bonusTroops = lordRetinueBonus;
      sentUnits.infantry += Math.round(lordRetinueBonus * 0.75);
      sentUnits.armor += Math.round(lordRetinueBonus * 0.25);
    }

    workingTerritories[src.id] = {
      ...src,
      garrison: Math.max(0, src.garrison - item.sendTroops),
      units: remainingUnits,
    };

    const totalThisArmy = item.sendTroops + bonusTroops;
    totalTroopsSent += totalThisArmy;

    addedMovements.push({
      id: `mv_batch_${Date.now()}_${idx}_${src.id}`,
      ownerId: playerNationId,
      fromTerritoryId: src.id,
      toTerritoryId: firstHopId,
      routeQueue: remainingHops,
      finalDestinationId: toId,
      troops: totalThisArmy,
      units: sentUnits,
      progress: 10,
      isAttack: Boolean(
        firstHopTerr &&
          firstHopTerr.ownerId !== playerNationId &&
          isAtWar(nextWars, playerNationId, firstHopTerr.ownerId)
      ),
    });
  });

  let workingMovements = [...movements, ...addedMovements];

  const skippedCount = uniqueSourceIds.length - routedSources.length;
  let toast = `⚔️ ${routedSources.length} şehirden ${(totalTroopsSent / 1000).toFixed(1)}B asker ${toT.name} hedefine sevk edildi!${warNotice}`;
  if (skippedCount > 0) {
    toast += ` (${skippedCount} şehirde yetersiz garnizon/rota atlandı)`;
  }

  if (
    isForeign &&
    !isAlliedOrVassalDest &&
    !alreadyAtWarWithTarget &&
    forceDeclareWar
  ) {
    const aiCounter = evaluateWartimeAiOperations({
      nextTick: tick,
      playerNationId,
      nations: workingNations,
      territories: workingTerritories,
      relations,
      wars: nextWars,
      movements: workingMovements,
      aiAggressiveness: 'AGGRESSIVE',
      maxActionsPerPass: 2,
    });
    if (aiCounter) {
      workingNations = aiCounter.updatedNations;
      workingTerritories = aiCounter.updatedTerritories;
      if (aiCounter.newMovements.length > 0) {
        workingMovements = [...workingMovements, ...aiCounter.newMovements];
      }
      if (aiCounter.playerAlerts.length > 0) {
        toast = `${toast} ${aiCounter.playerAlerts[0]}`.trim();
      }
    }
  }

  return {
    nations: workingNations,
    wars: nextWars,
    newsEvents: nextNews,
    territories: workingTerritories,
    movements: workingMovements,
    armyOrderSourceId: null,
    ...(speed === 0 ? { speed: 1 as SpeedLevel } : {}),
    toastMessage: toast,
  };
}

export function modernizeNationalArmyDomain(params: {
  nations: Record<string, Nation>;
  territories: Record<string, Territory>;
  relations: Record<string, DiplomaticRelation>;
  movements: ArmyMovement[];
  playerNationId: string;
  gameMode: GameModeId;
  tick: number;
  newsEvents: WorldNewsEvent[];
}): EmpireActionPatch {
  const {
    nations,
    territories,
    relations,
    movements,
    playerNationId,
    gameMode,
    tick,
    newsEvents,
  } = params;
  const playerNation = nations[playerNationId];
  if (!playerNation) return {};

  const unlockedTier = getNationUnlockedMilTier(playerNation);
  const currentTier = getNationModernizedTier(playerNation);
  if (unlockedTier <= currentTier) {
    return {
      toastMessage:
        'Ordularınız zaten mevcut en yüksek askeri teknolojinizle donatılmış durumda!',
    };
  }

  const econ = calculateNationEconomy(
    playerNation,
    territories,
    nations,
    relations,
    movements
  );
  const cost = calculateArmyModernizationCost(
    playerNation,
    econ.totalGarrison
  );
  if (playerNation.treasury < cost) {
    return {
      toastMessage: `Ulusal Ordu Modernizasyonu için ${cost} Altın gerekli (Mevcut: ${playerNation.treasury} Altın).`,
    };
  }

  const nextGen = getArmyGenerationInfo(gameMode, unlockedTier);
  sound.playTreaty();

  const nextTerrs = { ...territories };
  Object.keys(nextTerrs).forEach((tId) => {
    const terr = nextTerrs[tId];
    if (!terr || terr.ownerId !== playerNationId) return;
    const inf = terr.units?.infantry || 0;
    const shiftToHeavy = Math.floor(inf * 0.12);
    const addArmor = Math.floor(shiftToHeavy * 0.65);
    const addAirArtillery = shiftToHeavy - addArmor;
    nextTerrs[tId] = {
      ...terr,
      units: {
        infantry: Math.max(0, inf - shiftToHeavy),
        armor: (terr.units?.armor || 0) + addArmor,
        airDrone: (terr.units?.airDrone || 0) + addAirArtillery,
      },
    };
  });

  return {
    nations: {
      ...nations,
      [playerNationId]: {
        ...playerNation,
        treasury: playerNation.treasury - cost,
        modernizedArmyTier: unlockedTier,
      },
    },
    territories: nextTerrs,
    newsEvents: [
      {
        id: `news_${Date.now()}_mod`,
        tick,
        dateStr: formatGameDate(tick, gameMode),
        title: `⚡ ${playerNation.name} Orduları ${nextGen.generationLabel} Seviyesine Modernize Edildi`,
        description: `Tüm tümen ve garnizonlar ${nextGen.eraTitle} teçhizatına (${nextGen.infantryShort}, ${nextGen.armorShort}, ${nextGen.airArtilleryShort}) yükseltildi (+%${nextGen.combatBonusPct} Harp Gücü).`,
        type: 'REFORM',
      },
      ...newsEvents.slice(0, 39),
    ],
    toastMessage: `⚡ Tüm ordular ${nextGen.generationLabel} (${nextGen.eraTitle}) seviyesine güncellendi! (+%${nextGen.combatBonusPct} Güç)`,
  };
}

export function siegeBombardmentDomain(params: {
  territoryId: string;
  method: 'ARTILLERY' | 'DRONE_RAID';
  territories: Record<string, Territory>;
  nations: Record<string, Nation>;
  playerNationId: string;
  gameMode: GameModeId;
}): EmpireActionPatch {
  const { territoryId, method, territories, nations, playerNationId, gameMode } =
    params;
  const t = territories[territoryId];
  const p = nations[playerNationId];
  if (!t || !p || t.ownerId === playerNationId) return {};

  const hasAdjacentFrontline = t.neighbors.some(
    (nbId) => territories[nbId]?.ownerId === playerNationId
  );
  if (!hasAdjacentFrontline) {
    return {
      toastMessage: `🛑 Kuşatma bombardımanı için ${t.name} eyaletine komşu bir sınır sancağımız olmalıdır!`,
    };
  }

  if ((t.castleWallHp ?? 100) <= 0) {
    return {
      toastMessage: `${t.name} Kalesinin surları zaten tamamen yıkıldı (%0)! Ordunuzu şehre yürüterek muharebeyi başlatın.`,
    };
  }

  if (method === 'ARTILLERY') {
    if (p.treasury < 180) {
      return {
        toastMessage: 'Kuşatma topçu bombardımanı için 180 Altın gerekli.',
      };
    }
    sound.playWarHorn();
    const wallBefore = Math.max(0, Math.min(100, t.castleWallHp ?? 100));
    const wallAfter = Math.max(0, wallBefore - 35);
    const newGarrison = Math.max(0, Math.round(t.garrison * 0.9));
    const garrisonLoss = Math.max(0, t.garrison - newGarrison);
    return {
      nations: {
        ...nations,
        [playerNationId]: { ...p, treasury: p.treasury - 180 },
      },
      territories: {
        ...territories,
        [territoryId]: {
          ...t,
          castleWallHp: wallAfter,
          garrison: newGarrison,
          units: scaleUnits(t.units, newGarrison / Math.max(1, t.garrison)),
          ...(t.siege ? { siege: { ...t.siege, wallIntegrity: wallAfter } } : {}),
        },
      },
      toastMessage: `${t.name} Kalesi topçu ateşine tutuldu: surlar %${wallBefore} → %${wallAfter}; garnizon ${t.garrison.toLocaleString('tr-TR')} → ${newGarrison.toLocaleString('tr-TR')} asker (${garrisonLoss.toLocaleString('tr-TR')} kayıp).`,
    };
  }

  if ((p.clanInfluence ?? 0) < 20 || p.treasury < 220) {
    return {
      toastMessage:
        gameMode === 'EMPIRES_1440'
          ? 'Şahi Topu & Lağımcı Hücumu için 220 Altın ve 20 ⚜ Klan Nüfuzu gerekli.'
          : 'Nokta Kuşatma Baskını için 220 Altın ve 20 ⚜ Klan Nüfuzu gerekli.',
    };
  }

  sound.playWarHorn();
  const wallBefore = Math.max(0, Math.min(100, t.castleWallHp ?? 100));
  const wallAfter = Math.max(0, wallBefore - 45);
  const newGarrison = Math.max(0, Math.round(t.garrison * 0.82));
  const garrisonLoss = Math.max(0, t.garrison - newGarrison);
  return {
    nations: {
      ...nations,
      [playerNationId]: {
        ...p,
        treasury: p.treasury - 220,
        clanInfluence: Math.max(0, (p.clanInfluence || 0) - 20),
      },
    },
    territories: {
      ...territories,
        [territoryId]: {
          ...t,
          castleWallHp: wallAfter,
          garrison: newGarrison,
          units: scaleUnits(t.units, newGarrison / Math.max(1, t.garrison)),
          ...(t.siege ? { siege: { ...t.siege, wallIntegrity: wallAfter } } : {}),
      },
    },
    toastMessage:
      gameMode === 'EMPIRES_1440'
        ? `${t.name} Kalesine Şahi & Lağımcı hücumu yapıldı: surlar %${wallBefore} → %${wallAfter}; garnizon ${t.garrison.toLocaleString('tr-TR')} → ${newGarrison.toLocaleString('tr-TR')} asker (${garrisonLoss.toLocaleString('tr-TR')} kayıp).`
        : `${t.name} Kalesine kuşatma baskını düzenlendi: surlar %${wallBefore} → %${wallAfter}; garnizon ${t.garrison.toLocaleString('tr-TR')} → ${newGarrison.toLocaleString('tr-TR')} asker (${garrisonLoss.toLocaleString('tr-TR')} kayıp).`,
  };
}

export function startResearchDomain(params: {
  techId: string;
  nations: Record<string, Nation>;
  playerNationId: string;
  gameMode: GameModeId;
  tick?: number;
}): EmpireActionPatch {
  const { techId, nations, playerNationId, gameMode, tick = 0 } = params;
  const p = nations[playerNationId];
  const tech = getTechTreeForMode(gameMode).find((t) => t.id === techId);
  if (!p || !tech) return {};

  if (p.unlockedTechs.includes(techId)) {
    return { toastMessage: `${tech.name} zaten araştırıldı.` };
  }
  if (tech.prerequisite && !p.unlockedTechs.includes(tech.prerequisite)) {
    return { toastMessage: 'Önce önceki kademe araştırmayı tamamlamalısınız!' };
  }
  if (p.activeResearch?.techId === techId) {
    return { toastMessage: `${tech.name} zaten aktif olarak araştırılıyor!` };
  }

  const researchProgressByTech = { ...(p.researchProgressByTech ?? {}) };
  if (p.activeResearch) {
    researchProgressByTech[p.activeResearch.techId] = Math.max(
      0,
      p.activeResearch.progress
    );
  }
  const savedProgress = researchProgressByTech[techId];
  const resumedProgress = Number.isFinite(savedProgress)
    ? Math.min(tech.cost, Math.max(0, savedProgress))
    : 0;
  researchProgressByTech[techId] = resumedProgress;

  sound.playClick();
  return {
    nations: {
      ...nations,
      [playerNationId]: {
        ...p,
        researchProgressByTech,
        activeResearch: {
          techId,
          progress: resumedProgress,
          totalCost: tech.cost,
          startedTick: tick,
        },
      },
    },
    toastMessage:
      resumedProgress > 0
        ? `🔬 ${tech.name} araştırması kaldığı yerden devam ediyor.`
        : `🔬 ${tech.name} araştırması başladı! Bilim üretimine göre gün gün ilerleyecek.`,
  };
}

export function pickNextAutoResearchTech(
  nation: Pick<Nation, 'unlockedTechs' | 'researchProgressByTech'>,
  gameMode: GameModeId
) {
  const tree = getTechTreeForMode(gameMode);
  const unlocked = nation.unlockedTechs || [];
  const saved = nation.researchProgressByTech || {};
  const available = tree.filter(
    (tech) =>
      !unlocked.includes(tech.id) &&
      (!tech.prerequisite || unlocked.includes(tech.prerequisite))
  );
  if (available.length === 0) return null;

  // Prefer any partially researched available tech first, then lowest tier, then cheapest RP cost
  return [...available].sort((a, b) => {
    const progA = Number.isFinite(saved[a.id]) ? Math.max(0, saved[a.id]) : 0;
    const progB = Number.isFinite(saved[b.id]) ? Math.max(0, saved[b.id]) : 0;
    if (progA > 0 && progB <= 0) return -1;
    if (progB > 0 && progA <= 0) return 1;
    if (a.tier !== b.tier) return a.tier - b.tier;
    return a.cost - b.cost;
  })[0];
}

export function toggleAutoResearchDomain(params: {
  nations: Record<string, Nation>;
  playerNationId: string;
  gameMode: GameModeId;
  tick?: number;
}): EmpireActionPatch {
  const { nations, playerNationId, gameMode, tick = 0 } = params;
  const p = nations[playerNationId];
  if (!p) return {};

  const nextEnabled = !(p.autoResearch ?? false);
  let nextActive = p.activeResearch ?? null;
  const researchProgressByTech = { ...(p.researchProgressByTech ?? {}) };
  let startedName: string | null = null;

  if (nextEnabled && !nextActive) {
    const nextTech = pickNextAutoResearchTech(p, gameMode);
    if (nextTech) {
      const savedProg = Number.isFinite(researchProgressByTech[nextTech.id])
        ? Math.min(nextTech.cost, Math.max(0, researchProgressByTech[nextTech.id]))
        : 0;
      researchProgressByTech[nextTech.id] = savedProg;
      nextActive = {
        techId: nextTech.id,
        progress: savedProg,
        totalCost: nextTech.cost,
        startedTick: tick,
      };
      startedName = nextTech.name;
    }
  }

  sound.playClick();
  return {
    nations: {
      ...nations,
      [playerNationId]: {
        ...p,
        autoResearch: nextEnabled,
        activeResearch: nextActive,
        researchProgressByTech,
      },
    },
    toastMessage: nextEnabled
      ? startedName
        ? `Otomatik araştırma açıldı: ${startedName} başlatıldı.`
        : 'Otomatik araştırma açıldı; biten teknolojiden sonra yenisi otomatik başlayacak.'
      : 'Otomatik araştırma kapatıldı.',
  };
}

export function cancelResearchDomain(params: {
  nations: Record<string, Nation>;
  playerNationId: string;
}): EmpireActionPatch {
  const { nations, playerNationId } = params;
  const p = nations[playerNationId];
  if (!p || !p.activeResearch) return {};
  const researchProgressByTech = {
    ...(p.researchProgressByTech ?? {}),
    [p.activeResearch.techId]: Math.max(0, p.activeResearch.progress),
  };
  return {
    nations: {
      ...nations,
      [playerNationId]: {
        ...p,
        researchProgressByTech,
        activeResearch: null,
        autoResearch: false,
      },
    },
    toastMessage: 'Araştırma duraklatıldı; ilerlemesi kaydedildi.',
  };
}

export function boostResearchDomain(params: {
  nations: Record<string, Nation>;
  playerNationId: string;
}): EmpireActionPatch {
  const { nations, playerNationId } = params;
  const p = nations[playerNationId];
  if (!p || !p.activeResearch || p.researchPoints <= 0) {
    return { toastMessage: 'Hızlandırmak için yeterli birikmiş araştırma puanınız yok.' };
  }
  const needed = p.activeResearch.totalCost - p.activeResearch.progress;
  const spend = Math.min(p.researchPoints, Math.max(5, Math.ceil(needed * 0.4)));
  const nextProgress = Number((p.activeResearch.progress + spend).toFixed(2));
  const researchProgressByTech = {
    ...(p.researchProgressByTech ?? {}),
    [p.activeResearch.techId]: nextProgress,
  };
  sound.playBuild();
  return {
    nations: {
      ...nations,
      [playerNationId]: {
        ...p,
        researchProgressByTech,
        researchPoints: Number((p.researchPoints - spend).toFixed(1)),
        activeResearch: {
          ...p.activeResearch,
          progress: nextProgress,
        },
      },
    },
    toastMessage: `⚡ Araştırmaya +${spend.toFixed(0)} Araştırma Puanı aktarıldı!`,
  };
}

export function unlockTechDomain(params: {
  techId: string;
  nations: Record<string, Nation>;
  playerNationId: string;
  gameMode: GameModeId;
  tick?: number;
}): EmpireActionPatch {
  // Direct entry point from UI button or hotkey: starts timed research
  return startResearchDomain(params);
}

export function enactReformDomain(params: {
  reformId: string;
  nations: Record<string, Nation>;
  relations: Record<string, DiplomaticRelation>;
  playerNationId: string;
  gameMode: GameModeId;
}): EmpireActionPatch {
  const { reformId, nations, relations, playerNationId, gameMode } = params;
  const p = nations[playerNationId];
  const ref = getReformsForMode(gameMode).find((r) => r.id === reformId);
  if (!p || !ref || p.enactedReforms.includes(reformId)) return {};
  if (p.treasury < ref.costGold || p.researchPoints < ref.costResearch) {
    return {
      toastMessage: 'Reform için yeterli altın veya araştırma puanı yok.',
    };
  }

  sound.playTreaty();
  let nextRelations: Record<string, DiplomaticRelation> | undefined;
  if (reformId === 'ref_imperial_diplomacy') {
    nextRelations = { ...relations };
    for (const other of Object.values(nations)) {
      if (!other || other.id === playerNationId || other.isEliminated) continue;
      const key = relationKey(playerNationId, other.id);
      const currentRelation = getOrCreateRelation(
        nextRelations,
        playerNationId,
        other.id
      );
      nextRelations[key] = {
        ...currentRelation,
        score: Math.min(100, currentRelation.score + 15),
      };
    }
  }

  return {
    nations: {
      ...nations,
      [playerNationId]: {
        ...p,
        treasury: p.treasury - ref.costGold,
        researchPoints: p.researchPoints - ref.costResearch,
        enactedReforms: [...p.enactedReforms, reformId],
        stability:
          reformId === 'ref_welfare_state'
            ? Math.min(100, p.stability + 12)
            : p.stability,
        aggressiveExpansion:
          reformId === 'ref_imperial_diplomacy'
            ? Math.max(0, (p.aggressiveExpansion || 0) - 15)
            : p.aggressiveExpansion,
      },
    },
    ...(nextRelations ? { relations: nextRelations } : {}),
    toastMessage: `Ulusal Reform Yürürlüğe Girdi: ${ref.name}`,
  };
}

export function changeIdeologyDomain(params: {
  newIdeology: IdeologyId;
  nations: Record<string, Nation>;
  playerNationId: string;
}): EmpireActionPatch {
  const { newIdeology, nations, playerNationId } = params;
  const p = nations[playerNationId];
  if (!p || p.ideology === newIdeology) return {};
  sound.playTreaty();
  return {
    nations: {
      ...nations,
      [playerNationId]: { ...p, ideology: newIdeology },
    },
    toastMessage: `Devlet ideolojisi ${IDEOLOGIES[newIdeology].name} olarak güncellendi.`,
  };
}

/**
 * Gathers excess safe reserve troops from adjacent friendly provinces straight into `targetTerritoryId`.
 * Respects active battles and sieges so frontline defenders are never stripped mid-combat.
 */
export function mergeNeighborArmiesDomain(params: {
  targetTerritoryId: string;
  territories: Record<string, Territory>;
  wars: ActiveWar[];
  battles: ActiveBattle[];
  movements: ArmyMovement[];
  playerNationId: string;
  speed: SpeedLevel;
}): EmpireActionPatch {
  const {
    targetTerritoryId,
    territories,
    wars,
    battles,
    movements,
    playerNationId,
    speed,
  } = params;

  const target = territories[targetTerritoryId];
  if (!target || target.ownerId !== playerNationId) {
    return {
      toastMessage: 'Orduları yalnızca kendi kontrolünüzdeki bir şehirde birleştirebilirsiniz.',
    };
  }

  const battleTerrIds = new Set(battles.map((b) => b.territoryId));
  const nextTerritories = { ...territories };
  const addedMovements: ArmyMovement[] = [];
  let totalMergedTroops = 0;
  let mergedSourceCount = 0;

  for (const nbId of target.neighbors) {
    const nb = nextTerritories[nbId];
    if (!nb || nb.ownerId !== playerNationId) continue;
    if (nb.siege || battleTerrIds.has(nbId)) continue;

    const bordersActiveEnemy = nb.neighbors.some((n2Id) => {
      const n2 = nextTerritories[n2Id];
      return Boolean(
        n2 &&
          n2.ownerId !== playerNationId &&
          isAtWar(wars, playerNationId, n2.ownerId)
      );
    });
    const reserve = bordersActiveEnemy ? 1000 : 500;
    const sendable = Math.floor(nb.garrison - reserve);
    if (sendable < 500) continue;

    const ratio = sendable / Math.max(1, nb.garrison);
    const srcUnits = nb.units || { infantry: nb.garrison, armor: 0, airDrone: 0 };
    const sentUnits = scaleUnits(srcUnits, ratio);
    const remainingUnits = {
      infantry: Math.max(0, srcUnits.infantry - sentUnits.infantry),
      armor: Math.max(0, srcUnits.armor - sentUnits.armor),
      airDrone: Math.max(0, srcUnits.airDrone - sentUnits.airDrone),
    };

    nextTerritories[nbId] = {
      ...nb,
      garrison: Math.max(0, nb.garrison - sendable),
      units: remainingUnits,
    };

    addedMovements.push({
      id: `mv_merge_${Date.now()}_${nbId}_${Math.random().toString(36).slice(2, 6)}`,
      ownerId: playerNationId,
      fromTerritoryId: nbId,
      toTerritoryId: targetTerritoryId,
      finalDestinationId: targetTerritoryId,
      troops: sendable,
      units: sentUnits,
      progress: 22,
      isAttack: false,
    });

    totalMergedTroops += sendable;
    mergedSourceCount++;
  }

  if (addedMovements.length === 0) {
    return {
      toastMessage:
        'Komşu eyaletlerde birleştirilebilecek güvenli yedek birlik yok (Savaş/kuşatma altındaki veya yalnız sınır nöbetçileri yerinde kalır).',
    };
  }

  sound.playMarch();
  return {
    territories: nextTerritories,
    movements: [...movements, ...addedMovements],
    ...(speed === 0 ? { speed: 1 as SpeedLevel } : {}),
    toastMessage: `🛡️ ${mergedSourceCount} komşu şehirden ${totalMergedTroops.toLocaleString('tr-TR')} asker ${target.name} merkezinde birleşmek üzere harekete geçti!`,
  };
}

/**
 * Disbands 50% or 100% of stationed garrison on peaceful owned territory and refunds 75% to manpower pool.
 * Strictly blocked during active combat or siege to prevent war-score denial exploits.
 */
export function disbandArmyDomain(params: {
  territoryId: string;
  ratio: 0.5 | 1;
  territories: Record<string, Territory>;
  nations: Record<string, Nation>;
  battles: ActiveBattle[];
  playerNationId: string;
}): EmpireActionPatch {
  const { territoryId, ratio, territories, nations, battles, playerNationId } = params;
  const terr = territories[territoryId];
  const playerNation = nations[playerNationId];
  if (!terr || !playerNation || terr.ownerId !== playerNationId) return {};

  if (terr.siege || battles.some((b) => b.territoryId === territoryId)) {
    return {
      toastMessage:
        '⚔️ Aktif muharebe veya kuşatma altındaki bir şehirde asker silinemez (terhis engellendi)!',
    };
  }

  if (terr.garrison <= 0) {
    return { toastMessage: 'Bu şehirde silinecek / terhis edilecek asker yok.' };
  }

  const disbandedTroops =
    ratio >= 1
      ? Math.max(0, Math.floor(terr.garrison))
      : Math.max(0, Math.floor(terr.garrison * ratio));
  if (disbandedTroops <= 0) return {};

  const remainingTroops = Math.max(0, terr.garrison - disbandedTroops);
  const srcUnits = terr.units || { infantry: terr.garrison, armor: 0, airDrone: 0 };
  const remainingUnits =
    remainingTroops === 0
      ? { infantry: 0, armor: 0, airDrone: 0 }
      : scaleUnits(srcUnits, remainingTroops / Math.max(1, terr.garrison));

  const refundedManpower = Math.round(disbandedTroops * 0.75);
  sound.playClick();

  return {
    nations: {
      ...nations,
      [playerNationId]: {
        ...playerNation,
        manpower: playerNation.manpower + refundedManpower,
      },
    },
    territories: {
      ...territories,
      [territoryId]: {
        ...terr,
        garrison: remainingTroops,
        units: remainingUnits,
      },
    },
    toastMessage: `🪖 ${terr.name}: ${disbandedTroops.toLocaleString('tr-TR')} asker silindi/terhis edildi (+${refundedManpower.toLocaleString('tr-TR')} İnsan Gücü rezerve iade edildi).`,
  };
}

export function batchAssimilateDomain(params: {
  territories: Record<string, Territory>;
  nations: Record<string, Nation>;
  playerNationId: string;
}): EmpireActionPatch {
  const { territories, nations, playerNationId } = params;
  const p = nations[playerNationId];
  if (!p) return {};

  const eligible = Object.values(territories)
    .filter(
      (t) =>
        t &&
        t.ownerId === playerNationId &&
        !t.isOccupied &&
        !t.isAssimilating &&
        (t.coreOwnerId !== playerNationId ||
          (t.assimilation ?? 100) < 100)
    )
    .sort((a, b) => (b.unrest || 0) - (a.unrest || 0) || (b.baseGdp || 0) - (a.baseGdp || 0));

  if (eligible.length === 0) {
    const occupiedCount = Object.values(territories).filter(
      (t) => t && t.ownerId === playerNationId && t.isOccupied
    ).length;
    return {
      toastMessage:
        occupiedCount > 0
          ? `Geçici savaş işgalindeki ${occupiedCount} şehir barış antlaşmasıyla kalıcı ilhak edilmeden asimile edilemez.`
          : 'Asimile edilecek kalıcı yabancı toprak bulunmuyor; tüm şehirler Öz Vatan.',
    };
  }

  const costPerCity = 180;
  if (p.treasury < costPerCity) {
    return {
      toastMessage: `🌍 Toplu Asimilasyon için şehir başına ${costPerCity} Altın gerekli.`,
    };
  }

  let remainingGold = p.treasury;
  let startedCount = 0;
  const nextTerritories = { ...territories };

  for (const t of eligible) {
    if (remainingGold < costPerCity) break;
    remainingGold -= costPerCity;
    startedCount++;
    const startingAssimilation =
      t.coreOwnerId !== playerNationId
        ? Math.min(t.assimilation ?? 25, 75)
        : Math.min(t.assimilation ?? 75, 90);
    nextTerritories[t.id] = {
      ...t,
      isOccupied: false,
      occupiedById: undefined,
      isAssimilating: true,
      assimilation: startingAssimilation,
      unrest: Math.max(0, t.unrest - 12),
    };
  }

  const spent = startedCount * costPerCity;
  sound.playTreaty();
  const skippedByGold = eligible.length - startedCount;
  return {
    nations: {
      ...nations,
      [playerNationId]: { ...p, treasury: remainingGold },
    },
    territories: nextTerritories,
    toastMessage:
      skippedByGold > 0
        ? `🌍 ${startedCount} şehirde Toplu Asimilasyon başlatıldı (-${spent.toLocaleString('tr-TR')} Altın · ${skippedByGold} şehir bütçe yetersizliğiyle ertelendi).`
        : `🌍 ${startedCount} şehirde Toplu Asimilasyon başlatıldı (-${spent.toLocaleString('tr-TR')} Altın).`,
  };
}

export function batchStabilityFestivalDomain(params: {
  territories: Record<string, Territory>;
  nations: Record<string, Nation>;
  playerNationId: string;
}): EmpireActionPatch {
  const { territories, nations, playerNationId } = params;
  const p = nations[playerNationId];
  if (!p) return {};

  const restless = Object.values(territories)
    .filter((t) => t && t.ownerId === playerNationId && (t.unrest || 0) >= 10)
    .sort((a, b) => (b.unrest || 0) - (a.unrest || 0));

  if (restless.length === 0) {
    return {
      toastMessage: '🎉 Tüm eyaletlerde asayiş yerinde (Huzursuzluk %10 altında).',
    };
  }

  const costPerCity = 140;
  if (p.treasury < costPerCity) {
    return {
      toastMessage: `🎉 Toplu Şenlik & İstikrar Yatırımı için şehir başına ${costPerCity} Altın gerekli.`,
    };
  }

  let remainingGold = p.treasury;
  let calmedCount = 0;
  const nextTerritories = { ...territories };

  for (const t of restless) {
    if (remainingGold < costPerCity) break;
    remainingGold -= costPerCity;
    calmedCount++;
    nextTerritories[t.id] = {
      ...t,
      unrest: Math.max(0, Number((t.unrest - 15).toFixed(1))),
    };
  }

  const spent = calmedCount * costPerCity;
  const stabilityGain = calmedCount * 2;
  sound.playTreaty();
  return {
    nations: {
      ...nations,
      [playerNationId]: {
        ...p,
        treasury: remainingGold,
        stability: Math.min(100, p.stability + stabilityGain),
      },
    },
    territories: nextTerritories,
    toastMessage: `🎉 ${calmedCount} eyalette Şenlik & Dirlik fermanı ilan edildi (-15 huzursuzluk, +${stabilityGain} İstikrar, -${spent.toLocaleString('tr-TR')} Altın).`,
  };
}

export function batchUpgradeBuildingDomain(params: {
  territories: Record<string, Territory>;
  nations: Record<string, Nation>;
  playerNationId: string;
  building: BuildingType;
  territoryIds?: string[];
}): EmpireActionPatch {
  const { territories, nations, playerNationId, building, territoryIds } = params;
  const p = nations[playerNationId];
  const def = BUILDINGS.find((b) => b.id === building);
  if (!p || !def) return {};

  const filterSet = territoryIds ? new Set(territoryIds) : null;
  let blockedByCoastCount = 0;
  const eligible = Object.values(territories)
    .filter((t) => {
      if (!t || t.ownerId !== playerNationId) return false;
      if (filterSet && !filterSet.has(t.id)) return false;
      if (def.requiresCoastal && !isTerritoryCoastal(t)) {
        blockedByCoastCount++;
        return false;
      }
      const lvl = t.buildings?.[building] || 0;
      if (lvl >= def.maxLevel) return false;
      if ((t.constructionQueue || []).some((q) => q.building === building)) return false;
      return true;
    })
    .sort((a, b) => (b.baseGdp || 0) - (a.baseGdp || 0));

  if (eligible.length === 0) {
    if (def.requiresCoastal && blockedByCoastCount > 0) {
      return {
        toastMessage: `⚓ ${def.name} yalnızca denize kıyısı olan şehirlerde kurulabilir!`,
      };
    }
    return {
      toastMessage: `🏗️ ${def.name} için uygun veya müsait şehir bulunmuyor (azami seviye veya inşası sürüyor).`,
    };
  }

  let remainingGold = p.treasury;
  let startedCount = 0;
  let totalSpent = 0;
  const nextTerritories = { ...territories };
  const ts = Date.now();

  for (let idx = 0; idx < eligible.length; idx++) {
    const t = eligible[idx];
    const currentLvl = t.buildings?.[building] || 0;
    const cost = Math.round(def.baseCost * Math.pow(1.35, currentLvl));
    if (remainingGold < cost) continue;
    remainingGold -= cost;
    totalSpent += cost;
    startedCount++;
    const totalDays = Math.max(14, 18 + currentLvl * 14);
    nextTerritories[t.id] = {
      ...t,
      constructionQueue: [
        ...(t.constructionQueue || []),
        {
          id: `batch-${t.id}-${building}-${ts}-${idx}`,
          building,
          targetLevel: currentLvl + 1,
          progressDays: 0,
          totalDays,
          goldCost: cost,
        },
      ],
    };
  }

  if (startedCount === 0) {
    const cheapestCost = Math.min(
      ...eligible.map((t) =>
        Math.round(def.baseCost * Math.pow(1.35, t.buildings?.[building] || 0))
      )
    );
    return {
      toastMessage: `🏗️ Toplu ${def.name} için yetersiz hazine (en az ${cheapestCost.toLocaleString('tr-TR')} Altın gerekli).`,
    };
  }

  sound.playBuild();
  const skipped = eligible.length - startedCount;
  return {
    nations: {
      ...nations,
      [playerNationId]: { ...p, treasury: remainingGold },
    },
    territories: nextTerritories,
    toastMessage:
      skipped > 0
        ? `🏗️ ${startedCount} şehirde ${def.name} inşası başlatıldı (-${totalSpent.toLocaleString('tr-TR')} Altın · ${skipped} şehir bütçe yetersizliğiyle kaldı).`
        : `🏗️ ${startedCount} şehirde ${def.name} inşası başlatıldı (-${totalSpent.toLocaleString('tr-TR')} Altın).`,
  };
}

export type BatchRecruitScope = 'BORDER' | 'ALL' | 'BARRACKS' | 'SINGLE_MAX';
export type BatchRecruitUnitMode = UnitType | 'MIXED';

export function batchRecruitUnitsDomain(params: {
  scope: BatchRecruitScope;
  unitMode?: BatchRecruitUnitMode;
  territoryId?: string;
  roundsPerCity?: number;
  territories: Record<string, Territory>;
  nations: Record<string, Nation>;
  playerNationId: string;
  gameMode?: GameModeId;
}): EmpireActionPatch {
  const {
    scope,
    unitMode = 'infantry',
    territoryId,
    roundsPerCity = 1,
    territories,
    nations,
    playerNationId,
  } = params;
  const p = nations[playerNationId];
  if (!p) return {};

  let discount = p.enactedReforms.includes('ref_national_defense_industry')
    ? 0.8
    : 1.0;
  if (p.unlockedTechs?.includes('mil_4b')) {
    discount *= 0.9;
  }

  // Unit package definitions per step
  const stepSpec: Record<
    BatchRecruitUnitMode,
    {
      troops: number;
      baseGold: number;
      label: string;
      addUnits: { infantry: number; armor: number; airDrone: number };
    }
  > = {
    infantry: {
      troops: 1000,
      baseGold: 120,
      label: 'Piyade',
      addUnits: { infantry: 1000, armor: 0, airDrone: 0 },
    },
    armor: {
      troops: 1000,
      baseGold: 180,
      label: 'Süvari / Zırhlı',
      addUnits: { infantry: 0, armor: 1000, airDrone: 0 },
    },
    airDrone: {
      troops: 1000,
      baseGold: 360,
      label: 'Topçu / Hava & SİHA',
      addUnits: { infantry: 0, armor: 0, airDrone: 1000 },
    },
    MIXED: {
      troops: 2000,
      baseGold: 320,
      label: 'Karma Ordu (Piyade + Süvari + Topçu)',
      addUnits: { infantry: 1200, armor: 500, airDrone: 300 },
    },
  };

  const pkg = stepSpec[unitMode] || stepSpec.infantry;
  const goldCostPerStep = Math.max(40, Math.round(pkg.baseGold * discount));
  const troopStep = pkg.troops;

  if (p.treasury < goldCostPerStep) {
    return {
      toastMessage: `🛡️ Toplu ${pkg.label} basımı için en az ${goldCostPerStep} Altın gerekli.`,
    };
  }
  if (p.manpower < troopStep) {
    return {
      toastMessage: `🛡️ Toplu ${pkg.label} basımı için en az ${troopStep.toLocaleString('tr-TR')} İnsan Gücü gerekli.`,
    };
  }

  // SINGLE_MAX: Recruit maximum affordable regiments into a single target province
  if (scope === 'SINGLE_MAX') {
    const targetId = territoryId || p.capitalTerritoryId;
    const t = territories[targetId];
    if (!t || t.ownerId !== playerNationId) {
      return { toastMessage: 'Toplu asker basımı için kendi eyaletinizi seçin.' };
    }
    const maxByGold = Math.floor(p.treasury / goldCostPerStep);
    const maxByManpower = Math.floor(p.manpower / troopStep);
    const steps = Math.max(0, Math.min(25, maxByGold, maxByManpower));
    if (steps <= 0) {
      return {
        toastMessage: `Yetersiz kaynak! (${goldCostPerStep} Altın ve ${troopStep.toLocaleString('tr-TR')} İG gerekli)`,
      };
    }

    const totalGold = steps * goldCostPerStep;
    const totalTroops = steps * troopStep;
    const curUnits = t.units || { infantry: t.garrison, armor: 0, airDrone: 0 };
    sound.playBuild();

    return {
      nations: {
        ...nations,
        [playerNationId]: {
          ...p,
          treasury: p.treasury - totalGold,
          manpower: p.manpower - totalTroops,
        },
      },
      territories: {
        ...territories,
        [t.id]: {
          ...t,
          garrison: t.garrison + totalTroops,
          units: {
            infantry: curUnits.infantry + pkg.addUnits.infantry * steps,
            armor: curUnits.armor + pkg.addUnits.armor * steps,
            airDrone: curUnits.airDrone + pkg.addUnits.airDrone * steps,
          },
        },
      },
      toastMessage: `⚔️ ${t.name}: +${totalTroops.toLocaleString('tr-TR')} ${pkg.label} toplu olarak orduya katıldı (-${totalGold.toLocaleString('tr-TR')} Altın).`,
    };
  }

  const ownedCities = Object.values(territories).filter(
    (t) => t && t.ownerId === playerNationId
  );
  let targetCities: Territory[] = [];

  if (scope === 'BORDER') {
    targetCities = ownedCities
      .filter((t) =>
        t.neighbors.some((nbId) => {
          const nb = territories[nbId];
          return Boolean(nb && nb.ownerId !== playerNationId);
        })
      )
      .sort((a, b) => (a.garrison || 0) - (b.garrison || 0));
    if (targetCities.length === 0) {
      targetCities = [...ownedCities].sort(
        (a, b) => (a.garrison || 0) - (b.garrison || 0)
      );
    }
  } else if (scope === 'BARRACKS') {
    targetCities = ownedCities
      .filter((t) => Boolean(t.isCapital) || (t.buildings?.barracks || 0) > 0)
      .sort(
        (a, b) =>
          Number(b.isCapital) - Number(a.isCapital) ||
          (b.buildings?.barracks || 0) - (a.buildings?.barracks || 0)
      );
    if (targetCities.length === 0) {
      targetCities = [...ownedCities].sort(
        (a, b) => Number(b.isCapital) - Number(a.isCapital)
      );
    }
  } else {
    targetCities = [...ownedCities].sort(
      (a, b) =>
        Number(b.isCapital) - Number(a.isCapital) ||
        (a.garrison || 0) - (b.garrison || 0)
    );
  }

  if (targetCities.length === 0) {
    return { toastMessage: '🛡️ Asker toplanacak uygun şehir bulunamadı.' };
  }

  let remainingGold = p.treasury;
  let remainingManpower = p.manpower;
  let totalSteps = 0;
  const touchedCityIds = new Set<string>();
  const nextTerritories = { ...territories };
  const passes = Math.max(1, Math.min(5, roundsPerCity));

  for (let pass = 0; pass < passes; pass++) {
    let anyAddedInPass = false;
    for (const baseCity of targetCities) {
      if (remainingGold < goldCostPerStep || remainingManpower < troopStep) {
        break;
      }
      const t = nextTerritories[baseCity.id];
      if (!t) continue;
      remainingGold -= goldCostPerStep;
      remainingManpower -= troopStep;
      totalSteps++;
      anyAddedInPass = true;
      touchedCityIds.add(t.id);
      const curUnits = t.units || { infantry: t.garrison, armor: 0, airDrone: 0 };
      nextTerritories[t.id] = {
        ...t,
        garrison: t.garrison + troopStep,
        units: {
          infantry: curUnits.infantry + pkg.addUnits.infantry,
          armor: curUnits.armor + pkg.addUnits.armor,
          airDrone: curUnits.airDrone + pkg.addUnits.airDrone,
        },
      };
    }
    if (!anyAddedInPass) break;
  }

  const totalTroops = totalSteps * troopStep;
  const totalGold = totalSteps * goldCostPerStep;
  const scopeLabel =
    scope === 'BORDER'
      ? 'Sınır Seferberliği'
      : scope === 'BARRACKS'
      ? 'Kışla & Başkent Seferberliği'
      : 'Ulusal Toplu Seferberlik';

  sound.playBuild();
  return {
    nations: {
      ...nations,
      [playerNationId]: {
        ...p,
        treasury: remainingGold,
        manpower: remainingManpower,
      },
    },
    territories: nextTerritories,
    toastMessage: `🛡️ ${scopeLabel}: ${touchedCityIds.size} şehre +${totalTroops.toLocaleString('tr-TR')} ${pkg.label} konuşlandırıldı (-${totalGold.toLocaleString('tr-TR')} Altın).`,
  };
}

export function batchBorderMobilizationDomain(params: {
  territories: Record<string, Territory>;
  nations: Record<string, Nation>;
  playerNationId: string;
  unitMode?: BatchRecruitUnitMode;
  scope?: BatchRecruitScope;
}): EmpireActionPatch {
  return batchRecruitUnitsDomain({
    scope: params.scope ?? 'BORDER',
    unitMode: params.unitMode ?? 'infantry',
    territories: params.territories,
    nations: params.nations,
    playerNationId: params.playerNationId,
  });
}

/**
 * Embarks an army from a coastal province onto open sea coordinates (or repositions an existing SeaArmy at sea).
 */
export function executeEmbarkToSeaDomain(params: {
  sourceTerritoryId?: string | null;
  sourceSeaArmyId?: string | null;
  targetCoords: [number, number];
  targetSeaArmyId?: string | null;
  territories: Record<string, Territory>;
  nations: Record<string, Nation>;
  movements: ArmyMovement[];
  seaArmies: SeaArmy[];
  playerNationId: string;
  moveRatio: number;
  speed: SpeedLevel;
}): EmpireActionPatch {
  const {
    sourceTerritoryId,
    sourceSeaArmyId,
    targetCoords,
    targetSeaArmyId,
    territories,
    nations,
    movements,
    seaArmies,
    playerNationId,
    moveRatio,
    speed,
  } = params;

  const playerNation = nations[playerNationId];
  if (!playerNation) return {};

  const normalizedRatio = Number.isFinite(moveRatio)
    ? Math.max(0.1, Math.min(1, moveRatio))
    : 1;
  const seaName = resolveSeaRegionName(targetCoords);

  // Case 1: Repositioning or splitting an existing SeaArmy across the sea
  if (sourceSeaArmyId) {
    const fleet = seaArmies.find(
      (s) => s.id === sourceSeaArmyId && s.ownerId === playerNationId
    );
    if (!fleet) return {};
    if (targetSeaArmyId && targetSeaArmyId === fleet.id) {
      return { seaArmyOrderSourceId: null };
    }

    const sendTroops =
      normalizedRatio >= 0.99
        ? fleet.troops
        : Math.max(500, Math.round(fleet.troops * normalizedRatio));
    if (sendTroops < 500 || sendTroops > fleet.troops) {
      return {
        toastMessage: 'Denizde hareket için en az 500 askerlik filo gerekli.',
      };
    }

    const sendRatio = sendTroops / Math.max(1, fleet.troops);
    const sentUnits = scaleUnits(fleet.units, sendRatio);
    const remainingTroops = fleet.troops - sendTroops;
    const nextSeaArmies =
      remainingTroops < 300
        ? seaArmies.filter((s) => s.id !== fleet.id)
        : seaArmies.map((s) =>
            s.id === fleet.id
              ? {
                  ...s,
                  troops: remainingTroops,
                  units: {
                    infantry: Math.max(0, s.units.infantry - sentUnits.infantry),
                    armor: Math.max(0, s.units.armor - sentUnits.armor),
                    airDrone: Math.max(0, s.units.airDrone - sentUnits.airDrone),
                  },
                }
              : s
          );

    const anchorId =
      fleet.anchorCoastId && territories[fleet.anchorCoastId]
        ? fleet.anchorCoastId
        : playerNation.capitalTerritoryId;

    sound.playMarch();
    return {
      seaArmies: nextSeaArmies,
      movements: [
        ...movements,
        {
          id: `mv_sea_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          ownerId: playerNationId,
          fromTerritoryId: anchorId,
          toTerritoryId: anchorId,
          fromCoords: fleet.coords,
          toCoords: targetCoords,
          targetSeaName: seaName,
          targetSeaArmyId: targetSeaArmyId || undefined,
          sourceSeaArmyId: fleet.id,
          isNaval: true,
          troops: remainingTroops < 300 ? fleet.troops : sendTroops,
          units: remainingTroops < 300 ? fleet.units : sentUnits,
          progress: 12,
          isAttack: false,
        },
      ],
      selectedSeaArmyId: remainingTroops < 300 ? null : fleet.id,
      seaArmyOrderSourceId: null,
      armyOrderSourceId: null,
      ...(speed === 0 ? { speed: 1 as SpeedLevel } : {}),
      toastMessage: `${fleet.name} yeni deniz mevkiine (${seaName}) yelken açtı.`,
    };
  }

  // Case 2: Embarking from a coastal province onto open water
  if (!sourceTerritoryId) return {};
  const fromT = territories[sourceTerritoryId];
  if (!fromT || fromT.ownerId !== playerNationId) {
    return {
      toastMessage: 'Sadece kendi kontrolünüzdeki kıyı şehirlerinden denize açılabilirsiniz.',
    };
  }
  if (!isTerritoryCoastal(fromT)) {
    return {
      toastMessage: `${fromT.name} kara içi bir şehirdir; denize açılmak için kıyı (sahil) şehri seçin.`,
    };
  }

  const sendableTroops = Math.max(0, Math.floor(fromT.garrison - 500));
  const sendTroops = Math.min(
    sendableTroops,
    Math.round(sendableTroops * normalizedRatio)
  );
  if (sendTroops < 1000) {
    return {
      toastMessage:
        'Denize açılmak için en az 1.000 asker sevk edilmeli; kıyı şehrinde 500 savunma askeri kalır.',
    };
  }

  const sourceUnits = fromT.units || {
    infantry: fromT.garrison,
    armor: 0,
    airDrone: 0,
  };
  const sentUnits = scaleUnits(
    sourceUnits,
    sendTroops / Math.max(1, fromT.garrison)
  );
  const remainingUnits = {
    infantry: Math.max(0, sourceUnits.infantry - sentUnits.infantry),
    armor: Math.max(0, sourceUnits.armor - sentUnits.armor),
    airDrone: Math.max(0, sourceUnits.airDrone - sentUnits.airDrone),
  };

  sound.playMarch();
  return {
    territories: {
      ...territories,
      [sourceTerritoryId]: {
        ...fromT,
        garrison: Math.max(0, fromT.garrison - sendTroops),
        units: remainingUnits,
      },
    },
    movements: [
      ...movements,
      {
        id: `mv_embark_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        ownerId: playerNationId,
        fromTerritoryId: sourceTerritoryId,
        toTerritoryId: sourceTerritoryId,
        fromCoords: fromT.centroid,
        toCoords: targetCoords,
        targetSeaName: seaName,
        targetSeaArmyId: targetSeaArmyId || undefined,
        isNaval: true,
        troops: sendTroops,
        units: sentUnits,
        progress: 12,
        isAttack: false,
      },
    ],
    armyOrderSourceId: null,
    seaArmyOrderSourceId: null,
    ...(speed === 0 ? { speed: 1 as SpeedLevel } : {}),
    toastMessage: `${fromT.name} limanından ${(sendTroops / 1000).toFixed(1)}B asker ${seaName} mevkiine denize açıldı.`,
  };
}

/**
 * Disembarks an army stationed at sea (SeaArmy) onto a coastal land territory (friendly landing or amphibious assault).
 */
export function executeDisembarkFromSeaDomain(params: {
  sourceSeaArmyId: string;
  toTerritoryId: string;
  territories: Record<string, Territory>;
  nations: Record<string, Nation>;
  relations: Record<string, DiplomaticRelation>;
  wars: ActiveWar[];
  movements: ArmyMovement[];
  seaArmies: SeaArmy[];
  playerNationId: string;
  moveRatio: number;
  tick: number;
  gameMode: GameModeId;
  newsEvents: WorldNewsEvent[];
  speed: SpeedLevel;
  forceDeclareWar?: boolean;
}): EmpireActionPatch {
  const {
    sourceSeaArmyId,
    toTerritoryId,
    territories,
    nations,
    relations,
    wars,
    movements,
    seaArmies,
    playerNationId,
    moveRatio,
    tick,
    gameMode,
    newsEvents,
    speed,
    forceDeclareWar = false,
  } = params;

  const fleet = seaArmies.find(
    (s) => s.id === sourceSeaArmyId && s.ownerId === playerNationId
  );
  const toT = territories[toTerritoryId];
  const playerNation = nations[playerNationId];
  if (!fleet || !toT || !playerNation) return {};

  if (!isTerritoryCoastal(toT)) {
    return {
      toastMessage: `${toT.name} kara içi bir şehirdir; deniz filosundan yalnızca kıyı şehirlerine çıkarma yapılabilir.`,
    };
  }

  const isForeign = toT.ownerId !== playerNationId;
  const targetRelOwner = nations[toT.ownerId];
  const relWithTarget = isForeign
    ? getOrCreateRelation(relations, playerNationId, toT.ownerId)
    : null;
  const isAlliedOrVassalDest =
    Boolean(relWithTarget?.isAllied) ||
    Boolean(relWithTarget?.hasMilitaryAccess) ||
    targetRelOwner?.vassalOf === playerNationId ||
    playerNation.vassalOf === toT.ownerId;
  const alreadyAtWarWithTarget = Boolean(
    isForeign && isAtWar(wars, playerNationId, toT.ownerId)
  );

  if (
    isForeign &&
    !isAlliedOrVassalDest &&
    !alreadyAtWarWithTarget &&
    !forceDeclareWar
  ) {
    const anchorId =
      fleet.anchorCoastId && territories[fleet.anchorCoastId]
        ? fleet.anchorCoastId
        : playerNation.capitalTerritoryId;
    return {
      pendingWarMove: {
        fromId: anchorId,
        sourceSeaArmyId: fleet.id,
        moveRatio,
        toId: toTerritoryId,
        targetNationId: toT.ownerId,
      },
      seaArmyOrderSourceId: null,
      toastMessage: `${targetRelOwner?.name || 'Yabancı Devlet'} ile savaşta değilsiniz! Amfibi çıkarma için Savaş İlanını onaylayın.`,
    };
  }

  const normalizedRatio = Number.isFinite(moveRatio)
    ? Math.max(0.1, Math.min(1, moveRatio))
    : 1;
  const sendTroops =
    normalizedRatio >= 0.99
      ? fleet.troops
      : Math.max(500, Math.round(fleet.troops * normalizedRatio));
  const sentUnits =
    normalizedRatio >= 0.99
      ? fleet.units
      : scaleUnits(fleet.units, sendTroops / Math.max(1, fleet.troops));
  const remainingTroops = fleet.troops - sendTroops;
  const nextSeaArmies =
    remainingTroops < 300
      ? seaArmies.filter((s) => s.id !== fleet.id)
      : seaArmies.map((s) =>
          s.id === fleet.id
            ? {
                ...s,
                troops: remainingTroops,
                units: {
                  infantry: Math.max(0, s.units.infantry - sentUnits.infantry),
                  armor: Math.max(0, s.units.armor - sentUnits.armor),
                  airDrone: Math.max(0, s.units.airDrone - sentUnits.airDrone),
                },
              }
            : s
        );

  let nextWars = wars;
  let nextNews = newsEvents;
  let toast = `${fleet.name}, ${toT.name} kıyısına çıkarma harekatı başlattı.`;

  if (
    isForeign &&
    !isAlliedOrVassalDest &&
    !alreadyAtWarWithTarget &&
    forceDeclareWar
  ) {
    const targetNation = nations[toT.ownerId];
    const resolution = resolveWarParticipants(
      playerNationId,
      toT.ownerId,
      relations,
      nations
    );
    const newWar: ActiveWar = {
      id: `war_${Date.now()}`,
      name: `${playerNation.name} - ${targetNation?.name} Savaşı`,
      attackerId: playerNationId,
      defenderId: toT.ownerId,
      attackers: resolution.attackers,
      defenders: resolution.defenders,
      startedTick: tick,
      attackerWarScore: 0,
      casualtiesAttacker: 0,
      casualtiesDefender: 0,
    };
    nextWars = [...wars, newWar];
    nextNews = [
      {
        id: `news_${Date.now()}_war`,
        tick,
        dateStr: formatGameDate(tick, gameMode),
        title: newWar.name,
        description: `${playerNation.name} donanması ${toT.name} kıyısına amfibi çıkarma başlattı.`,
        type: 'WAR',
      },
      ...newsEvents.slice(0, 39),
    ];
    sound.playWarHorn();
    toast = `${targetNation?.name} devletine savaş ilan edildi ve ${toT.name} kıyısına çıkarma başlatıldı!`;
  } else {
    sound.playMarch();
  }

  const anchorId =
    fleet.anchorCoastId && territories[fleet.anchorCoastId]
      ? fleet.anchorCoastId
      : playerNation.capitalTerritoryId;

  return {
    wars: nextWars,
    newsEvents: nextNews,
    seaArmies: nextSeaArmies,
    movements: [
      ...movements,
      {
        id: `mv_land_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        ownerId: playerNationId,
        fromTerritoryId: anchorId,
        toTerritoryId,
        fromCoords: fleet.coords,
        sourceSeaArmyId: fleet.id,
        isNaval: true,
        troops: remainingTroops < 300 ? fleet.troops : sendTroops,
        units: remainingTroops < 300 ? fleet.units : sentUnits,
        progress: 14,
        isAttack: Boolean(
          isForeign && isAtWar(nextWars, playerNationId, toT.ownerId)
        ),
      },
    ],
    selectedSeaArmyId: remainingTroops < 300 ? null : fleet.id,
    seaArmyOrderSourceId: null,
    armyOrderSourceId: null,
    ...(speed === 0 ? { speed: 1 as SpeedLevel } : {}),
    toastMessage: toast,
  };
}

export function disbandSeaArmyDomain(params: {
  seaArmyId: string;
  ratio: 0.5 | 1;
  seaArmies: SeaArmy[];
  nations: Record<string, Nation>;
  playerNationId: string;
}): EmpireActionPatch {
  const { seaArmyId, ratio, seaArmies, nations, playerNationId } = params;
  const fleet = seaArmies.find(
    (s) => s.id === seaArmyId && s.ownerId === playerNationId
  );
  const p = nations[playerNationId];
  if (!fleet || !p) return {};

  const disbandTroops =
    ratio === 1 ? fleet.troops : Math.round(fleet.troops * 0.5);
  const refundedMp = Math.round(disbandTroops * 0.75);
  const remaining = fleet.troops - disbandTroops;

  const nextSeaArmies =
    remaining < 200
      ? seaArmies.filter((s) => s.id !== fleet.id)
      : seaArmies.map((s) =>
          s.id === fleet.id
            ? {
                ...s,
                troops: remaining,
                units: scaleUnits(s.units, remaining / Math.max(1, s.troops)),
              }
            : s
        );

  sound.playClick();
  return {
    nations: {
      ...nations,
      [playerNationId]: {
        ...p,
        manpower: p.manpower + refundedMp,
      },
    },
    seaArmies: nextSeaArmies,
    selectedSeaArmyId: remaining < 200 ? null : fleet.id,
    seaArmyOrderSourceId: remaining < 200 ? null : undefined,
    toastMessage: `${fleet.name}: ${disbandTroops.toLocaleString('tr-TR')} asker terhis edildi (+${refundedMp.toLocaleString('tr-TR')} İnsan Gücü iade edildi).`,
  };
}
