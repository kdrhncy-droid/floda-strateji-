import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Flame,
  Shield,
  Swords,
  Users,
  X,
} from 'lucide-react';
import {
  ActiveWar,
  DiplomaticActionType,
  DiplomaticRelation,
  Nation,
  Territory,
} from '../../types/game';
import {
  computeNationEconomySummary,
  getOrCreateRelation,
  isAtWar,
} from '../../engine/simulationEngine';
import { NationFlagCanvasBadge } from '../../map/nationFlagRenderer';
import { cleanNationName } from '../../utils/formatters';
import { sound } from '../../utils/soundEngine';
import { useAccessibleDialog } from '../../hooks/useAccessibleDialog';

interface WarDeclarationModalProps {
  targetNationId: string | null;
  playerNationId: string;
  nations: Record<string, Nation>;
  territories: Record<string, Territory>;
  relations: Record<string, DiplomaticRelation>;
  wars: ActiveWar[];
  tick: number;
  onClose: () => void;
  onConfirmWar: (targetNationId: string, calledAllyIds: string[]) => void;
  onQuickAction: (targetNationId: string, action: DiplomaticActionType) => void;
}

export const WarDeclarationModal: React.FC<WarDeclarationModalProps> = ({
  targetNationId,
  playerNationId,
  nations,
  territories,
  relations,
  wars,
  tick,
  onClose,
  onConfirmWar,
  onQuickAction,
}) => {
  const target = targetNationId ? nations[targetNationId] : null;
  const player = nations[playerNationId];
  const isOpen = Boolean(target && player && target.id !== player.id);
  const dialogRef = useAccessibleDialog(isOpen, onClose);

  // Target's defensive coalition (Defensive pact + Offensive pact + Vassals)
  const targetDefenders = useMemo(() => {
    if (!target) return [];
    const seen = new Set<string>();
    const list: { nation: Nation; reason: string }[] = [];

    for (const rel of Object.values(relations)) {
      if (rel.nationA !== target.id && rel.nationB !== target.id) continue;
      const otherId = rel.nationA === target.id ? rel.nationB : rel.nationA;
      if (otherId === playerNationId || otherId === target.id) continue;
      const other = nations[otherId];
      if (!other || other.isEliminated || seen.has(otherId)) continue;
      if (
        rel.allianceType === 'DEFENSIVE' ||
        rel.allianceType === 'OFFENSIVE' ||
        (rel.isAllied && !rel.allianceType)
      ) {
        seen.add(otherId);
        list.push({
          nation: other,
          reason:
            rel.allianceType === 'OFFENSIVE'
              ? 'Tam İttifak'
              : 'Savunma Paktı',
        });
      }
    }

    for (const n of Object.values(nations)) {
      if (
        !n.isEliminated &&
        n.vassalOf === target.id &&
        n.id !== playerNationId &&
        !seen.has(n.id)
      ) {
        seen.add(n.id);
        list.push({ nation: n, reason: 'Vasal Devlet' });
      }
    }
    return list;
  }, [target, relations, nations, playerNationId]);

  // Player's selectable allies (Offensive, Defensive, Allied, or Vassal)
  const playerAllies = useMemo(() => {
    if (!target) return [];
    const seen = new Set<string>();
    const list: { nation: Nation; kind: 'OFFENSIVE' | 'DEFENSIVE' | 'VASSAL'; autoChecked: boolean }[] = [];

    for (const rel of Object.values(relations)) {
      if (rel.nationA !== playerNationId && rel.nationB !== playerNationId) continue;
      const otherId = rel.nationA === playerNationId ? rel.nationB : rel.nationA;
      if (otherId === target.id || otherId === playerNationId) continue;
      const other = nations[otherId];
      if (!other || other.isEliminated || seen.has(otherId)) continue;
      // Don't offer allies that are already pledged to defend the target
      if (targetDefenders.some((d) => d.nation.id === otherId)) continue;

      if (rel.allianceType === 'OFFENSIVE' || (rel.isAllied && !rel.allianceType)) {
        seen.add(otherId);
        list.push({ nation: other, kind: 'OFFENSIVE', autoChecked: true });
      } else if (rel.allianceType === 'DEFENSIVE') {
        seen.add(otherId);
        list.push({ nation: other, kind: 'DEFENSIVE', autoChecked: false });
      }
    }

    for (const n of Object.values(nations)) {
      if (
        !n.isEliminated &&
        n.vassalOf === playerNationId &&
        n.id !== target.id &&
        !seen.has(n.id) &&
        !targetDefenders.some((d) => d.nation.id === n.id)
      ) {
        seen.add(n.id);
        list.push({ nation: n, kind: 'VASSAL', autoChecked: true });
      }
    }

    return list;
  }, [target, relations, nations, playerNationId, targetDefenders]);

  const [selectedAllyIds, setSelectedAllyIds] = useState<string[]>([]);

  useEffect(() => {
    if (!target) {
      setSelectedAllyIds([]);
      return;
    }
    setSelectedAllyIds(
      playerAllies.filter((a) => a.autoChecked).map((a) => a.nation.id)
    );
  }, [target?.id]);

  if (!isOpen || !target || !player) return null;

  const rel = getOrCreateRelation(relations, player.id, target.id);
  const existingWar = isAtWar(wars, player.id, target.id);
  const targetStats = computeNationEconomySummary(target, territories);
  const targetArmy = Object.values(territories)
    .filter((t) => t.ownerId === target.id)
    .reduce((sum, t) => sum + (t.garrison || 0), 0);

  let blockReason: string | null = null;
  if (existingWar) {
    blockReason = 'Bu devletle zaten aktif bir savaş içindesiniz.';
  } else if (rel.truceUntilTick && tick < rel.truceUntilTick) {
    blockReason = `Aktif barış ateşkesi sürüyor (${rel.truceUntilTick - tick} gün kaldı).`;
  } else if (rel.hasNonAggression) {
    blockReason = 'Aktif Saldırmazlık Paktı var. Önce Diplomasi ekranından feshedin.';
  } else if (rel.score > -30) {
    blockReason = `Savaş ilanı için ilişki -30 veya altında olmalı (Mevcut: ${
      rel.score > 0 ? `+${rel.score}` : rel.score
    }).`;
  }

  const toggleAlly = (allyId: string) => {
    sound.playClick();
    setSelectedAllyIds((prev) =>
      prev.includes(allyId)
        ? prev.filter((id) => id !== allyId)
        : [...prev, allyId]
    );
  };

  return (
    <div
      className="fixed inset-0 z-[65] flex items-center justify-center p-3 bg-black/80 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="war-declaration-modal-title"
        tabIndex={-1}
        data-testid="war-declaration-modal"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg max-h-[88dvh] flex flex-col rounded-2xl bg-[#14100c] border border-rose-500/60 shadow-2xl text-[#f3ead7] overflow-hidden"
      >
        {/* Header */}
        <div className="px-4 py-3 bg-gradient-to-r from-[#2c1215] via-[#1b1510] to-[#14100c] border-b border-rose-500/35 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-rose-900/75 border border-rose-500/55 flex items-center justify-center shrink-0">
              <Swords className="w-4 h-4 text-rose-200" />
            </div>
            <div className="min-w-0">
              <h3
                id="war-declaration-modal-title"
                className="font-display font-bold text-sm sm:text-base text-[#faf3e3] truncate"
              >
                Savaş İlanı Hazırlığı
              </h3>
              <p className="text-[11px] text-rose-300 truncate">
                {cleanNationName(target.name)} üzerine sefer ve ittifak durumu
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Savaş ilanı menüsünü kapat"
            className="w-8 h-8 rounded-lg bg-[#1b1510] hover:bg-[#2a2117] border border-[#caa15a]/30 flex items-center justify-center text-[#b8a990] hover:text-white cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3 overflow-y-auto">
          {/* Target Overview Strip */}
          <div className="rounded-xl bg-[#1a140f] border border-[#caa15a]/35 p-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <NationFlagCanvasBadge
                nationId={target.id}
                flagCode={target.flagCode}
                color={target.color}
                width={38}
                height={26}
              />
              <div className="min-w-0">
                <div className="text-sm font-bold text-[#faf3e3] truncate">
                  {cleanNationName(target.name)}
                </div>
                <div className="text-[11px] font-mono-num text-[#c5b79e]">
                  {targetStats.provinceCount} Eyalet · Mevcut Ekonomi{' '}
                  <strong className="text-[#e0b86e]">
                    {targetStats.totalEconomy.toLocaleString('tr-TR')}
                  </strong>
                </div>
              </div>
            </div>
            <div className="text-right font-mono-num shrink-0">
              <div className="text-xs font-extrabold text-rose-300">
                {(targetArmy / 1000).toFixed(1)}B Asker
              </div>
              <div className="text-[10.5px] text-[#b8a990]">
                İlişki:{' '}
                <strong className={rel.score <= -30 ? 'text-rose-400' : 'text-[#e0b86e]'}>
                  {rel.score > 0 ? `+${rel.score}` : rel.score}
                </strong>
              </div>
            </div>
          </div>

          {/* Target's Alliance / Defensive Pacts */}
          <section
            data-testid="war-decl-target-allies"
            className="rounded-xl bg-[#18120e] border border-[#caa15a]/30 p-3 space-y-2"
          >
            <div className="flex items-center justify-between text-xs font-bold text-[#e0b86e]">
              <span className="inline-flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5" />
                <span>İttifak — Hedefin Savunma Ortakları</span>
              </span>
              <span className="font-mono-num text-[11px]">
                {targetDefenders.length} Ülke
              </span>
            </div>
            {targetDefenders.length === 0 ? (
              <div className="text-[11px] text-[#9b8e78]">
                Hedef ülkenin savaşa katılacak aktif müttefiki veya savunma paktı yok.
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {targetDefenders.map((entry) => (
                  <div
                    key={entry.nation.id}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-950/45 border border-rose-500/40 text-[11px]"
                  >
                    <NationFlagCanvasBadge
                      nationId={entry.nation.id}
                      flagCode={entry.nation.flagCode}
                      color={entry.nation.color}
                      width={20}
                      height={14}
                    />
                    <span className="font-bold text-rose-100">
                      {cleanNationName(entry.nation.name)}
                    </span>
                    <span className="text-[9.5px] text-rose-300">
                      ({entry.reason})
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Player's Call Allies Checkboxes */}
          <section
            data-testid="war-decl-call-allies"
            className="rounded-xl bg-[#18120e] border border-[#caa15a]/30 p-3 space-y-2"
          >
            <div className="flex items-center justify-between text-xs font-bold text-emerald-300">
              <span className="inline-flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                <span>Müttefiki Savaşa Çağır</span>
              </span>
              <span className="font-mono-num text-[11px] text-[#e0b86e]">
                {selectedAllyIds.length} / {playerAllies.length} Seçili
              </span>
            </div>

            {playerAllies.length === 0 ? (
              <div className="text-[11px] text-[#9b8e78]">
                Savaşa çağrılabilecek aktif müttefikiniz veya vasalınız bulunmuyor.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-0.5">
                {playerAllies.map((entry) => {
                  const checked = selectedAllyIds.includes(entry.nation.id);
                  const kindLabel =
                    entry.kind === 'VASSAL'
                      ? 'Vasal'
                      : entry.kind === 'OFFENSIVE'
                      ? 'Tam İttifak'
                      : 'Savunma Paktı';
                  return (
                    <label
                      key={entry.nation.id}
                      data-testid={`call-ally-checkbox-${entry.nation.id}`}
                      className={`min-h-[40px] px-2.5 py-1.5 rounded-xl border flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                        checked
                          ? 'bg-[#251d13] border-[#e0b86e]/70 text-[#faf3e3]'
                          : 'bg-[#120e0a] border-[#caa15a]/25 text-[#c5b79e] hover:border-[#caa15a]/45'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleAlly(entry.nation.id)}
                          className="sr-only"
                        />
                        <span
                          className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 ${
                            checked
                              ? 'bg-[#e0b86e] border-[#f3ead7] text-[#14100c]'
                              : 'bg-black/40 border-[#caa15a]/40'
                          }`}
                        >
                          {checked && <Check className="w-3 h-3 stroke-[3]" />}
                        </span>
                        <NationFlagCanvasBadge
                          nationId={entry.nation.id}
                          flagCode={entry.nation.flagCode}
                          color={entry.nation.color}
                          width={22}
                          height={15}
                        />
                        <span className="text-xs font-bold truncate">
                          {cleanNationName(entry.nation.name)}
                        </span>
                      </div>
                      <span className="text-[10px] font-semibold text-[#e0b86e] shrink-0">
                        {kindLabel}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </section>

          {/* Block Reason + Quick Insult Option */}
          {blockReason && (
            <div className="rounded-xl bg-rose-950/45 border border-rose-500/45 px-3 py-2.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-rose-100">
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <AlertTriangle className="w-4 h-4 text-rose-300 shrink-0" />
                <span>{blockReason}</span>
              </div>
              {!existingWar &&
                !rel.hasNonAggression &&
                (!rel.truceUntilTick || tick >= rel.truceUntilTick) &&
                rel.score > -30 && (
                  <button
                    type="button"
                    data-testid="war-decl-quick-insult-btn"
                    onClick={() => onQuickAction(target.id, 'INSULT')}
                    className="min-h-[34px] px-2.5 py-1 rounded-lg bg-rose-700 hover:bg-rose-600 text-white font-bold inline-flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <Flame className="w-3.5 h-3.5" />
                    <span>Hakaret Et (-30)</span>
                  </button>
                )}
            </div>
          )}

          {/* Footer Buttons */}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-[#1b1510] hover:bg-[#261d14] border border-[#caa15a]/35 text-xs font-semibold text-[#d8cbb5] cursor-pointer"
            >
              Vazgeç
            </button>
            <button
              type="button"
              data-testid="confirm-war-declaration-btn"
              disabled={Boolean(blockReason)}
              onClick={() => {
                sound.playClick();
                onConfirmWar(target.id, selectedAllyIds);
              }}
              className={`min-h-[44px] flex-1 px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 transition-colors ${
                blockReason
                  ? 'bg-[#2a1d1d] border border-rose-500/30 text-rose-300/60 cursor-not-allowed'
                  : 'bg-rose-700 hover:bg-rose-600 border border-rose-400/60 text-white shadow-lg cursor-pointer'
              }`}
            >
              <Swords className="w-4 h-4" />
              <span>
                Savaş İlan Et
                {selectedAllyIds.length > 0
                  ? ` (+${selectedAllyIds.length} Müttefik)`
                  : ''}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
