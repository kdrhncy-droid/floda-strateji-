import {
  DiplomaticRelation,
  GameModeId,
  IdeologyId,
  Nation,
  Territory,
  WorldNewsEvent,
} from '../../types/game';
import {
  FORMABLE_EMPIRES,
  IDEOLOGIES,
  getReformsForMode,
  getTechTreeForMode,
} from '../../data/world2026Data';
import { formatGameDate } from '../simulationEngine';
import {
  getOrCreateRelation,
  relationKey,
} from '../core/diplomacyHelpers';
import { sound } from '../../utils/soundEngine';
import { EmpireActionPatch } from './empireActionTypes';

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
