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
  resolveWarParticipants,
} from './simulationEngine';
import { relationKey } from './worldBuilder';
import {
  DEFAULT_LORD_LOYALTY,
  getLordRetinueTroops,
} from './pashaAndFiefEngine';
import { findArmyRouteAStar } from './pathfindingEngine';
import { evaluateWartimeAiOperations } from './aiAndRebellionEngine';
import { scaleUnits } from './tickEngine';
import { sound } from '../utils/soundEngine';

export interface EmpireActionPatch {
  nations?: Record<string, Nation>;
  relations?: Record<string, DiplomaticRelation>;
  territories?: Record<string, Territory>;
  wars?: ActiveWar[];
  movements?: ArmyMovement[];
  newsEvents?: WorldNewsEvent[];
  activeCrisis?: CrisisEventDefinition | null;
  armyOrderSourceId?: string | null;
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

  const discount = p.enactedReforms.includes('ref_national_defense_industry')
    ? 0.8
    : 1.0;
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

  const currentLvl = t.buildings[building] || 0;
  if (currentLvl >= def.maxLevel) return {};

  const queue = t.constructionQueue || [];
  if (queue.some((q) => q.building === building)) {
    const existing = queue.find((q) => q.building === building);
    const pct = existing ? Math.round((existing.progressDays / existing.totalDays) * 100) : 0;
    return { toastMessage: `Bu binanın inşası zaten devam ediyor (%${pct} tamamlandı).` };
  }

  const cost = Math.round(def.baseCost * Math.pow(1.35, currentLvl));
  if (p.treasury < cost) {
    return { toastMessage: `Yetersiz hazine! (${cost} Altın gerekli)` };
  }

  const totalDays = Math.max(14, 18 + currentLvl * 14);

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
  | 'SIGIR_FARM'
  | 'PAMUK_FIELD'
  | 'KERESTE_MILL'
  | 'TAHIL_GRANARY'
  | 'DEMIR_FOUNDRY'
  | 'ALTIN_MINT'
  | 'PETROL_REFINERY';

export interface SpecialtyProductionOption {
  id: SpecialtyProductionId;
  name: string;
  shortName: string;
  icon: string;
  resource: Territory['resource'];
  buildingBoost: BuildingType;
  costGold: number;
  gdpBonus: number;
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
    description: 'Şehre Sığır & Hayvancılık üretimi kurar, +1 İkmal/Mera seviyesi ve +%36 üretim değeri sağlar.',
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
    description: 'Şehre Pamuk Tarlası ve Dokuma Atölyesi kurar, +1 Sanayi seviyesi ve +%38 üretim değeri sağlar.',
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
    description: 'Şehre Kereste & Odun İşletmesi kurar, +1 Sanayi/Atölye seviyesi ve +%36 üretim değeri sağlar.',
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
    description: 'Şehre sulamalı Tahıl & Buğday Tarlası kurar, +1 Erzak Ambarı seviyesi ve +%35 üretim değeri sağlar.',
  },
  {
    id: 'DEMIR_FOUNDRY',
    name: 'Demir & Maden Ocağı',
    shortName: 'Demir Ocağı',
    icon: '⛏',
    resource: 'DEMIR_CELIK',
    buildingBoost: 'factory',
    costGold: 450,
    gdpBonus: 20,
    description: 'Şehre Demir & Çelik Dökümhanesi kurar, +1 Sanayi seviyesi ve +%38 üretim değeri sağlar.',
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
    description: 'Şehre Altın Madeni & Darphane kurar, +1 Ticaret Merkezi seviyesi ve +%40 üretim değeri sağlar.',
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
    description: 'Şehre Petrol & Enerji Tesisi kurar, +1 Sanayi seviyesi ve +%42 üretim değeri sağlar.',
  },
];

export function investSpecialtyProductionDomain(params: {
  territoryIds: string[];
  specialtyId: SpecialtyProductionId;
  territories: Record<string, Territory>;
  nations: Record<string, Nation>;
  playerNationId: string;
}): EmpireActionPatch {
  const { territoryIds, specialtyId, territories, nations, playerNationId } = params;
  const p = nations[playerNationId];
  const opt = SPECIALTY_PRODUCTION_OPTIONS.find((o) => o.id === specialtyId);
  if (!p || !opt) return {};

  const validTerrs = Array.from(new Set(territoryIds))
    .map((id) => territories[id])
    .filter((t): t is Territory => Boolean(t && t.ownerId === playerNationId));

  if (validTerrs.length === 0) {
    return {
      toastMessage: 'Önce haritadan yatırım yapılacak kendi şehirlerinizi seçin.',
    };
  }

  const totalCost = opt.costGold * validTerrs.length;
  if (p.treasury < totalCost) {
    return {
      toastMessage: `Yetersiz hazine! ${validTerrs.length} şehirde ${opt.name} için ${totalCost.toLocaleString('tr-TR')} Altın gerekli (Mevcut: ${Math.floor(p.treasury).toLocaleString('tr-TR')}).`,
    };
  }

  const bDef = BUILDINGS.find((b) => b.id === opt.buildingBoost);
  const maxLvl = bDef?.maxLevel ?? 5;
  const nextTerritories = { ...territories };

  for (const t of validTerrs) {
    const curLvl = t.buildings[opt.buildingBoost] || 0;
    const nextLvl = Math.min(maxLvl, curLvl + 1);
    nextTerritories[t.id] = {
      ...t,
      resource: opt.resource,
      baseGdp: Math.round((t.baseGdp || 40) + opt.gdpBonus),
      buildings: {
        ...t.buildings,
        [opt.buildingBoost]: nextLvl,
      },
    };
  }

  sound.playBuild();
  const cityNames =
    validTerrs.length <= 2
      ? validTerrs.map((t) => t.name).join(', ')
      : `${validTerrs.slice(0, 2).map((t) => t.name).join(', ')} +${validTerrs.length - 2} şehir`;

  return {
    nations: {
      ...nations,
      [playerNationId]: {
        ...p,
        treasury: p.treasury - totalCost,
      },
    },
    territories: nextTerritories,
    toastMessage: `${opt.icon} ${cityNames}: ${opt.name} kuruldu (-${totalCost.toLocaleString('tr-TR')} Altın).`,
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

