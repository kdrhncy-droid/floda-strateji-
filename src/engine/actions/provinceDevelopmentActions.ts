import {
  BuildingType,
  CrisisEventDefinition,
  CrisisEventOption,
  GameModeId,
  Nation,
  ReligionId,
  Territory,
  WorldNewsEvent,
} from '../../types/game';
import {
  RELIGIONS,
  resolveTerritoryReligion,
} from '../../data/religionAndCultureData';
import {
  BUILDINGS,
  getTechTreeForMode,
} from '../../data/world2026Data';
import {
  adjustAggressiveExpansionGain,
  formatGameDate,
} from '../simulationEngine';
import { isTerritoryCoastal } from '../worldBuilder';
import { sound } from '../../utils/soundEngine';
import { EmpireActionPatch } from './empireActionTypes';

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
