"use client";

import { useState } from "react";
import { ORG_LABEL, bountiesForCard, priceLabel, type CollectionSlot } from "@/lib/deck";
import type { Bounty, Card, GrantView } from "@/lib/types";
import { CardTile } from "./CardTile";

// Card detail sheet: one exact copy (week/level), "Why this card?", and the research requests that want it.
export function CardDetail({
  slot,
  bounties,
  activeGrants,
  onLend,
  onClose,
}: {
  slot: CollectionSlot;
  bounties: Bounty[];
  activeGrants: GrantView[];
  onLend: (bounty: Bounty, card: Card) => void;
  onClose: () => void;
}) {
  const [cardId, setCardId] = useState(slot.copies.at(-1)!.id);
  const card = slot.copies.find((c) => c.id === cardId) ?? slot.copies.at(-1)!;
  const requests = bountiesForCard(card, bounties);
  const lendingTo = (b: Bounty) => activeGrants.some((g) => g.cardId === card.id && g.bountyId === b.id);

  return (
    <div className="sheet" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-label={`${card.name} card`}>
        <div className="detail-head">
          <CardTile name={card.name} rarity={card.rarity} card={card} lending={activeGrants.some((g) => g.cardId === card.id)} />
          <div>
            <h3>{card.name}</h3>
            <p>
              <span className="badge">{card.rarity}</span> Week {card.week} · Level {card.level}
            </p>
            {slot.copies.length > 1 && (
              <p className="copies">
                {slot.copies.map((c) => (
                  <button key={c.id} className={c.id === card.id ? "" : "secondary"} onClick={() => setCardId(c.id)}>
                    Week {c.week}
                  </button>
                ))}
              </p>
            )}
          </div>
        </div>

        <details open>
          <summary>Why this card?</summary>
          <p>{card.whyThisCard}</p>
          <p className="muted">Levels are cosmetic: they never change what a research request pays.</p>
        </details>

        <h4>Research requests for this card</h4>
        {requests.length === 0 ? (
          <p className="muted">
            No research request wants {card.name} right now. The card stays in your deck and nothing is shared unless
            you choose to lend it.
          </p>
        ) : (
          requests.map((b) => (
            <div className="card request" key={b.id}>
              <strong>{b.researcher}</strong>
              <div className="muted">
                {ORG_LABEL[b.orgType]} · ethics ref: {b.ethicsRef ?? "none"}
              </div>
              <div className="muted">
                Access: {b.accessWindowLabel} · Retention: {b.retention} · Pays {priceLabel(b)}
              </div>
              <p>
                {lendingTo(b) ? (
                  <span className="badge lending">Lending this card</span>
                ) : (
                  <button onClick={() => onLend(b, card)}>Review and lend</button>
                )}
              </p>
            </div>
          ))
        )}

        <p>
          <button className="secondary" onClick={onClose}>
            Close
          </button>
        </p>
      </div>
    </div>
  );
}
