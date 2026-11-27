import { del, get, set } from 'idb-keyval';
import {
  CampaignTimelapse,
  TimelapseArchiveMetadata,
  TimelapseArchiveRecord,
} from '../types/game';
import {
  extractTimelapseFromImportedObject,
  validateCampaignTimelapse,
} from './timelapseEngine';

const ARCHIVE_STORAGE_PREFIX = 'FLODA_TIMELAPSE_ARCHIVE_V1_';
const ARCHIVE_META_INDEX_KEY = 'FLODA_TIMELAPSE_META_INDEX_V1';

const archiveRecordCache: Record<string, TimelapseArchiveRecord> = {};

function getArchiveKey(id: string): string {
  return `${ARCHIVE_STORAGE_PREFIX}${id}`;
}

function readMetaIndex(): Record<string, TimelapseArchiveMetadata> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(ARCHIVE_META_INDEX_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeMetaIndex(index: Record<string, TimelapseArchiveMetadata>): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(ARCHIVE_META_INDEX_KEY, JSON.stringify(index));
  } catch {
    // ignore storage quota errors
  }
}

export function buildTimelapseArchiveMetadata(
  timelapse: CampaignTimelapse,
  options?: { id?: string; title?: string; sourceLabel?: string }
): TimelapseArchiveMetadata {
  const archiveId =
    options?.id ||
    `arch_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const playerSnap = timelapse.nationSnapshots[timelapse.playerNationId];
  const firstFrame = timelapse.frames[0];
  const lastFrame = timelapse.frames[timelapse.frames.length - 1];
  const startYear = firstFrame?.year ?? timelapse.startYear;
  const endYear = lastFrame?.year ?? timelapse.lastRecordedYear;
  const defaultTitle =
    startYear === endYear
      ? `${timelapse.playerNationName} (${startYear})`
      : `${timelapse.playerNationName} (${startYear}–${endYear})`;
  const title = (options?.title || '').trim() || defaultTitle;
  const now = new Date();

  return {
    id: archiveId,
    title: title.slice(0, 80),
    gameMode: timelapse.gameMode,
    playerNationId: timelapse.playerNationId,
    playerNationName: timelapse.playerNationName,
    flagCode: playerSnap?.flagCode || 'TR',
    nationColor: playerSnap?.color || '#C89D54',
    startYear,
    endYear,
    frameCount: timelapse.frames.length,
    milestoneCount: timelapse.milestones.length,
    finalProvinceCount: lastFrame?.playerProvinceCount ?? 0,
    savedAtIso: now.toISOString(),
    savedAtDisplay: now.toLocaleString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
    ...(options?.sourceLabel ? { sourceLabel: options.sourceLabel } : {}),
  };
}

export async function initTimelapseArchiveStorage(): Promise<void> {
  if (typeof window === 'undefined') return;
  const metaIdx = readMetaIndex();
  let indexUpdated = false;

  for (const id of Object.keys(metaIdx)) {
    if (archiveRecordCache[id]) continue;
    const key = getArchiveKey(id);
    try {
      const idbRec = await get<TimelapseArchiveRecord>(key);
      if (idbRec?.timelapse) {
        const validTl = validateCampaignTimelapse(idbRec.timelapse);
        if (validTl) {
          const normalized: TimelapseArchiveRecord = {
            schemaVersion: 1,
            metadata: {
              ...buildTimelapseArchiveMetadata(validTl, {
                id,
                title: idbRec.metadata?.title || metaIdx[id]?.title,
                sourceLabel: idbRec.metadata?.sourceLabel || metaIdx[id]?.sourceLabel,
              }),
              savedAtIso: idbRec.metadata?.savedAtIso || metaIdx[id]?.savedAtIso,
              savedAtDisplay:
                idbRec.metadata?.savedAtDisplay || metaIdx[id]?.savedAtDisplay,
            },
            timelapse: validTl,
          };
          archiveRecordCache[id] = normalized;
          metaIdx[id] = normalized.metadata;
          indexUpdated = true;
          continue;
        }
      }
    } catch {
      // Fallback to localStorage below
    }

    try {
      const lsRaw = localStorage.getItem(key);
      if (lsRaw) {
        const parsed = JSON.parse(lsRaw) as Partial<TimelapseArchiveRecord>;
        const validTl = validateCampaignTimelapse(parsed?.timelapse);
        if (validTl) {
          const normalized: TimelapseArchiveRecord = {
            schemaVersion: 1,
            metadata: {
              ...buildTimelapseArchiveMetadata(validTl, {
                id,
                title: parsed?.metadata?.title || metaIdx[id]?.title,
              }),
              savedAtIso: parsed?.metadata?.savedAtIso || metaIdx[id]?.savedAtIso,
              savedAtDisplay:
                parsed?.metadata?.savedAtDisplay || metaIdx[id]?.savedAtDisplay,
            },
            timelapse: validTl,
          };
          archiveRecordCache[id] = normalized;
          await set(key, normalized).catch(() => {});
          localStorage.removeItem(key);
        }
      }
    } catch {
      // ignore
    }
  }

  if (indexUpdated) {
    writeMetaIndex(metaIdx);
  }
}

if (typeof window !== 'undefined') {
  initTimelapseArchiveStorage().catch(() => {});
}

export function listTimelapseArchives(): TimelapseArchiveMetadata[] {
  const metaIdx = readMetaIndex();
  const list = Object.values(metaIdx).filter(
    (m): m is TimelapseArchiveMetadata => Boolean(m && m.id && m.title)
  );
  list.sort((a, b) => (b.savedAtIso || '').localeCompare(a.savedAtIso || ''));
  return list;
}

export function saveTimelapseToArchive(
  timelapse: CampaignTimelapse,
  options?: { id?: string; title?: string; sourceLabel?: string }
): TimelapseArchiveRecord | null {
  try {
    const valid = validateCampaignTimelapse(timelapse);
    if (!valid) return null;

    const metadata = buildTimelapseArchiveMetadata(valid, options);
    const record: TimelapseArchiveRecord = {
      schemaVersion: 1,
      metadata,
      timelapse: valid,
    };

    archiveRecordCache[metadata.id] = record;
    const metaIdx = readMetaIndex();
    metaIdx[metadata.id] = metadata;
    writeMetaIndex(metaIdx);

    if (typeof window !== 'undefined') {
      set(getArchiveKey(metadata.id), record).catch(() => {
        try {
          localStorage.setItem(getArchiveKey(metadata.id), JSON.stringify(record));
        } catch {
          // ignore
        }
      });
    }

    return record;
  } catch {
    return null;
  }
}

export function loadTimelapseArchive(id: string): TimelapseArchiveRecord | null {
  if (!id) return null;
  if (archiveRecordCache[id]?.timelapse) {
    return archiveRecordCache[id];
  }
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(getArchiveKey(id));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<TimelapseArchiveRecord>;
    const validTl = validateCampaignTimelapse(parsed?.timelapse);
    if (!validTl || !parsed?.metadata) return null;
    const rec: TimelapseArchiveRecord = {
      schemaVersion: 1,
      metadata: parsed.metadata,
      timelapse: validTl,
    };
    archiveRecordCache[id] = rec;
    return rec;
  } catch {
    return null;
  }
}

export function renameTimelapseArchive(
  id: string,
  nextTitle: string
): TimelapseArchiveMetadata | null {
  const cleanTitle = nextTitle.trim().slice(0, 80);
  if (!cleanTitle) return null;

  const metaIdx = readMetaIndex();
  const existingMeta = metaIdx[id] || archiveRecordCache[id]?.metadata;
  if (!existingMeta) return null;

  const updatedMeta: TimelapseArchiveMetadata = {
    ...existingMeta,
    title: cleanTitle,
  };
  metaIdx[id] = updatedMeta;
  writeMetaIndex(metaIdx);

  if (archiveRecordCache[id]) {
    archiveRecordCache[id] = {
      ...archiveRecordCache[id],
      metadata: updatedMeta,
    };
    if (typeof window !== 'undefined') {
      set(getArchiveKey(id), archiveRecordCache[id]).catch(() => {});
    }
  } else if (typeof window !== 'undefined') {
    get<TimelapseArchiveRecord>(getArchiveKey(id))
      .then((rec) => {
        if (rec) {
          const nextRec = { ...rec, metadata: updatedMeta };
          archiveRecordCache[id] = nextRec;
          return set(getArchiveKey(id), nextRec);
        }
      })
      .catch(() => {});
  }

  return updatedMeta;
}

export function deleteTimelapseArchive(id: string): boolean {
  if (!id) return false;
  delete archiveRecordCache[id];
  try {
    const metaIdx = readMetaIndex();
    const existed = Boolean(metaIdx[id]);
    delete metaIdx[id];
    writeMetaIndex(metaIdx);
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(getArchiveKey(id));
    }
    if (typeof window !== 'undefined') {
      del(getArchiveKey(id)).catch(() => {});
    }
    return existed;
  } catch {
    return false;
  }
}

export function exportTimelapseArchiveToJson(
  record: TimelapseArchiveRecord
): void {
  const jsonStr = JSON.stringify(record, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const safeCode = (record.metadata.flagCode || 'fld').toLowerCase();
  const a = document.createElement('a');
  a.href = url;
  a.download = `floda_timelapse_${safeCode}_${record.metadata.startYear}-${record.metadata.endYear}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function importTimelapseArchiveFromJson(
  jsonText: string
): TimelapseArchiveRecord | null {
  try {
    const parsed = JSON.parse(jsonText);
    const extracted = extractTimelapseFromImportedObject(parsed);
    if (!extracted) return null;
    return saveTimelapseToArchive(extracted.timelapse, {
      title: extracted.suggestedTitle,
      sourceLabel: 'İçe Aktarıldı',
    });
  } catch {
    return null;
  }
}
