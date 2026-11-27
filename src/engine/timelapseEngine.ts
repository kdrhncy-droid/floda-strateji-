import {
  CampaignTimelapse,
  GameModeId,
  Nation,
  Territory,
  TimelapseArchiveRecord,
  TimelapseDeltaFrame,
  TimelapseMilestone,
  TimelapseMilestoneType,
  TimelapseNationSnapshot,
  WorldNewsEvent,
} from '../types/game';
import { formatGameDate } from './simulationEngine';

export const MAX_TIMELAPSE_FRAMES = 600;
export const MAX_TIMELAPSE_MILESTONES = 160;

export function getGameYearForTick(
  tick: number,
  gameMode: GameModeId | string | undefined
): number {
  const startYear = gameMode === 'EMPIRES_1440' ? 1440 : 2026;
  const safeTick = Number.isFinite(tick) ? Math.max(0, Math.floor(tick)) : 0;
  const dt = new Date(Date.UTC(startYear, 0, 1));
  dt.setUTCDate(dt.getUTCDate() + safeTick);
  return dt.getUTCFullYear();
}

function buildNationSnapshotMap(
  nations: Record<string, Nation>
): Record<string, TimelapseNationSnapshot> {
  const result: Record<string, TimelapseNationSnapshot> = {};
  for (const [id, nat] of Object.entries(nations)) {
    if (!nat) continue;
    result[id] = {
      id: nat.id,
      name: nat.name,
      color: nat.color,
      flagCode: nat.flagCode,
      capitalTerritoryId: nat.capitalTerritoryId,
    };
  }
  return result;
}

function computeProvinceLeaderStats(
  owners: Record<string, string>,
  playerNationId: string
): {
  playerProvinceCount: number;
  topNationId?: string;
  topNationProvinceCount?: number;
} {
  const counts: Record<string, number> = {};
  for (const ownerId of Object.values(owners)) {
    if (!ownerId) continue;
    counts[ownerId] = (counts[ownerId] || 0) + 1;
  }
  let topNationId: string | undefined;
  let topNationProvinceCount = 0;
  for (const [nId, count] of Object.entries(counts)) {
    if (count > topNationProvinceCount) {
      topNationProvinceCount = count;
      topNationId = nId;
    }
  }
  return {
    playerProvinceCount: counts[playerNationId] || 0,
    topNationId,
    topNationProvinceCount,
  };
}

export function createInitialTimelapse(params: {
  id?: string;
  gameMode: GameModeId;
  playerNationId: string;
  nations: Record<string, Nation>;
  territories: Record<string, Territory>;
  tick?: number;
}): CampaignTimelapse {
  const {
    id,
    gameMode,
    playerNationId,
    nations,
    territories,
    tick = 0,
  } = params;
  const startYear = getGameYearForTick(tick, gameMode);
  const initialOwners: Record<string, string> = {};
  for (const [tId, terr] of Object.entries(territories)) {
    if (terr?.ownerId) {
      initialOwners[tId] = terr.ownerId;
    }
  }

  const nationSnapshots = buildNationSnapshotMap(nations);
  const playerNation = nationSnapshots[playerNationId];
  const playerNationName = playerNation?.name || 'Bilinmeyen Devlet';
  const stats = computeProvinceLeaderStats(initialOwners, playerNationId);
  const dateStr = formatGameDate(tick, gameMode);

  const initialFrame: TimelapseDeltaFrame = {
    index: 0,
    tick,
    year: startYear,
    dateStr,
    ownerDeltas: {},
    ...stats,
  };

  const initialMilestone: TimelapseMilestone = {
    id: `ms_start_${tick}`,
    tick,
    year: startYear,
    dateStr,
    title: `${playerNationName} Seferi Başladı`,
    type: 'START',
  };

  return {
    version: 1,
    id:
      id ||
      `tl_${gameMode}_${playerNationId}_${Date.now().toString(36)}_${Math.random()
        .toString(36)
        .slice(2, 6)}`,
    gameMode,
    playerNationId,
    playerNationName,
    startYear,
    lastRecordedTick: tick,
    lastRecordedYear: startYear,
    initialOwners,
    nationSnapshots,
    frames: [initialFrame],
    milestones: [initialMilestone],
  };
}

