import React from 'react';
import { Check, Handshake, X } from 'lucide-react';
import { IncomingDiplomaticOffer, Nation, Territory } from '../../types/game';
import {
  AI_PERSONALITY_META,
  resolveNationAiPersonality,
} from '../../engine/seasonSupplyAndAiProfile';
import { NationFlagCanvasBadge } from '../../map/nationFlagRenderer';
import { cleanNationName } from '../../utils/formatters';

interface DiplomaticOfferBannerProps {
  offer: IncomingDiplomaticOffer | null;
  nations: Record<string, Nation>;
  territories: Record<string, Territory>;
  tick: number;
  hidden?: boolean;
  onRespond: (accept: boolean) => void;
}

const OFFER_KIND_LABEL: Record<IncomingDiplomaticOffer['kind'], string> = {
  TRADE: 'Ticaret Anlaşması Teklifi',
  NON_AGGRESSION: 'Saldırmazlık Paktı Teklifi',
  DEFENSIVE_PACT: 'Savunma Paktı Teklifi',
  MILITARY_ACCESS: 'Askerî Geçiş Talebi',
  TRIBUTE_GIFT: 'Diplomatik İyi Niyet Hediyesi',
};

export const DiplomaticOfferBanner: React.FC<DiplomaticOfferBannerProps> = ({
  offer,
  nations,
  territories,
  tick,
  hidden = false,
  onRespond,
}) => {
  if (hidden || !offer) return null;
  const sender = nations[offer.fromNationId];
  if (!sender || sender.isEliminated) return null;

  const personality = resolveNationAiPersonality(sender, territories);
  const personalityMeta = AI_PERSONALITY_META[personality];
  const remainingDays = Math.max(1, offer.expiresTick - tick);
  const senderName = cleanNationName(sender.name);

  return (
    <aside
      role="region"
      aria-label="Gelen diplomatik teklif"
      data-testid="diplomatic-offer-banner"
      className="fixed top-[5.4rem] sm:top-16 right-2.5 sm:right-4 z-[45] w-[calc(100vw-20px)] max-w-[340px] rounded-2xl bg-[#0a1120]/96 border border-amber-500/55 shadow-2xl p-3 space-y-2.5 text-slate-100 pointer-events-auto"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <NationFlagCanvasBadge
            nationId={sender.id}
            flagCode={sender.flagCode}
            color={sender.color}
            width={36}
            height={24}
          />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-200 truncate">
              <Handshake className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="truncate">{senderName}</span>
              <span className="text-[10px] font-medium text-slate-400 shrink-0">
                · {personalityMeta.shortLabel}
              </span>
            </div>
            <div className="text-[11px] font-semibold text-white truncate">
              {OFFER_KIND_LABEL[offer.kind]}
            </div>
          </div>
        </div>
        <span className="font-mono-num text-[10px] font-semibold text-amber-300/90 shrink-0">
          {remainingDays}g
        </span>
      </div>

      <p className="text-[11px] leading-snug text-slate-300">
        {offer.message}
        {offer.kind === 'TRIBUTE_GIFT' && offer.goldGift ? (
          <strong className="text-amber-300 font-mono-num">
            {' '}
            (+{offer.goldGift.toLocaleString('tr-TR')} Altın)
          </strong>
        ) : null}
      </p>

      <div className="grid grid-cols-2 gap-2 pt-0.5">
        <button
          type="button"
          data-testid="diplomatic-offer-accept"
          onClick={() => onRespond(true)}
          className="min-h-[40px] px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
        >
          <Check className="w-3.5 h-3.5 shrink-0" />
          <span>Kabul Et</span>
        </button>
        <button
          type="button"
          data-testid="diplomatic-offer-decline"
          onClick={() => onRespond(false)}
          className="min-h-[40px] px-3 rounded-xl bg-slate-800 hover:bg-rose-950/80 border border-slate-700 hover:border-rose-500/50 text-slate-200 hover:text-rose-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
        >
          <X className="w-3.5 h-3.5 shrink-0" />
          <span>Reddet</span>
        </button>
      </div>
    </aside>
  );
};
