import {
  ArmyMovement,
  DiplomaticRelation,
  GameModeId,
  Nation,
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
  calculateNationEconomy,
  formatGameDate,
} from '../simulationEngine';
import { DEFAULT_LORD_LOYALTY } from '../pashaAndFiefEngine';
import { sound } from '../../utils/soundEngine';
import { EmpireActionPatch } from './empireActionTypes';

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