function classifyNewsMilestoneType(
  event: WorldNewsEvent
): TimelapseMilestoneType | null {
  const titleLower = (event.title || '').toLowerCase();
  if (titleLower.includes('kuruldu') || titleLower.includes('imparatorlu') || event.title.includes('👑')) {
    return 'EMPIRE';
  }
  if (
    titleLower.includes('tahta') ||
    titleLower.includes('cülus') ||
    titleLower.includes('seçildi') ||
    titleLower.includes('vefat')
  ) {
    return 'SUCCESSION';
  }
  if (titleLower.includes('isyan') || titleLower.includes('ayaklan')) {
    return 'REBELLION';
  }
  if (event.type === 'COALITION') return 'COALITION';
  if (event.type === 'PEACE') return 'PEACE';
  if (event.type === 'WAR') return 'WAR';
  return null;
}

function sanitizeMilestoneTitle(rawTitle: string): string {
  return rawTitle
    .replace(/^[^\p{L}\p{N}]+/u, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 96);
}

export function extractNewMilestones(
  existingMilestones: TimelapseMilestone[],
  newsEvents: WorldNewsEvent[] | undefined,
  gameMode: GameModeId,
  minTickExclusive: number
): TimelapseMilestone[] {
  if (!newsEvents || newsEvents.length === 0) return existingMilestones;
  if (existingMilestones.length >= MAX_TIMELAPSE_MILESTONES) {
    return existingMilestones;
  }

  const seenKeys = new Set<string>();
  for (const ms of existingMilestones) {
    seenKeys.add(`${ms.tick}|${ms.title}`);
  }

  const additions: TimelapseMilestone[] = [];
  // Scan chronologically oldest -> newest among events newer than minTickExclusive
  const candidates = newsEvents
    .filter((ev) => ev && ev.tick >= minTickExclusive)
    .slice()
    .sort((a, b) => a.tick - b.tick);

  for (const ev of candidates) {
    const msType = classifyNewsMilestoneType(ev);
    if (!msType) continue;
    const cleanTitle = sanitizeMilestoneTitle(ev.title || '');
    if (!cleanTitle) continue;
    const dedupKey = `${ev.tick}|${cleanTitle}`;
    if (seenKeys.has(dedupKey)) continue;
    seenKeys.add(dedupKey);

    additions.push({
      id: ev.id || `ms_${ev.tick}_${additions.length}`,
      tick: ev.tick,
      year: getGameYearForTick(ev.tick, gameMode),
      dateStr: ev.dateStr || formatGameDate(ev.tick, gameMode),
      title: cleanTitle,
      type: msType,
    });

    if (existingMilestones.length + additions.length >= MAX_TIMELAPSE_MILESTONES) {
      break;
    }
  }

  if (additions.length === 0) return existingMilestones;
  return [...existingMilestones, ...additions];
}

export function reconstructTimelapseState(
  timelapse: CampaignTimelapse,
  targetFrameIndex: number
): {
  frame: TimelapseDeltaFrame;
  frameIndex: number;
  owners: Record<string, string>;
  nationSnapshots: Record<string, TimelapseNationSnapshot>;
  provinceCounts: Record<string, number>;
  activeMilestones: TimelapseMilestone[];
  latestMilestone: TimelapseMilestone | null;
} {
  const frames = timelapse.frames || [];
  const safeMaxIdx = Math.max(0, frames.length - 1);
  const clampedIndex = Math.max(0, Math.min(safeMaxIdx, Math.floor(targetFrameIndex)));

  const owners: Record<string, string> = { ...(timelapse.initialOwners || {}) };
  const nationSnapshots: Record<string, TimelapseNationSnapshot> = {};
  for (const [id, snap] of Object.entries(timelapse.nationSnapshots || {})) {
    nationSnapshots[id] = { ...snap };
  }

  for (let i = 0; i <= clampedIndex; i++) {
    const f = frames[i];
    if (!f) continue;
    if (f.ownerDeltas) {
      for (const [tId, newOwner] of Object.entries(f.ownerDeltas)) {
        if (newOwner) owners[tId] = newOwner;
      }
    }
    if (f.nationUpdates) {
      for (const [nId, upd] of Object.entries(f.nationUpdates)) {
        if (!upd) continue;
        nationSnapshots[nId] = {
          ...(nationSnapshots[nId] || {
            id: nId,
            name: upd.name || nId,
            color: upd.color || '#64748b',
            flagCode: upd.flagCode || nId.slice(0, 3),
          }),
          ...upd,
        };
      }
    }
  }

  const provinceCounts: Record<string, number> = {};
  for (const ownerId of Object.values(owners)) {
    if (!ownerId) continue;
    provinceCounts[ownerId] = (provinceCounts[ownerId] || 0) + 1;
  }

  const frame = frames[clampedIndex] || {
    index: 0,
    tick: 0,
    year: timelapse.startYear,
    dateStr: formatGameDate(0, timelapse.gameMode),
    ownerDeltas: {},
    playerProvinceCount: provinceCounts[timelapse.playerNationId] || 0,
  };

  const activeMilestones = (timelapse.milestones || []).filter(
    (m) => m.tick <= frame.tick
  );
  const latestMilestone =
    activeMilestones.length > 0
      ? activeMilestones[activeMilestones.length - 1]
      : null;

  return {
    frame,
    frameIndex: clampedIndex,
    owners,
    nationSnapshots,
    provinceCounts,
    activeMilestones,
    latestMilestone,
  };
}

