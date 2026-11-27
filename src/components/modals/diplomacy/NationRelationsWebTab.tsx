import React from 'react';
import {
  Ban,
  Coins,
  Compass,
  Crown,
  Flag,
  Handshake,
  Shield,
  Swords,
  Timer,
} from 'lucide-react';
import {
  DiplomacyPeerEntry,
  NationDiplomacySummary,
} from '../../../engine/nationDiplomacySummary';
import { NationFlagCanvasBadge } from '../../../map/nationFlagRenderer';
import { sound } from '../../../utils/soundEngine';
import { cleanNationName } from '../../../utils/formatters';

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
    <section className="rounded-xl bg-[#13110e] border border-[#342d24] p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className={`flex items-center gap-1.5 text-xs font-bold ${accentClass}`}>
          {icon}
          <span>{title}</span>
        </div>
        <span className="font-mono-num text-[11px] font-bold text-[#b2a58f]">
          {entries.length}
        </span>
      </div>

      {entries.length === 0 ? (
        <p className="text-[11px] text-[#8e806a] italic">{emptyText}</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {entries.map((entry) => {
            const name = cleanNationName(entry.nation.name);
            return (
              <button
                key={entry.nation.id}
                type="button"
                onClick={() => {
                  sound.playClick();
                  onSelectNation(entry.nation.id);
                }}
                title={`${name} ülkesini incele`}
                className="group min-h-[36px] flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#1e1a15] hover:bg-[#2a241d] border border-[#3a3228] hover:border-[#c89d54]/60 transition-colors text-left cursor-pointer"
              >
                <NationFlagCanvasBadge
                  nationId={entry.nation.id}
                  flagCode={entry.nation.flagCode}
                  color={entry.nation.color}
                  width={22}
                  height={15}
                />
                <span className="text-[11px] font-semibold text-[#f3ead7] group-hover:text-[#e0b86e] max-w-[130px] truncate">
                  {name}
                </span>
                {renderBadge ? (
                  renderBadge(entry)
                ) : (
                  <span
                    className={`font-mono-num text-[10px] font-bold ${
                      entry.relationScore >= 25
                        ? 'text-[#e0b86e]'
                        : entry.relationScore <= -25
                        ? 'text-rose-400'
                        : 'text-[#b8a990]'
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

export interface NationRelationsWebTabProps {
  summary: NationDiplomacySummary;
  onSelectInspectedNation: (nationId: string) => void;
}

export const NationRelationsWebTab: React.FC<NationRelationsWebTabProps> = ({
  summary,
  onSelectInspectedNation,
}) => {
  const diplomacyCards = [
    {
      key: 'wars',
      title: 'Aktif Savaşlar',
      icon: <Swords className="w-3.5 h-3.5 text-rose-400" />,
      entries: summary.activeWars,
      accentClass: 'text-rose-300',
      emptyText: 'Aktif savaş yok.',
      renderBadge: (entry: DiplomacyPeerEntry) => (
        <span
          className={`font-mono-num text-[10px] font-bold ${
            (entry.warScore || 0) >= 0 ? 'text-[#e0b86e]' : 'text-rose-300'
          }`}
        >
          {(entry.warScore || 0) > 0 ? `+${entry.warScore}` : entry.warScore}%
        </span>
      ),
    },
    {
      key: 'offensive',
      title: 'Saldırı Paktı & Tam İttifak',
      icon: <Swords className="w-3.5 h-3.5 text-[#e0b86e]" />,
      entries: summary.offensiveAllies,
      accentClass: 'text-[#e0b86e]',
      emptyText: 'Tam ittifak yok.',
    },
    {
      key: 'defensive',
      title: 'Savunma Paktları',
      icon: <Shield className="w-3.5 h-3.5 text-[#e0b86e]" />,
      entries: summary.defensivePacts,
      accentClass: 'text-[#e0b86e]',
      emptyText: 'Savunma paktı yok.',
    },
    {
      key: 'trade',
      title: 'Ticaret Anlaşmaları',
      icon: <Coins className="w-3.5 h-3.5 text-[#e0b86e]" />,
      entries: summary.tradePartners,
      accentClass: 'text-[#e0b86e]',
      emptyText: 'Ticaret anlaşması yok.',
    },
    {
      key: 'truce',
      title: 'Aktif Barış & Ateşkesler',
      icon: <Timer className="w-3.5 h-3.5 text-[#e0b86e]" />,
      entries: summary.activeTruces,
      accentClass: 'text-[#d8cbb5]',
      emptyText: 'Aktif ateşkes yok.',
      renderBadge: (entry: DiplomacyPeerEntry) => (
        <span className="font-mono-num text-[10px] font-bold text-[#e0b86e]">
          {entry.truceDaysRemaining}g
        </span>
      ),
    },
    {
      key: 'nap',
      title: 'Saldırmazlık Paktları',
      icon: <Handshake className="w-3.5 h-3.5 text-[#e0b86e]" />,
      entries: summary.nonAggressionPacts,
      accentClass: 'text-[#d8cbb5]',
      emptyText: 'Saldırmazlık paktı yok.',
    },
    {
      key: 'access',
      title: 'Askerî Geçiş İzinleri',
      icon: <Compass className="w-3.5 h-3.5 text-[#e0b86e]" />,
      entries: summary.militaryAccess,
      accentClass: 'text-[#d8cbb5]',
      emptyText: 'Askerî geçiş izni yok.',
    },
    {
      key: 'vassals',
      title: 'Vasal Devletler',
      icon: <Crown className="w-3.5 h-3.5 text-[#e0b86e]" />,
      entries: summary.vassals,
      accentClass: 'text-[#e0b86e]',
      emptyText: 'Bağlı vasal yok.',
    },
    {
      key: 'friendly',
      title: 'Dost Ülkeler (≥ +25)',
      icon: <Handshake className="w-3.5 h-3.5 text-[#e0b86e]" />,
      entries: summary.friendlyNations,
      accentClass: 'text-[#f3ead7]',
      emptyText: 'Dost ülke yok.',
    },
    {
      key: 'hostile',
      title: 'Hasım Ülkeler (≤ -25)',
      icon: <Ban className="w-3.5 h-3.5 text-rose-400" />,
      entries: summary.hostileNations,
      accentClass: 'text-rose-300',
      emptyText: 'Hasım ülke yok.',
    },
  ];

  const nonEmptyCards = diplomacyCards.filter((c) => c.entries.length > 0);
  const emptyCards = diplomacyCards.filter((c) => c.entries.length === 0);

  return (
    <div className="space-y-3">
      {/* Conquered & Annexed Nations Ledger */}
      <section className="rounded-xl bg-amber-950/20 border border-amber-500/35 p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
            <Flag className="w-3.5 h-3.5 text-amber-400" />
            <span>Fethedilen &amp; İlhak Edilen Ülkeler</span>
          </div>
          <span className="px-2 py-0.5 rounded-md bg-[#120f0c] border border-amber-500/30 font-mono-num text-[10px] font-bold text-amber-200">
            {summary.conqueredNations.length}
          </span>
        </div>
        {summary.conqueredNations.length === 0 ? (
          <p className="text-[11px] text-[#9b8e78] italic">
            Henüz başka bir devletten fethedilen toprak yok.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {summary.conqueredNations.map((item) => (
              <div
                key={item.nation.id}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#1a1611] border border-amber-500/30"
              >
                <NationFlagCanvasBadge
                  nationId={item.nation.id}
                  flagCode={item.nation.flagCode}
                  color={item.nation.color}
                  width={22}
                  height={15}
                />
                <span className="text-[11px] font-bold text-amber-100 max-w-[140px] truncate">
                  {cleanNationName(item.nation.name)}
                </span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold ${
                    item.isEliminated
                      ? 'bg-rose-500/25 text-rose-200 border border-rose-500/40'
                      : 'bg-amber-500/20 text-amber-200 border border-amber-500/35'
                  }`}
                >
                  {item.isEliminated
                    ? `İlhak (${item.capturedProvinceCount})`
                    : `+${item.capturedProvinceCount} Eyalet`}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Non-empty diplomatic relations first */}
      {nonEmptyCards.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {nonEmptyCards.map((card) => (
            <DiplomacySectionCard
              key={card.key}
              title={card.title}
              icon={card.icon}
              entries={card.entries}
              accentClass={card.accentClass}
              emptyText={card.emptyText}
              onSelectNation={onSelectInspectedNation}
              renderBadge={card.renderBadge}
            />
          ))}
        </div>
      )}

      {summary.embargoes.length > 0 && (
        <DiplomacySectionCard
          title="Ticaret Ambargoları"
          icon={<Ban className="w-3.5 h-3.5 text-rose-400" />}
          entries={summary.embargoes}
          accentClass="text-rose-300"
          emptyText="Aktif ambargo yok."
          onSelectNation={onSelectInspectedNation}
          renderBadge={(entry) => (
            <span className="text-[10px] font-bold text-rose-300">
              {entry.embargoDirection === 'MUTUAL'
                ? 'Karşılıklı'
                : entry.embargoDirection === 'OUTGOING'
                ? 'Uyguluyor'
                : 'Maruz'}
            </span>
          )}
        />
      )}

      {/* Empty Categories Collapsible Summary */}
      {emptyCards.length > 0 && (
        <details className="rounded-xl bg-[#13110e] border border-[#2d261e] p-2.5 text-xs">
          <summary className="cursor-pointer font-semibold text-[#9b8e78] hover:text-[#cfc3ae] select-none flex items-center justify-between">
            <span>Diğer Kategoriler ({emptyCards.length} boş)</span>
            <span className="text-[10px] opacity-75">Göster / Gizle</span>
          </summary>
          <div className="mt-2.5 grid grid-cols-1 md:grid-cols-2 gap-2">
            {emptyCards.map((card) => (
              <DiplomacySectionCard
                key={card.key}
                title={card.title}
                icon={card.icon}
                entries={card.entries}
                accentClass={card.accentClass}
                emptyText={card.emptyText}
                onSelectNation={onSelectInspectedNation}
                renderBadge={card.renderBadge}
              />
            ))}
          </div>
        </details>
      )}
    </div>
  );
};
