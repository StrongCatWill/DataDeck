"use client";

import type { Card, CardName, Rarity } from "@/lib/types";

// One card face. Without a card the slot is locked: the type is shown so players know what to aim for.
export function CardTile({
  name,
  rarity,
  card,
  copies = 1,
  lending = false,
  onClick,
}: {
  name: CardName;
  rarity: Rarity;
  card?: Card;
  copies?: number;
  lending?: boolean;
  onClick?: () => void;
}) {
  const rarityClass = `rarity-${rarity.toLowerCase()}`;
  if (!card) {
    return (
      <div className={`tile locked-slot ${rarityClass}`} aria-label={`${name}, not earned yet`}>
        <span className="tile-rarity">{rarity}</span>
        <strong className="tile-name">{name}</strong>
        <span className="muted">🔒 Not earned yet</span>
      </div>
    );
  }

  const body = (
    <>
      <span className="tile-rarity">{rarity}</span>
      <strong className="tile-name">{name}</strong>
      <span className="muted">
        Week {card.week} · Level {card.level}
        {copies > 1 && ` · ×${copies}`}
      </span>
      {lending && <span className="badge lending">lending</span>}
    </>
  );
  return onClick ? (
    <button type="button" className={`tile earned ${rarityClass}`} onClick={onClick}>
      {body}
    </button>
  ) : (
    <div className={`tile earned ${rarityClass}`}>{body}</div>
  );
}