function buildDeltaBetweenStateAndTerritories(
  timelapse: CampaignTimelapse,
  nations: Record<string, Nation>,
  territories: Record<string, Territory>
): {
  ownerDeltas: Record<string, string>;
  nationUpdates?: Record<string, Partial<TimelapseNationSnapshot>>;
  playerProvinceCount: number;
  topNationId?: string;
  topNationProvinceCount?: number;
} {
  const lastIdx = Math.max(0, timelapse.frames.length - 1);
  const prevReconstructed = reconstructTimelapseState(timelapse, lastIdx);

  const ownerDeltas: Record<string, string> = {};
  const currentOwners: Record<string, string> = {};
  for (const [tId, terr] of Object.entries(territories)) {
    if (!terr?.ownerId) continue;
    currentOwners[tId] = terr.ownerId;
    if (prevReconstructed.owners[tId] !== terr.ownerId) {
      ownerDeltas[tId] = terr.ownerId;
    }
  }

  const nationUpdates: Record<string, Partial<TimelapseNationSnapshot>> = {};
  let hasNationUpdate = false;
  for (const [nId, liveNat] of Object.entries(nations)) {
    if (!liveNat) continue;
    const prevNat = prevReconstructed.nationSnapshots[nId];
    if (!prevNat) {
      nationUpdates[nId] = {
        id: liveNat.id,
        name: liveNat.name,
        color: liveNat.color,
        flagCode: liveNat.flagCode,
        capitalTerritoryId: liveNat.capitalTerritoryId,
      };
      hasNationUpdate = true;
      continue;
    }
    const diff: Partial<TimelapseNationSnapshot> = {};
    let changed = false;
    if (prevNat.name !== liveNat.name) {
      diff.name = liveNat.name;
      changed = true;
    }
    if (prevNat.color !== liveNat.color) {
      diff.color = liveNat.color;
      changed = true;
    }
    if (prevNat.flagCode !== liveNat.flagCode) {
      diff.flagCode = liveNat.flagCode;
      changed = true;
    }
    if (prevNat.capitalTerritoryId !== liveNat.capitalTerritoryId) {
      diff.capitalTerritoryId = liveNat.capitalTerritoryId;
      changed = true;
    }
    if (changed) {
      nationUpdates[nId] = diff;
      hasNationUpdate = true;
    }
  }

  const stats = computeProvinceLeaderStats(
    currentOwners,
    timelapse.playerNationId
  );

  return {
    ownerDeltas,
    ...(hasNationUpdate ? { nationUpdates } : {}),
    ...stats,
  };
}

/**
 * Updates an active CampaignTimelapse during gameplay.
 * - Captures notable world milestones (wars, peaces, coalitions, formed empires, successions).
 * - Appends a compact delta frame whenever the calendar year advances (or forceSnapshot=true).
 */
