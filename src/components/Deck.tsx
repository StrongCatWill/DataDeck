"use client";

import { setCompletion, type CollectionSlot } from "@/lib/deck";
import { CardTile } from "./CardTile";

// The collection: every card type, earned or locked, with set completion.
export function Deck({
  slots,
  lendingCardIds,
  onSelect,
}: {
  slots: CollectionSlot[];
  lendingCardIds: Set<string>;
  onSelect: (slot: CollectionSlot) => void;
}) {
  const { earned, total } = setCompletion(slots);
  return (
    <section>
      <h2>
        Your deck <span className="badge">{earned} / {total} collected</span>
      </h2>
      <progress className="completion" value={earned} max={total} aria-label="Set completion" />
      <div className="grid">
        {slots.map((s) => {
          const latest = s.copies.at(-1);
          return (
            <CardTile
              key={s.name}
              name={s.name}
              rarity={s.rarity}
              card={latest}
              copies={s.copies.length}
              lending={s.copies.some((c) => lendingCardIds.has(c.id))}
              onClick={latest ? () => onSelect(s) : undefined}
            />
          );
        })}
      </div>
    </section>
  );
}
