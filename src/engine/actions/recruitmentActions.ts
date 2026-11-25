import {
  ActiveWar,
  ArmyMovement,
  DiplomaticRelation,
  GameModeId,
  Nation,
  QueuedArmyRecruitment,
  Territory,
  UnitType,
  WorldNewsEvent,
} from '../../types/game';
import {
  COMMANDERS,
  calculateArmyModernizationCost,
  getArmyGenerationInfo,
  getNationModernizedTier,
  getNationUnlockedMilTier,
} from '../../data/world2026Data';
import {
  adjustAggressiveExpansionGain,
  calculateNationEconomy,
  evaluateWorldCoalitionAt100AE,
  formatGameDate,
  isAtWar,
} from '../simulationEngine';
import { DEFAULT_LORD_LOYALTY } from '../pashaAndFiefEngine';
import { sound } from '../../utils/soundEngine';
import { EmpireActionPatch } from './empireActionTypes';

export const RECRUIT_GOLD_PER_1K: Record<UnitType, number> = {
  infantry: 280,
  armor: 440,
  airDrone: 760,
};

export const MIXED_2K_BASE_GOLD = 760;

export function calculateRecruitGoldCost(
  unitType: UnitType | 'MIXED',
  amount: number,
  nation?: Pick<Nation, 'enactedReforms' | 'unlockedTechs' | 'warExhaustion'> | null,
  overrideBaseCost?: number
): number {
  const standardBase =
    unitType === 'MIXED'
      ? Math.round((amount / 2000) * MIXED_2K_BASE_GOLD)
      : Math.round((amount / 1000) * RECRUIT_GOLD_PER_1K[unitType]);
  const effectiveBase =
    typeof overrideBaseCost === 'number' && overrideBaseCost > standardBase
      ? overrideBaseCost
      : standardBase;

  let mult = nation?.enactedReforms?.includes('ref_national_defense_industry')
    ? 0.8
    : 1.0;
  if (nation?.unlockedTechs?.includes('mil_4b')) {
    mult *= 0.9;
  }
  // War exhaustion inflates recruitment cost up to +80% at 100% exhaustion
  const warEx = Math.max(0, Math.min(100, nation?.warExhaustion || 0));
  mult *= 1 + warEx * 0.008;

  return Math.max(60, Math.round(effectiveBase * mult));
}

/**
 * Computes training duration (in game days) scaled by troop count.
 * Asker Ocağı (armyHearth) cuts training duration by 15% per level (max -60%),
 * and Kışla (barracks) cuts it by 5% per level (max -25%).
 */
export function calculateRecruitmentDurationDays(
  amount: number,
  unitType: UnitType | 'MIXED',
  territory?: Pick<Territory, 'buildings'> | null,
  nation?: Pick<Nation, 'unlockedTechs'> | null
): number {
  const safeAmount = Math.max(100, amount);
  const unitMult =
    unitType === 'airDrone'
      ? 3.6
      : unitType === 'armor'
      ? 3.0
      : unitType === 'MIXED'
      ? 2.6
      : 2.2;
  const baseDays = Math.max(2, Math.ceil((safeAmount / 1000) * unitMult));

  const hearthLvl = territory?.buildings?.armyHearth || 0;
  const barracksLvl = territory?.buildings?.barracks || 0;
  const hearthFactor = 1 - Math.min(0.6, hearthLvl * 0.15);
  const barracksFactor = 1 - Math.min(0.25, barracksLvl * 0.05);
  const techFactor = nation?.unlockedTechs?.includes('mil_7') ? 0.88 : 1.0;

  return Math.max(1, Math.round(baseDays * hearthFactor * barracksFactor * techFactor));
}