export function recordTimelapseProgress(
  timelapse: CampaignTimelapse | null,
  params: {
    nextTick: number;
    gameMode: GameModeId;
    playerNationId: string;
    nations: Record<string, Nation>;
    territories: Record<string, Territory>;
    newsEvents?: WorldNewsEvent[];
    forceYearOrTickSnapshot?: boolean;
  }
): CampaignTimelapse {
  const base =
    timelapse ||
    createInitialTimelapse({
      gameMode: params.gameMode,
      playerNationId: params.playerNationId,
      nations: params.nations,
      territories: params.territories,
      tick: params.nextTick,
    });

  const currentYear = getGameYearForTick(params.nextTick, params.gameMode);
  const minScanTick = Math.max(0, base.lastRecordedTick - 2);
  const nextMilestones = extractNewMilestones(
    base.milestones,
    params.newsEvents,
    params.gameMode,
    minScanTick
  );

  const playerNat = params.nations[params.playerNationId];
  const latestPlayerName = playerNat?.name || base.playerNationName;

  const yearRolledOver = currentYear > base.lastRecordedYear;
  const shouldAppendFrame =
    yearRolledOver ||
    (Boolean(params.forceYearOrTickSnapshot) &&
      params.nextTick > base.lastRecordedTick);

  if (!shouldAppendFrame || base.frames.length >= MAX_TIMELAPSE_FRAMES) {
    if (
      nextMilestones === base.milestones &&
      latestPlayerName === base.playerNationName &&
      params.nextTick === base.lastRecordedTick
    ) {
      return base;
    }
    return {
      ...base,
      playerNationName: latestPlayerName,
      lastRecordedTick: Math.max(base.lastRecordedTick, params.nextTick),
      milestones: nextMilestones,
    };
  }

  const deltaResult = buildDeltaBetweenStateAndTerritories(
    base,
    params.nations,
    params.territories
  );

  const nextFrame: TimelapseDeltaFrame = {
    index: base.frames.length,
    tick: params.nextTick,
    year: currentYear,
    dateStr: formatGameDate(params.nextTick, params.gameMode),
    ownerDeltas: deltaResult.ownerDeltas,
    ...(deltaResult.nationUpdates
      ? { nationUpdates: deltaResult.nationUpdates }
      : {}),
    playerProvinceCount: deltaResult.playerProvinceCount,
    topNationId: deltaResult.topNationId,
    topNationProvinceCount: deltaResult.topNationProvinceCount,
  };

  return {
    ...base,
    playerNationName: latestPlayerName,
    lastRecordedTick: Math.max(base.lastRecordedTick, params.nextTick),
    lastRecordedYear: Math.max(base.lastRecordedYear, currentYear),
    frames: [...base.frames, nextFrame],
    milestones: nextMilestones,
  };
}

/**
 * Produces a complete playback-ready snapshot including the current mid-year board
 * state so launching Timelapse immediately after conquests or treaties shows up-to-the-day borders.
 */
export function buildLivePlaybackTimelapse(
  timelapse: CampaignTimelapse | null,
  params: {
    tick: number;
    gameMode: GameModeId;
    playerNationId: string;
    nations: Record<string, Nation>;
    territories: Record<string, Territory>;
    newsEvents?: WorldNewsEvent[];
  }
): CampaignTimelapse {
  const updated = recordTimelapseProgress(timelapse, {
    nextTick: params.tick,
    gameMode: params.gameMode,
    playerNationId: params.playerNationId,
    nations: params.nations,
    territories: params.territories,
    newsEvents: params.newsEvents,
    forceYearOrTickSnapshot: false,
  });

  const lastFrame = updated.frames[updated.frames.length - 1];
  if (!lastFrame || params.tick > lastFrame.tick) {
    const delta = buildDeltaBetweenStateAndTerritories(
      updated,
      params.nations,
      params.territories
    );
    const hasChanges =
      Object.keys(delta.ownerDeltas).length > 0 ||
      Boolean(delta.nationUpdates) ||
      updated.frames.length === 1;
    if (hasChanges && updated.frames.length < MAX_TIMELAPSE_FRAMES) {
      const tailFrame: TimelapseDeltaFrame = {
        index: updated.frames.length,
        tick: params.tick,
        year: getGameYearForTick(params.tick, params.gameMode),
        dateStr: formatGameDate(params.tick, params.gameMode),
        ownerDeltas: delta.ownerDeltas,
        ...(delta.nationUpdates ? { nationUpdates: delta.nationUpdates } : {}),
        playerProvinceCount: delta.playerProvinceCount,
        topNationId: delta.topNationId,
        topNationProvinceCount: delta.topNationProvinceCount,
      };
      return {
        ...updated,
        lastRecordedTick: Math.max(updated.lastRecordedTick, params.tick),
        frames: [...updated.frames, tailFrame],
      };
    }
  }
  return updated;
}

