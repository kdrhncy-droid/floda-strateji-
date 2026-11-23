import React, { useMemo } from 'react';
import {
  AlertTriangle,
  Ban,
  Bot,
  Coins,
  Compass,
  Crown,
  Flag,
  Flame,
  Handshake,
  Landmark,
  MapPin,
  ScrollText,
  Shield,
  Swords,
  Timer,
  X,
} from 'lucide-react';
import {
  ActiveWar,
  ArmyMovement,
  BottomDrawerTab,
  DiplomaticRelation,
  GameModeId,
  Nation,
  Territory,
} from '../../types/game';
import { IDEOLOGIES } from '../../data/world2026Data';
import {
  buildNationDiplomacySummary,
  DiplomacyPeerEntry,
} from '../../engine/nationDiplomacySummary';
import { getOrCreateRelation, isAtWar } from '../../engine/simulationEngine';
import { NationFlagCanvasBadge } from '../../map/nationFlagRenderer';
import { useAccessibleDialog } from '../../hooks/useAccessibleDialog';
import { sound } from '../../utils/soundEngine';
import { DiplomaticActionType, PeaceDealType } from '../drawers/drawerTypes';

interface NationDiplomacyModalProps {
  isOpen: boolean;
  inspectedNationId: string | null;
  playerNationId: string;
  nations: Record<string, Nation>;
  territories: Record<string, Territory>;
  relations: Record<string, DiplomaticRelation>;
  wars: ActiveWar[];
  movements: ArmyMovement[];
  tick: number;
  gameMode: GameModeId;
  aiCommanderEnabled?: boolean;
  isPlayerAtWar?: boolean;
  onToggleAiCommander?: () => void;
  onClose: () => void;
  onSelectInspectedNation: (nationId: string) => void;
  onSelectTerritory: (territoryId: string) => void;
  onSetActiveTab: (tab: BottomDrawerTab) => void;
  onDiplomaticAction: (
    targetNationId: string,
    action: DiplomaticActionType
  ) => void;
  onPeaceDeal: (warId: string, dealType: PeaceDealType) => void;
  onOpenWarModal?: (warId: string) => void;
}

interface SectionProps {
  title: string;
  icon: React.ReactNode;
  entries: DiplomacyPeerEntry[];
  accentClass: string;
  emptyText: string;
  onSelectNation: (nationId: string) => void;
  renderBadge?: (entry: DiplomacyPeerEntry) => React.ReactNode;
}