export function recruitUnitDomain(params: {
  territoryId: string;
  unitType: UnitType;
  amount: number;
  baseGoldCost: number;
  territories: Record<string, Territory>;
  nations: Record<string, Nation>;
  playerNationId: string;
  tick?: number;
}): EmpireActionPatch {
  const {
    territoryId,
    unitType,
    amount,
    baseGoldCost,
    territories,
    nations,
    playerNationId,
    tick = 0,
  } = params;
  const t = territories[territoryId];
  const p = nations[playerNationId];
  if (!t || !p || t.ownerId !== playerNationId) return {};

  const goldCost = calculateRecruitGoldCost(unitType, amount, p, baseGoldCost);

  if (p.treasury < goldCost) {
    return { toastMessage: `Yetersiz hazine! (${goldCost.toLocaleString('tr-TR')} Altın gerekli)` };
  }
  if (p.manpower < amount) {
    return {
      toastMessage: `Yetersiz insan gücü! (${amount.toLocaleString('tr-TR')} gerekli)`,
    };
  }

  sound.playRecruit();
  const unitNames: Record<UnitType, string> = {
    infantry: 'Piyade Tümeni',
    armor: 'Zırhlı Tugay',
    airDrone: 'SİHA & Hava Filosu',
  };
  const totalDays = calculateRecruitmentDurationDays(amount, unitType, t, p);
  const queuedItem: QueuedArmyRecruitment = {
    id: `recq_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    unitMode: unitType,
    troops: amount,
    units: {
      infantry: unitType === 'infantry' ? amount : 0,
      armor: unitType === 'armor' ? amount : 0,
      airDrone: unitType === 'airDrone' ? amount : 0,
    },
    label: unitNames[unitType],
    startedTick: tick,
    progressDays: 0,
    totalDays,
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
        recruitmentQueue: [...(t.recruitmentQueue || []), queuedItem],
      },
    },
    recruitFeedback: {
      id: `rec_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      troopsAdded: amount,
      goldSpent: goldCost,
      label: `${t.name}: +${amount.toLocaleString('tr-TR')} (${totalDays}g eğitim)`,
      timestamp: Date.now(),
    },
    toastMessage: `🪖 ${t.name}: +${amount.toLocaleString('tr-TR')} ${unitNames[unitType]} eğitime alındı (${totalDays} gün, -${goldCost.toLocaleString('tr-TR')} Altın).`,
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
  musterDays: number;
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
    costGold: 1150,
    musterDays: 2,
    tagline: 'İnsan gücü harcamadan kısa sürede (2 gün) cepheye toplanan vurucu birlik.',
  },
  {
    id: 'merc_pikemen',
    name: 'Zırhlı Mızraklı & Tüfekçi Alayı',
    historicalName: 'İsviçre Mızraklı & Ceneviz Arbalet Alayı',
    modernName: 'Zırhlı Mekanize Paralı Tugay',
    icon: '🛡️',
    troops: 5000,
    composition: { infantry: 3400, armor: 1200, airDrone: 400 },
    costGold: 2200,
    musterDays: 3,
    tagline: 'Yüksek savunma ve cephe yarma gücüne sahip profesyonel kiralık alay (3 gün).',
  },
  {
    id: 'merc_siege_corps',
    name: 'Büyük Kuşatma & Topçu Ordusu',
    historicalName: 'Macar & Venedik Kuşatma Topçu Kolordusu',
    modernName: 'Ağır Topçu & SİHA Destekli Özel Kolordu',
    icon: '💣',
    troops: 9000,
    composition: { infantry: 5200, armor: 2200, airDrone: 1600 },
    costGold: 3900,
    musterDays: 4,
    tagline: 'Kaleleri yıkmak için kiralanan ağır paralı kolordu (4 gün toplanma).',
  },
];