/**
 * Projects a reconstructed timelapse frame onto baseline WorldMapCanvas territories & nations
 * so political borders, realm names, and capital markers render cleanly offline.
 */
export function projectTimelapseToWorldState(
  timelapse: CampaignTimelapse,
  frameIndex: number,
  baselineTerritories: Record<string, Territory>,
  baselineNations: Record<string, Nation>
): {
  frame: TimelapseDeltaFrame;
  frameIndex: number;
  territories: Record<string, Territory>;
  nations: Record<string, Nation>;
  provinceCounts: Record<string, number>;
  activeMilestones: TimelapseMilestone[];
  latestMilestone: TimelapseMilestone | null;
} {
  const recon = reconstructTimelapseState(timelapse, frameIndex);

  const projectedNations: Record<string, Nation> = {};
  for (const [nId, baseNat] of Object.entries(baselineNations)) {
    const snap = recon.nationSnapshots[nId];
    const provCount = recon.provinceCounts[nId] || 0;
    projectedNations[nId] = {
      ...baseNat,
      name: snap?.name || baseNat.name,
      color: snap?.color || baseNat.color,
      flagCode: snap?.flagCode || baseNat.flagCode,
      capitalTerritoryId: snap?.capitalTerritoryId || baseNat.capitalTerritoryId,
      isEliminated: provCount === 0,
    };
  }
  // Also materialize any nation present in snapshot that might be absent from current baseline
  for (const [nId, snap] of Object.entries(recon.nationSnapshots)) {
    if (projectedNations[nId]) continue;
    const fallbackTemplate = Object.values(baselineNations)[0];
    if (!fallbackTemplate) continue;
    projectedNations[nId] = {
      ...fallbackTemplate,
      id: nId,
      name: snap.name,
      color: snap.color,
      flagCode: snap.flagCode,
      capitalTerritoryId: snap.capitalTerritoryId || fallbackTemplate.capitalTerritoryId,
      isEliminated: (recon.provinceCounts[nId] || 0) === 0,
    };
  }

  const capitalSet = new Set<string>();
  for (const nat of Object.values(projectedNations)) {
    if (!nat.isEliminated && nat.capitalTerritoryId) {
      capitalSet.add(nat.capitalTerritoryId);
    }
  }

  const projectedTerritories: Record<string, Territory> = {};
  for (const [tId, baseTerr] of Object.entries(baselineTerritories)) {
    const ownerId = recon.owners[tId] || baseTerr.ownerId;
    projectedTerritories[tId] = {
      ...baseTerr,
      ownerId,
      coreOwnerId: ownerId,
      isCapital: capitalSet.has(tId),
      isOccupied: false,
      occupiedById: undefined,
      siege: null,
      garrison: 0,
    };
  }

  return {
    frame: recon.frame,
    frameIndex: recon.frameIndex,
    territories: projectedTerritories,
    nations: projectedNations,
    provinceCounts: recon.provinceCounts,
    activeMilestones: recon.activeMilestones,
    latestMilestone: recon.latestMilestone,
  };
}

const VALID_GAME_MODE_IDS: ReadonlySet<string> = new Set<GameModeId>([
  'EMPIRES_1440',
  'STANDARD_2026',
  'GLOBAL_COALITION_CRISIS',
  'ECONOMIC_HEGEMONY',
  'SANDBOX_EMPIRE',
]);