const DiplomacySectionCard: React.FC<SectionProps> = ({
  title,
  icon,
  entries,
  accentClass,
  emptyText,
  onSelectNation,
  renderBadge,
}) => {
  return (
    <section className="rounded-xl bg-slate-950/85 border border-slate-800/90 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className={`flex items-center gap-1.5 text-xs font-bold ${accentClass}`}>
          {icon}
          <span>{title}</span>
        </div>
        <span className="px-1.5 py-0.5 rounded-md bg-slate-900 border border-slate-800 font-mono-num text-[10px] font-bold text-slate-300">
          {entries.length}
        </span>
      </div>

      {entries.length === 0 ? (
        <p className="text-[11px] text-slate-500 italic">{emptyText}</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {entries.map((entry) => {
            const cleanName = entry.nation.name.replace(/\s*\(1440\)\s*$/, '');
            return (
              <button
                key={entry.nation.id}
                type="button"
                onClick={() => {
                  sound.playClick();
                  onSelectNation(entry.nation.id);
                }}
                title={`${cleanName} ülkesinin diplomasi ağını incele`}
                className="group flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-900/95 hover:bg-slate-800 border border-slate-700/80 hover:border-amber-400/60 transition-colors text-left"
              >
                <NationFlagCanvasBadge
                  nationId={entry.nation.id}
                  flagCode={entry.nation.flagCode}
                  color={entry.nation.color}
                  width={22}
                  height={15}
                />
                <span className="text-[11px] font-semibold text-slate-100 group-hover:text-amber-200 max-w-[130px] truncate">
                  {cleanName}
                </span>
                {renderBadge ? (
                  renderBadge(entry)
                ) : (
                  <span
                    className={`font-mono-num text-[10px] font-bold ${
                      entry.relationScore >= 25
                        ? 'text-emerald-400'
                        : entry.relationScore <= -25
                        ? 'text-rose-400'
                        : 'text-slate-400'
                    }`}
                  >
                    {entry.relationScore > 0
                      ? `+${entry.relationScore}`
                      : entry.relationScore}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
};

export const NationDiplomacyModal: React.FC<NationDiplomacyModalProps> = ({
  isOpen,
  inspectedNationId,
  playerNationId,
  nations,
  territories,
  relations,
  wars,
  movements,
  tick,
  gameMode,
  aiCommanderEnabled = false,
  isPlayerAtWar = false,
  onToggleAiCommander,
  onClose,
  onSelectInspectedNation,
  onSelectTerritory,
  onSetActiveTab,
  onDiplomaticAction,
  onPeaceDeal,
  onOpenWarModal,
}) => {
  const dialogRef = useAccessibleDialog(isOpen, onClose);
  const targetId = inspectedNationId || playerNationId;

  const summary = useMemo(
    () =>
      isOpen
        ? buildNationDiplomacySummary({
            targetNationId: targetId,
            nations,
            territories,
            relations,
            wars,
            movements,
            tick,
            gameMode,
          })
        : null,
    [isOpen, targetId, nations, territories, relations, wars, movements, tick, gameMode]
  );

  const livingNations = useMemo(() => {
    const provCount: Record<string, number> = {};
    for (const t of Object.values(territories)) {
      if (t?.ownerId) {
        provCount[t.ownerId] = (provCount[t.ownerId] || 0) + 1;
      }
    }
    return Object.values(nations)
      .filter((n) => n && !n.isEliminated && (provCount[n.id] || 0) > 0)
      .sort((a, b) => {
        if (a.id === playerNationId) return -1;
        if (b.id === playerNationId) return 1;
        return (provCount[b.id] || 0) - (provCount[a.id] || 0) || a.name.localeCompare(b.name, 'tr');
      });
  }, [nations, territories, playerNationId]);

  if (!isOpen || !summary) return null;

  const isPlayerNation = summary.nation.id === playerNationId;
  const cleanName = summary.nation.name.replace(/\s*\(1440\)\s*$/, '');
  const playerRel = !isPlayerNation
    ? getOrCreateRelation(relations, playerNationId, summary.nation.id)
    : null;
  const activePlayerWar = !isPlayerNation
    ? isAtWar(wars, playerNationId, summary.nation.id)
    : undefined;

  let warBlockReason: string | null = null;
  if (!isPlayerNation && !activePlayerWar && playerRel) {
    if (playerRel.isAllied || playerRel.allianceType) {
      warBlockReason =
        'Müttefik ülkeye savaş ilan edilemez (Önce aktif ittifak/paktı feshedin).';
    } else if (playerRel.hasNonAggression) {
      warBlockReason =
        'Saldırmazlık Paktı aktifken savaş ilan edilemez (Önce paktı iptal edin).';
    } else if (playerRel.truceUntilTick > tick) {
      warBlockReason = `Aktif barış ateşkesi sürüyor (${Math.max(1, playerRel.truceUntilTick - tick)} gün kaldı).`;
    } else if (playerRel.score > -30) {
      warBlockReason = `İlişki puanınız çok yüksek (${playerRel.score > 0 ? `+${playerRel.score}` : playerRel.score}). Savaş ilanı için ilişki -30 veya altında olmalı — 'Hakaret Et' butonunu kullanın.`;
    }
  }

  const focusNationCapital = () => {
    const capId =
      summary.nation.capitalTerritoryId ||
      Object.values(territories).find((t) => t.ownerId === summary.nation.id)?.id;
    if (capId) {
      sound.playClick();
      onSelectTerritory(capId);
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="nation-diplomacy-modal-title"
        tabIndex={-1}
        className="w-full max-w-4xl max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)] bg-[#0a1120] border border-amber-500/45 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100"
      >
        {/* Modal Header: AoH2/AoH3 Nation Emblem, Ruler, Stats & Nation Switcher */}
        <div className="px-3.5 sm:px-5 py-2.5 sm:py-3 bg-gradient-to-r from-slate-900 via-[#0e182d] to-slate-950 border-b border-amber-500/30 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <NationFlagCanvasBadge
              nationId={summary.nation.id}
              flagCode={summary.nation.flagCode}
              color={summary.nation.color}
              width={44}
              height={32}
            />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h2
                  id="nation-diplomacy-modal-title"
                  className="font-display font-bold text-sm sm:text-base text-amber-100 truncate"
                >
                  {cleanName}
                </h2>
                {isPlayerNation ? (
                  <span className="px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 text-[10px] font-black">
                    DEVLETİNİZ
                  </span>
                ) : activePlayerWar ? (
                  <span className="px-1.5 py-0.5 rounded bg-rose-600 text-white text-[10px] font-bold">
                    ⚔️ SAVAŞTASINIZ
                  </span>
                ) : playerRel ? (
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono-num font-bold border ${
                      playerRel.score >= 25
                        ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300'
                        : playerRel.score <= -25
                        ? 'bg-rose-950/80 border-rose-500/50 text-rose-300'
                        : 'bg-slate-900 border-slate-700 text-slate-300'
                    }`}
                  >
                    İlişkiniz: {playerRel.score > 0 ? `+${playerRel.score}` : playerRel.score}
                  </span>
                ) : null}
              </div>
              <div className="text-[11px] text-slate-300 flex flex-wrap items-center gap-1.5">
                <span className="text-amber-300 font-semibold">👑 {summary.rulerName}</span>
                <span className="text-slate-600">·</span>
                <span>{IDEOLOGIES[summary.nation.ideology]?.name ?? 'Monarşi'}</span>
              </div>
            </div>
          </div>

          {/* Right Controls: Switch to Any Nation + Return to Own Nation + Close */}
          <div className="flex items-center gap-1.5 shrink-0">
            {!isPlayerNation && (
              <button
                type="button"
                onClick={() => {
                  sound.playClick();
                  onSelectInspectedNation(playerNationId);
                }}
                className="px-2.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-200 text-[11px] font-bold"
              >
                Benim Ülkem
              </button>
            )}

            <select
              aria-label="İncelenecek ülkeyi seçin"
              value={summary.nation.id}
              onChange={(e) => {
                sound.playClick();
                onSelectInspectedNation(e.target.value);
              }}
              className="max-w-[165px] sm:max-w-[210px] px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-100 font-semibold focus:outline-none focus:border-amber-400"
            >
              {livingNations.map((nat) => (
                <option key={nat.id} value={nat.id}>
                  {nat.id === playerNationId ? '★ ' : ''}
                  {nat.name.replace(/\s*\(1440\)\s*$/, '')}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => {
                sound.playClick();
                onClose();
              }}
              aria-label="Diplomasi özetini kapat"
              className="w-8 h-8 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Compact National Vital Strip */}
        <div className="px-3.5 sm:px-5 py-2 bg-slate-950/90 border-b border-slate-800/80 grid grid-cols-5 gap-1.5 text-center shrink-0">
          <div className="rounded-lg bg-slate-900/90 border border-slate-800 px-2 py-1">
            <div className="text-[10px] text-slate-400">Eyalet</div>
            <div className="font-mono-num text-xs font-bold text-white">
              {summary.provinceCount}
            </div>
          </div>
          <div className="rounded-lg bg-slate-900/90 border border-slate-800 px-2 py-1">
            <div className="text-[10px] text-slate-400">Toplam Ordu</div>
            <div className="font-mono-num text-xs font-bold text-amber-300">
              {(summary.totalArmy / 1000).toFixed(1)}B
            </div>
          </div>
          <div className="rounded-lg bg-slate-900/90 border border-slate-800 px-2 py-1">
            <div className="text-[10px] text-slate-400">Hazine</div>
            <div className="font-mono-num text-xs font-bold text-emerald-300">
              {Math.round(summary.nation.treasury).toLocaleString('tr-TR')}
            </div>
          </div>
          <div className="rounded-lg bg-slate-900/90 border border-slate-800 px-2 py-1">
            <div className="text-[10px] text-slate-400">İstikrar</div>
            <div className="font-mono-num text-xs font-bold text-sky-300">
              %{Math.round(summary.nation.stability)}
            </div>
          </div>
          <div className="rounded-lg bg-slate-900/90 border border-slate-800 px-2 py-1">
            <div className="text-[10px] text-slate-400">Agresiflik</div>
            <div
              className={`font-mono-num text-xs font-bold ${
                summary.nation.aggressiveExpansion >= 50
                  ? 'text-rose-400'
                  : 'text-slate-200'
              }`}
            >
              %{Math.round(summary.nation.aggressiveExpansion)}
            </div>
          </div>
        </div>

        {/* Scrollable Diplomatic Web Body */}
        <div className="p-3 sm:p-4 overflow-y-auto flex-1 space-y-2.5">
          {/* Overlord Banner if vassal */}
          {summary.overlord && (
            <div className="rounded-xl bg-purple-950/40 border border-purple-500/45 px-3 py-2 flex items-center justify-between gap-2 text-xs">
              <span className="text-purple-200 font-semibold flex items-center gap-1.5">
                <Crown className="w-4 h-4 text-purple-300" />
                <span>
                  Hami Devlet (Bağlı Olduğu İmparatorluk):{' '}
                  <strong className="text-white">
                    {summary.overlord.name.replace(/\s*\(1440\)\s*$/, '')}
                  </strong>
                </span>
              </span>
              <button
                type="button"
                onClick={() => {
                  sound.playClick();
                  onSelectInspectedNation(summary.overlord!.id);
                }}
                className="px-2.5 py-1 rounded-lg bg-purple-600/40 hover:bg-purple-600/60 border border-purple-400/50 text-purple-100 text-[11px] font-bold"
              >
                Hamiyi İncele
              </button>
            </div>
          )}

          <p className="text-[11px] text-slate-400">
            Herhangi bir ülkeye dokunarak o devletin tüm savaşlarını, ittifaklarını, fetihlerini ve ateşkeslerini inceleyebilirsiniz.
          </p>

          {/* Conquered & Annexed Nations Card ("Fethedilen & Tarihe Karışan Ülkeler") */}
          <section className="rounded-xl bg-amber-950/25 border border-amber-500/40 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                <Flag className="w-3.5 h-3.5 text-amber-400" />
                <span>Fethedilen & İlhak Edilen Ülkeler</span>
              </div>
              <span className="px-1.5 py-0.5 rounded-md bg-slate-900 border border-amber-500/30 font-mono-num text-[10px] font-bold text-amber-200">
                {summary.conqueredNations.length}
              </span>
            </div>
            {summary.conqueredNations.length === 0 ? (
              <p className="text-[11px] text-slate-400 italic">
                Henüz başka bir devletten fethedilen veya ilhak edilen ülke toprağı bulunmuyor.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {summary.conqueredNations.map((item) => {
                  const conqueredClean = item.nation.name.replace(/\s*\(1440\)\s*$/, '');
                  return (
                    <div
                      key={item.nation.id}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/95 border border-amber-500/35 text-left"
                    >
                      <NationFlagCanvasBadge
                        nationId={item.nation.id}
                        flagCode={item.nation.flagCode}
                        color={item.nation.color}
                        width={22}
                        height={15}
                      />
                      <span className="text-[11px] font-bold text-amber-100 max-w-[140px] truncate">
                        {conqueredClean}
                      </span>
                      <span
                        className={`px-1.5 py-0.2 rounded text-[9px] font-extrabold ${
                          item.isEliminated
                            ? 'bg-rose-500/25 text-rose-200 border border-rose-500/40'
                            : 'bg-amber-500/20 text-amber-200 border border-amber-500/35'
                        }`}
                      >
                        {item.isEliminated
                          ? `Tam İlhak (${item.capturedProvinceCount} Eyalet)`
                          : `+${item.capturedProvinceCount} Eyalet`}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {/* 1. Active Wars / Enemies */}
            <DiplomacySectionCard
              title="Aktif Savaşlar (Düşmanlar)"
              icon={<Swords className="w-3.5 h-3.5 text-rose-400" />}
              entries={summary.activeWars}
              accentClass="text-rose-300"
              emptyText="Aktif bir savaş bulunmuyor."
              onSelectNation={onSelectInspectedNation}
              renderBadge={(entry) => (
                <span
                  className={`font-mono-num text-[10px] font-bold ${
                    (entry.warScore || 0) >= 0 ? 'text-emerald-300' : 'text-rose-300'
                  }`}
                >
                  {(entry.warScore || 0) > 0 ? `+${entry.warScore}` : entry.warScore}%
                </span>
              )}
            />

            {/* 2. Offensive Alliances */}
            <DiplomacySectionCard
              title="Saldırı Paktları & Tam İttifaklar"
              icon={<Swords className="w-3.5 h-3.5 text-emerald-400" />}
              entries={summary.offensiveAllies}
              accentClass="text-emerald-300"
              emptyText="Aktif saldırı paktı veya tam ittifak yok."
              onSelectNation={onSelectInspectedNation}
            />

            {/* 3. Defensive Pacts */}
            <DiplomacySectionCard
              title="Savunma Paktları"
              icon={<Shield className="w-3.5 h-3.5 text-sky-400" />}
              entries={summary.defensivePacts}
              accentClass="text-sky-300"
              emptyText="Aktif savunma paktı yok."
              onSelectNation={onSelectInspectedNation}
            />

            {/* 4. Trade Agreements */}
            <DiplomacySectionCard
              title="Ticaret Anlaşmaları"
              icon={<Coins className="w-3.5 h-3.5 text-amber-400" />}
              entries={summary.tradePartners}
              accentClass="text-amber-300"
              emptyText="İmzalanmış ticaret anlaşması yok."
              onSelectNation={onSelectInspectedNation}
            />

            {/* 5. Active Truces / Barış Yapanlar */}
            <DiplomacySectionCard
              title="Aktif Barış & Ateşkesler"
              icon={<Timer className="w-3.5 h-3.5 text-teal-400" />}
              entries={summary.activeTruces}
              accentClass="text-teal-300"
              emptyText="Devam eden barış ateşkesi yok."
              onSelectNation={onSelectInspectedNation}
              renderBadge={(entry) => (
                <span className="font-mono-num text-[10px] font-bold text-teal-300">
                  {entry.truceDaysRemaining}g
                </span>
              )}
            />

            {/* 6. Non-Aggression Pacts */}
            <DiplomacySectionCard
              title="Saldırmazlık Paktları"
              icon={<Handshake className="w-3.5 h-3.5 text-cyan-400" />}
              entries={summary.nonAggressionPacts}
              accentClass="text-cyan-300"
              emptyText="Saldırmazlık paktı yok."
              onSelectNation={onSelectInspectedNation}
            />

            {/* 7. Military Access */}
            <DiplomacySectionCard
              title="Askerî Geçiş İzinleri"
              icon={<Compass className="w-3.5 h-3.5 text-indigo-400" />}
              entries={summary.militaryAccess}
              accentClass="text-indigo-300"
              emptyText="Askerî geçiş izni bulunmuyor."
              onSelectNation={onSelectInspectedNation}
            />

            {/* 8. Vassals */}
            <DiplomacySectionCard
              title="Vasal Devletler"
              icon={<Crown className="w-3.5 h-3.5 text-purple-400" />}
              entries={summary.vassals}
              accentClass="text-purple-300"
              emptyText="Bağlı vasal devlet bulunmuyor."
              onSelectNation={onSelectInspectedNation}
            />

            {/* 9. Friendly Nations */}
            <DiplomacySectionCard
              title="Dost Ülkeler (İlişki ≥ +25)"
              icon={<Handshake className="w-3.5 h-3.5 text-emerald-400" />}
              entries={summary.friendlyNations}
              accentClass="text-emerald-300"
              emptyText="Yüksek dostluk seviyesinde ülke yok."
              onSelectNation={onSelectInspectedNation}
            />

            {/* 10. Hostile Nations & Embargoes */}
            <DiplomacySectionCard
              title="Hasım Ülkeler (İlişki ≤ -25)"
              icon={<Ban className="w-3.5 h-3.5 text-rose-400" />}
              entries={summary.hostileNations}
              accentClass="text-rose-300"
              emptyText="Düşmanca ilişkide olunan ülke yok."
              onSelectNation={onSelectInspectedNation}
            />

            {summary.embargoes.length > 0 && (
              <div className="md:col-span-2">
                <DiplomacySectionCard
                  title="Ticaret Ambargoları"
                  icon={<Ban className="w-3.5 h-3.5 text-orange-400" />}
                  entries={summary.embargoes}
                  accentClass="text-orange-300"
                  emptyText="Aktif ambargo yok."
                  onSelectNation={onSelectInspectedNation}
                  renderBadge={(entry) => (
                    <span className="text-[10px] font-bold text-orange-300">
                      {entry.embargoDirection === 'MUTUAL'
                        ? 'Karşılıklı'
                        : entry.embargoDirection === 'OUTGOING'
                        ? 'Uyguluyor'
                        : 'Maruz'}
                    </span>
                  )}
                />
              </div>
            )}
          </div>
        </div>

        {/* Footer Quick Action Strip (Includes Yapay Zekâya Devret in Bottom Area & Inline War Eligibility Alert) */}
        <div className="px-3.5 sm:px-5 py-2.5 bg-slate-950/95 border-t border-slate-800 flex flex-col gap-2 shrink-0">
          {!isPlayerNation && warBlockReason && (
            <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-amber-950/70 border border-amber-500/45 text-[11px] text-amber-200">
              <div className="flex items-center gap-1.5 min-w-0">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="leading-snug">{warBlockReason}</span>
              </div>
              {playerRel && playerRel.score > -30 && (
                <button
                  type="button"
                  onClick={() => onDiplomaticAction(summary.nation.id, 'INSULT')}
                  className="px-2 py-0.5 rounded-lg bg-rose-600/30 hover:bg-rose-600/50 border border-rose-400/50 text-rose-200 text-[10px] font-bold whitespace-nowrap shrink-0"
                >
                  💢 Hakaret Et (-25)
                </button>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            {isPlayerNation ? (
              <>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      sound.playClick();
                      onClose();
                      onSetActiveTab('GOVERNMENT');
                    }}
                    className="px-3 py-1.5 rounded-xl bg-sky-600/25 hover:bg-sky-600/35 border border-sky-500/40 text-sky-200 text-xs font-bold flex items-center gap-1.5"
                  >
                    <Landmark className="w-3.5 h-3.5" />
                    <span>Divan & Teknoloji</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      sound.playClick();
                      onClose();
                      onSetActiveTab('DIPLOMACY');
                    }}
                    className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/45 text-amber-200 text-xs font-bold flex items-center gap-1.5"
                  >
                    <ScrollText className="w-3.5 h-3.5" />
                    <span>Diplomasi Masası</span>
                  </button>

                  {onToggleAiCommander && (
                    <button
                      type="button"
                      onClick={() => {
                        sound.playClick();
                        onToggleAiCommander();
                      }}
                      aria-pressed={aiCommanderEnabled}
                      title="Savaş sırasında orduları akıllı YZ komutanına devret (kuşatma kurtarır, cepheyi savunur, avantajlı hedeflere saldırır)"
                      className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-colors ${
                        aiCommanderEnabled
                          ? isPlayerAtWar
                            ? 'border-emerald-400 bg-emerald-950/90 text-emerald-200'
                            : 'border-amber-400 bg-amber-950/80 text-amber-200'
                          : 'border-amber-500/45 bg-slate-900 hover:bg-slate-800 text-amber-100'
                      }`}
                    >
                      <Bot
                        className={`w-3.5 h-3.5 shrink-0 ${
                          aiCommanderEnabled
                            ? isPlayerAtWar
                              ? 'text-emerald-300'
                              : 'text-amber-300'
                            : 'text-amber-400'
                        }`}
                      />
                      {aiCommanderEnabled && (
                        <span
                          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            isPlayerAtWar
                              ? 'bg-emerald-400 animate-pulse'
                              : 'bg-amber-400'
                          }`}
                        />
                      )}
                      <span>
                        {aiCommanderEnabled
                          ? isPlayerAtWar
                            ? 'YZ Komutan: Açık (Durdur)'
                            : 'YZ Komutan: Hazır (Kapat)'
                          : 'Yapay Zekâya Devret'}
                      </span>
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={focusNationCapital}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5"
                >
                  <MapPin className="w-3.5 h-3.5 text-amber-400" />
                  <span>Başkente Odakla</span>
                </button>
              </>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onDiplomaticAction(summary.nation.id, 'IMPROVE')}
                    className="px-2.5 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/35 border border-emerald-500/45 text-emerald-200 text-[11px] font-bold"
                  >
                    +İlişki
                  </button>
                  <button
                    type="button"
                    onClick={() => onDiplomaticAction(summary.nation.id, 'INSULT')}
                    className="px-2.5 py-1.5 rounded-xl bg-orange-600/20 hover:bg-orange-600/35 border border-orange-500/45 text-orange-200 text-[11px] font-bold flex items-center gap-1"
                    title="İlişkiyi -25 düşürür (Savaş ilanı için ilişkinin -30 veya altında olması gerekir)"
                  >
                    <Flame className="w-3 h-3" />
                    <span>Hakaret Et (-25)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDiplomaticAction(summary.nation.id, 'TRADE')}
                    className="px-2.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/45 text-amber-200 text-[11px] font-bold"
                  >
                    {playerRel?.hasTradeAgreement ? 'Ticaret Aktif' : 'Ticaret'}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onDiplomaticAction(summary.nation.id, 'DEFENSIVE_PACT')
                    }
                    className="px-2.5 py-1.5 rounded-xl bg-sky-600/20 hover:bg-sky-600/35 border border-sky-500/45 text-sky-200 text-[11px] font-bold"
                  >
                    {playerRel?.allianceType === 'DEFENSIVE'
                      ? '🛡️ Paktı Feshet'
                      : '🛡️ Savunma Paktı'}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onDiplomaticAction(summary.nation.id, 'NON_AGGRESSION')
                    }
                    className="px-2.5 py-1.5 rounded-xl bg-teal-600/20 hover:bg-teal-600/35 border border-teal-500/45 text-teal-200 text-[11px] font-bold"
                  >
                    {playerRel?.hasNonAggression ? 'Saldırmazlık Aktif' : 'Saldırmazlık'}
                  </button>
                  {activePlayerWar ? (
                    <button
                      type="button"
                      onClick={() => {
                        sound.playClick();
                        if (onOpenWarModal) {
                          onClose();
                          onOpenWarModal(activePlayerWar.id);
                        } else {
                          onPeaceDeal(activePlayerWar.id, 'WHITE_PEACE');
                        }
                      }}
                      className="px-2.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-extrabold flex items-center gap-1"
                    >
                      <Swords className="w-3.5 h-3.5" />
                      <span>⚔️ Savaş & Barış Masası</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        onDiplomaticAction(summary.nation.id, 'DECLARE_WAR')
                      }
                      className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold ${
                        warBlockReason
                          ? 'bg-rose-950/80 border border-rose-500/40 text-rose-200 hover:bg-rose-900/80'
                          : 'bg-rose-600 hover:bg-rose-500 text-white'
                      }`}
                    >
                      ⚔️ Savaş İlan Et
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={focusNationCapital}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5"
                >
                  <MapPin className="w-3.5 h-3.5 text-amber-400" />
                  <span>Haritada Gör</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