export function hireMercenaryDomain(params: {
  territoryId: string;
  companyId: string;
  territories: Record<string, Territory>;
  nations: Record<string, Nation>;
  playerNationId: string;
  gameMode?: GameModeId;
  tick?: number;
}): EmpireActionPatch {
  const {
    territoryId,
    companyId,
    territories,
    nations,
    playerNationId,
    gameMode = 'EMPIRES_1440',
    tick = 0,
  } = params;
  const t = territories[territoryId];
  const p = nations[playerNationId];
  const company = MERCENARY_COMPANIES.find((c) => c.id === companyId);
  if (!t || !p || !company || t.ownerId !== playerNationId) return {};

  const warEx = Math.max(0, Math.min(100, p.warExhaustion || 0));
  const finalCost = Math.round(company.costGold * (1 + warEx * 0.008));

  if (p.treasury < finalCost) {
    return {
      toastMessage: `Paralı asker kiralamak için yeterli altın yok! (${finalCost.toLocaleString('tr-TR')} Altın gerekli)`,
    };
  }

  sound.playWarHorn();
  const displayName =
    gameMode === 'EMPIRES_1440' ? company.historicalName : company.modernName;
  const hearthLvl = t.buildings?.armyHearth || 0;
  const totalDays = Math.max(
    1,
    Math.round(company.musterDays * (1 - Math.min(0.5, hearthLvl * 0.12)))
  );

  const queuedItem: QueuedArmyRecruitment = {
    id: `mercq_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    unitMode: 'MIXED',
    troops: company.troops,
    units: { ...company.composition },
    label: displayName,
    startedTick: tick,
    progressDays: 0,
    totalDays,
  };

  return {
    nations: {
      ...nations,
      [playerNationId]: {
        ...p,
        treasury: p.treasury - finalCost,
      },
    },
    territories: {
      ...territories,
      [territoryId]: {
        ...t,
        recruitmentQueue: [...(t.recruitmentQueue || []), queuedItem],
      },
    },
    recruitFeedback: {
      id: `rec_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      troopsAdded: company.troops,
      goldSpent: finalCost,
      label: `${t.name}: +${company.troops.toLocaleString('tr-TR')} (${totalDays}g)`,
      timestamp: Date.now(),
    },
    toastMessage: `🪙 ${t.name}: ${displayName} (+${company.troops.toLocaleString('tr-TR')}) kiralandı — ${totalDays} günde toplanacak (-${finalCost.toLocaleString('tr-TR')} Altın).`,
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
  tick?: number;
}): EmpireActionPatch {
  const {
    scope,
    unitMode = 'infantry',
    territoryId,
    roundsPerCity = 1,
    territories,
    nations,
    playerNationId,
    tick = 0,
  } = params;
  const p = nations[playerNationId];
  if (!p) return {};

  const stepSpec: Record<
    BatchRecruitUnitMode,
    {
      troops: number;
      label: string;
      addUnits: { infantry: number; armor: number; airDrone: number };
    }
  > = {
    infantry: {
      troops: 1000,
      label: 'Piyade',
      addUnits: { infantry: 1000, armor: 0, airDrone: 0 },
    },
    armor: {
      troops: 1000,
      label: 'Süvari / Zırhlı',
      addUnits: { infantry: 0, armor: 1000, airDrone: 0 },
    },
    airDrone: {
      troops: 1000,
      label: 'Topçu / Hava & SİHA',
      addUnits: { infantry: 0, armor: 0, airDrone: 1000 },
    },
    MIXED: {
      troops: 2000,
      label: 'Karma Ordu (Piyade + Süvari + Topçu)',
      addUnits: { infantry: 1200, armor: 500, airDrone: 300 },
    },
  };

  const pkg = stepSpec[unitMode] || stepSpec.infantry;
  const troopStep = pkg.troops;
  const goldCostPerStep = calculateRecruitGoldCost(unitMode, troopStep, p);

  if (p.treasury < goldCostPerStep) {
    return {
      toastMessage: `🛡️ Toplu ${pkg.label} basımı için en az ${goldCostPerStep.toLocaleString('tr-TR')} Altın gerekli.`,
    };
  }
  if (p.manpower < troopStep) {
    return {
      toastMessage: `🛡️ Toplu ${pkg.label} basımı için en az ${troopStep.toLocaleString('tr-TR')} İnsan Gücü gerekli.`,
    };
  }

  // SINGLE_MAX: Enqueue maximum affordable regiments into a single target province
  if (scope === 'SINGLE_MAX') {
    const targetId = territoryId || p.capitalTerritoryId;
    const t = territories[targetId];
    if (!t || t.ownerId !== playerNationId) {
      return { toastMessage: 'Toplu asker basımı için kendi eyaletinizi seçin.' };
    }
    const maxByGold = Math.floor(p.treasury / goldCostPerStep);
    const maxByManpower = Math.floor(p.manpower / troopStep);
    const steps = Math.max(0, Math.min(15, maxByGold, maxByManpower));
    if (steps <= 0) {
      return {
        toastMessage: `Yetersiz kaynak! (${goldCostPerStep.toLocaleString('tr-TR')} Altın ve ${troopStep.toLocaleString('tr-TR')} İG gerekli)`,
      };
    }

    const totalGold = steps * goldCostPerStep;
    const totalTroops = steps * troopStep;
    const totalDays = calculateRecruitmentDurationDays(totalTroops, unitMode, t, p);
    const queuedItem: QueuedArmyRecruitment = {
      id: `recq_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      unitMode,
      troops: totalTroops,
      units: {
        infantry: pkg.addUnits.infantry * steps,
        armor: pkg.addUnits.armor * steps,
        airDrone: pkg.addUnits.airDrone * steps,
      },
      label: pkg.label,
      startedTick: tick,
      progressDays: 0,
      totalDays,
    };
    sound.playRecruit();

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
          recruitmentQueue: [...(t.recruitmentQueue || []), queuedItem],
        },
      },
      recruitFeedback: {
        id: `rec_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        troopsAdded: totalTroops,
        goldSpent: totalGold,
        label: `${t.name}: +${totalTroops.toLocaleString('tr-TR')} (${totalDays}g)`,
        timestamp: Date.now(),
      },
      toastMessage: `⚔️ ${t.name}: +${totalTroops.toLocaleString('tr-TR')} ${pkg.label} eğitime alındı (${totalDays} gün, -${totalGold.toLocaleString('tr-TR')} Altın).`,
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
      .filter(
        (t) =>
          Boolean(t.isCapital) ||
          (t.buildings?.barracks || 0) > 0 ||
          (t.buildings?.armyHearth || 0) > 0
      )
      .sort(
        (a, b) =>
          Number(b.isCapital) - Number(a.isCapital) ||
          (b.buildings?.armyHearth || 0) + (b.buildings?.barracks || 0) -
            ((a.buildings?.armyHearth || 0) + (a.buildings?.barracks || 0))
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
  const stepsPerCity = new Map<string, number>();
  const passes = Math.max(1, Math.min(5, roundsPerCity));

  for (let pass = 0; pass < passes; pass++) {
    let anyAddedInPass = false;
    for (const baseCity of targetCities) {
      if (remainingGold < goldCostPerStep || remainingManpower < troopStep) {
        break;
      }
      remainingGold -= goldCostPerStep;
      remainingManpower -= troopStep;
      totalSteps++;
      anyAddedInPass = true;
      stepsPerCity.set(baseCity.id, (stepsPerCity.get(baseCity.id) || 0) + 1);
    }
    if (!anyAddedInPass) break;
  }

  const nextTerritories = { ...territories };
  let maxDays = 0;
  stepsPerCity.forEach((citySteps, cityId) => {
    const t = nextTerritories[cityId];
    if (!t) return;
    const cityTroops = citySteps * troopStep;
    const cityDays = calculateRecruitmentDurationDays(cityTroops, unitMode, t, p);
    if (cityDays > maxDays) maxDays = cityDays;
    const queuedItem: QueuedArmyRecruitment = {
      id: `recq_${Date.now()}_${cityId}_${Math.random().toString(36).slice(2, 5)}`,
      unitMode,
      troops: cityTroops,
      units: {
        infantry: pkg.addUnits.infantry * citySteps,
        armor: pkg.addUnits.armor * citySteps,
        airDrone: pkg.addUnits.airDrone * citySteps,
      },
      label: pkg.label,
      startedTick: tick,
      progressDays: 0,
      totalDays: cityDays,
    };
    nextTerritories[cityId] = {
      ...t,
      recruitmentQueue: [...(t.recruitmentQueue || []), queuedItem],
    };
  });

  const totalTroops = totalSteps * troopStep;
  const totalGold = totalSteps * goldCostPerStep;
  const scopeLabel =
    scope === 'BORDER'
      ? 'Sınır Seferberliği'
      : scope === 'BARRACKS'
      ? 'Asker Ocağı & Kışla Seferberliği'
      : 'Ulusal Toplu Seferberlik';

  sound.playRecruit();
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
    ...(totalTroops > 0
      ? {
          recruitFeedback: {
            id: `rec_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            troopsAdded: totalTroops,
            goldSpent: totalGold,
            label: `${stepsPerCity.size} Şehir: +${totalTroops.toLocaleString('tr-TR')} (${maxDays}g)`,
            timestamp: Date.now(),
          },
        }
      : {}),
    toastMessage: `🛡️ ${scopeLabel}: ${stepsPerCity.size} şehirde +${totalTroops.toLocaleString('tr-TR')} ${pkg.label} eğitime alındı (en fazla ${maxDays} gün, -${totalGold.toLocaleString('tr-TR')} Altın).`,
  };
}

export function batchBorderMobilizationDomain(params: {
  territories: Record<string, Territory>;
  nations: Record<string, Nation>;
  playerNationId: string;
  unitMode?: BatchRecruitUnitMode;
  scope?: BatchRecruitScope;
  tick?: number;
}): EmpireActionPatch {
  return batchRecruitUnitsDomain({
    scope: params.scope ?? 'BORDER',
    unitMode: params.unitMode ?? 'infantry',
    territories: params.territories,
    nations: params.nations,
    playerNationId: params.playerNationId,
    tick: params.tick,
  });
}

export const NUCLEAR_STRIKE_GOLD_COST = 1500;
export const NUCLEAR_STRIKE_COOLDOWN_DAYS = 15;

export function launchNuclearStrikeDomain(params: {
  territoryId: string;
  territories: Record<string, Territory>;
  nations: Record<string, Nation>;
  relations: Record<string, DiplomaticRelation>;
  wars: ActiveWar[];
  playerNationId: string;
  tick?: number;
  gameMode?: GameModeId;
  newsEvents?: WorldNewsEvent[];
}): EmpireActionPatch {
  const {
    territoryId,
    territories,
    nations,
    relations,
    wars,
    playerNationId,
    tick = 0,
    gameMode = 'EMPIRES_1440',
    newsEvents = [],
  } = params;

  const player = nations[playerNationId];
  const target = territories[territoryId];
  if (!player || !target) return {};

  if (!player.unlockedTechs?.includes('mil_10')) {
    return {
      toastMessage:
        '☢️ Nükleer Füze fırlatmak için Çağ X "2026 Nükleer Füze Doktrini" teknolojisini açmalısınız!',
    };
  }
  if (target.ownerId === playerNationId) {
    return { toastMessage: 'Kendi şehrinize nükleer füze fırlatamazsınız.' };
  }
  if (!isAtWar(wars, playerNationId, target.ownerId)) {
    return {
      toastMessage: '☢️ Nükleer füze yalnızca aktif savaş halindeki düşman şehirlerine fırlatılabilir.',
    };
  }

  const lastStrike = player.lastNuclearStrikeTick;
  if (
    typeof lastStrike === 'number' &&
    tick - lastStrike < NUCLEAR_STRIKE_COOLDOWN_DAYS
  ) {
    const rem = Math.max(1, NUCLEAR_STRIKE_COOLDOWN_DAYS - (tick - lastStrike));
    return {
      toastMessage: `☢️ Stratejik füze siloları yeniden yükleniyor (${rem} gün kaldı).`,
    };
  }

  if (player.treasury < NUCLEAR_STRIKE_GOLD_COST) {
    return {
      toastMessage: `☢️ Nükleer füze ateşlemek için ${NUCLEAR_STRIKE_GOLD_COST.toLocaleString('tr-TR')} Altın gerekli.`,
    };
  }

  sound.playWarHorn();
  const enemy = nations[target.ownerId];
  const prevGarrison = target.garrison || 0;
  const remainingGarrison = Math.max(0, Math.round(prevGarrison * 0.22));
  const casualties = Math.max(0, prevGarrison - remainingGarrison);
  const curUnits = target.units || { infantry: prevGarrison, armor: 0, airDrone: 0 };

  const curBld = target.buildings;
  const damagedBuildings = {
    ...curBld,
    factory: Math.max(0, (curBld.factory || 0) - 1),
    barracks: Math.max(0, (curBld.barracks || 0) - 1),
    fortress: Math.max(0, (curBld.fortress || 0) - 1),
    tradeHub: Math.max(0, (curBld.tradeHub || 0) - 1),
    armyHearth: Math.max(0, (curBld.armyHearth || 0) - 1),
  };

  const nextTerritories: Record<string, Territory> = {
    ...territories,
    [territoryId]: {
      ...target,
      garrison: remainingGarrison,
      units: {
        infantry: Math.round((curUnits.infantry || 0) * 0.22),
        armor: Math.round((curUnits.armor || 0) * 0.22),
        airDrone: Math.round((curUnits.airDrone || 0) * 0.22),
      },
      castleWallHp: 0,
      buildings: damagedBuildings,
      unrest: Math.min(100, (target.unrest || 0) + 40),
    },
  };

  const aeGain = adjustAggressiveExpansionGain(player, 18);
  const updatedPlayer: Nation = {
    ...player,
    treasury: player.treasury - NUCLEAR_STRIKE_GOLD_COST,
    lastNuclearStrikeTick: tick,
    aggressiveExpansion: Math.min(
      100,
      Number(((player.aggressiveExpansion || 0) + aeGain).toFixed(1))
    ),
  };

  const nextNations: Record<string, Nation> = {
    ...nations,
    [playerNationId]: updatedPlayer,
  };

  let nextNews: WorldNewsEvent[] = [
    {
      id: `news_nuke_${Date.now()}`,
      tick,
      dateStr: formatGameDate(tick, gameMode),
      title: `☢️ NÜKLEER FÜZE SALDIRISI: ${target.name} Vuruldu!`,
      description: `${player.name}, ${enemy?.name || 'düşman'} şehri ${target.name} üzerine stratejik nükleer füze fırlattı! ${casualties.toLocaleString('tr-TR')} asker yok edildi, surlar çöktü (+${aeGain} Agresiflik).`,
      type: 'WAR',
    },
    ...newsEvents.slice(0, 39),
  ];

  const coalitionRes = evaluateWorldCoalitionAt100AE({
    targetNationId: playerNationId,
    nations: nextNations,
    territories: nextTerritories,
    relations,
    wars,
    tick,
    gameMode,
    newsEvents: nextNews,
    playerNationId,
  });

  return {
    nations: nextNations,
    territories: nextTerritories,
    wars: coalitionRes.wars,
    relations: coalitionRes.relations,
    newsEvents: coalitionRes.newsEvents,
    ...(coalitionRes.warAnnouncement
      ? { warAnnouncement: coalitionRes.warAnnouncement }
      : {}),
    toastMessage: coalitionRes.triggered
      ? `☢️ ${target.name} nükleer füzeyle vuruldu (-${casualties.toLocaleString('tr-TR')} düşman)! ${coalitionRes.toast}`
      : `☢️ ${target.name} stratejik nükleer füzeyle vuruldu! -${casualties.toLocaleString('tr-TR')} düşman askeri, surlar sıfırlandı (+${aeGain} Agresiflik).`,
  };
}