export function validateCampaignTimelapse(raw: unknown): CampaignTimelapse | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Partial<CampaignTimelapse>;
  if (
    typeof obj.gameMode !== 'string' ||
    !VALID_GAME_MODE_IDS.has(obj.gameMode) ||
    typeof obj.playerNationId !== 'string' ||
    !obj.initialOwners ||
    typeof obj.initialOwners !== 'object' ||
    !obj.nationSnapshots ||
    typeof obj.nationSnapshots !== 'object' ||
    !Array.isArray(obj.frames) ||
    obj.frames.length === 0
  ) {
    return null;
  }

  const validFrames: TimelapseDeltaFrame[] = [];
  for (let i = 0; i < obj.frames.length; i++) {
    const f = obj.frames[i];
    if (!f || typeof f !== 'object' || !f.ownerDeltas || typeof f.ownerDeltas !== 'object') {
      continue;
    }
    validFrames.push({
      index: i,
      tick: Number.isFinite(f.tick) ? Math.max(0, f.tick) : 0,
      year: Number.isFinite(f.year)
        ? f.year
        : getGameYearForTick(f.tick || 0, obj.gameMode),
      dateStr:
        typeof f.dateStr === 'string' && f.dateStr
          ? f.dateStr
          : formatGameDate(f.tick || 0, obj.gameMode),
      ownerDeltas: { ...f.ownerDeltas },
      ...(f.nationUpdates && typeof f.nationUpdates === 'object'
        ? { nationUpdates: { ...f.nationUpdates } }
        : {}),
      playerProvinceCount: Number.isFinite(f.playerProvinceCount)
        ? Math.max(0, f.playerProvinceCount)
        : 0,
      ...(typeof f.topNationId === 'string' ? { topNationId: f.topNationId } : {}),
      ...(Number.isFinite(f.topNationProvinceCount)
        ? { topNationProvinceCount: f.topNationProvinceCount }
        : {}),
    });
  }
  if (validFrames.length === 0) return null;

  const validMilestones: TimelapseMilestone[] = Array.isArray(obj.milestones)
    ? obj.milestones
        .filter(
          (m) =>
            m &&
            typeof m === 'object' &&
            typeof m.title === 'string' &&
            m.title.trim().length > 0
        )
        .map((m, idx) => ({
          id: typeof m.id === 'string' ? m.id : `ms_imp_${idx}`,
          tick: Number.isFinite(m.tick) ? Math.max(0, m.tick) : 0,
          year: Number.isFinite(m.year)
            ? m.year
            : getGameYearForTick(m.tick || 0, obj.gameMode!),
          dateStr:
            typeof m.dateStr === 'string'
              ? m.dateStr
              : formatGameDate(m.tick || 0, obj.gameMode!),
          title: sanitizeMilestoneTitle(m.title),
          type: m.type || 'WAR',
        }))
    : [];

  const firstFrame = validFrames[0];
  const lastFrame = validFrames[validFrames.length - 1];

  return {
    version: 1,
    id:
      typeof obj.id === 'string' && obj.id
        ? obj.id
        : `tl_imp_${Date.now().toString(36)}`,
    gameMode: obj.gameMode,
    playerNationId: obj.playerNationId,
    playerNationName:
      typeof obj.playerNationName === 'string' && obj.playerNationName
        ? obj.playerNationName
        : obj.nationSnapshots[obj.playerNationId]?.name || 'Bilinmeyen Devlet',
    startYear: Number.isFinite(obj.startYear) ? obj.startYear! : firstFrame.year,
    lastRecordedTick: Number.isFinite(obj.lastRecordedTick)
      ? obj.lastRecordedTick!
      : lastFrame.tick,
    lastRecordedYear: Number.isFinite(obj.lastRecordedYear)
      ? obj.lastRecordedYear!
      : lastFrame.year,
    initialOwners: { ...obj.initialOwners },
    nationSnapshots: { ...obj.nationSnapshots },
    frames: validFrames,
    milestones: validMilestones,
  };
}

/**
 * Accepts a standalone TimelapseArchiveRecord JSON, a bare CampaignTimelapse JSON,
 * OR even a standard Floda SaveSlotRecord JSON containing an embedded payload.timelapse.
 */
export function extractTimelapseFromImportedObject(raw: unknown): {
  timelapse: CampaignTimelapse;
  suggestedTitle?: string;
} | null {
  if (!raw || typeof raw !== 'object') return null;
  const candidate = raw as Partial<TimelapseArchiveRecord> & {
    payload?: { timelapse?: unknown; nations?: Record<string, Nation>; playerNationId?: string };
  };

  if (candidate.timelapse) {
    const valid = validateCampaignTimelapse(candidate.timelapse);
    if (valid) {
      return {
        timelapse: valid,
        suggestedTitle: candidate.metadata?.title,
      };
    }
  }

  if (candidate.payload?.timelapse) {
    const valid = validateCampaignTimelapse(candidate.payload.timelapse);
    if (valid) {
      return {
        timelapse: valid,
        suggestedTitle: `${valid.playerNationName} (${valid.startYear}–${valid.lastRecordedYear})`,
      };
    }
  }

  const direct = validateCampaignTimelapse(raw);
  if (direct) {
    return {
      timelapse: direct,
      suggestedTitle: `${direct.playerNationName} (${direct.startYear}–${direct.lastRecordedYear})`,
    };
  }

  return null;
}
