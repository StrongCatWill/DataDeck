"use client";

import type { Pack } from "@/lib/deck";
import { CardTile } from "./CardTile";

export interface Reveal {
  week: number;
  /** Cards of this pack shown so far. */
  shown: number;
}

// One sealed pack per week. Opening it reveals the week's cards one at a time, rarest last;
// each revealed card joins the deck straight away.
export function PackOpening({
  packs,
  opened,
  reveal,
  onOpen,
  onRevealNext,
  onFinish,
  onReseal,
}: {
  packs: Pack[];
  opened: Set<number>;
  reveal: Reveal | null;
  onOpen: (week: number) => void;
  onRevealNext: () => void;
  onFinish: () => void;
  onReseal: () => void;
}) {
  const sealed = packs.filter((p) => !opened.has(p.week) && p.week !== reveal?.week);
  const current = reveal && packs.find((p) => p.week === reveal.week);

  return (
    <section>
      <h2>Weekly packs</h2>
      {current && (
        <div className="card reveal">
          <strong>Week {current.week} pack</strong>
          <div className="grid">
            {current.cards.slice(0, reveal.shown).map((c) => (
              <div className="reveal-in" key={c.id}>
                <CardTile name={c.name} rarity={c.rarity} card={c} />
                <p className="muted">
                  <b>Why this card?</b> {c.whyThisCard}
                </p>
              </div>
            ))}
          </div>
          <p>
            {reveal.shown < current.cards.length ? (
              <button onClick={onRevealNext}>
                Reveal card {reveal.shown + 1} of {current.cards.length}
              </button>
            ) : (
              <button onClick={onFinish}>Done: all {current.cards.length} cards are in your deck</button>
            )}
          </p>
        </div>
      )}

      {sealed.length > 0 ? (
        <div className="packs">
          {sealed.map((p) => (
            <div className="pack" key={p.week}>
              <span className="pack-brand">DATA DECK</span>
              <strong className="pack-week">Week {p.week}</strong>
              <span className="pack-count">{p.cards.length} cards inside</span>
              <button className="pack-open" disabled={reveal !== null} onClick={() => onOpen(p.week)}>
                Open pack
              </button>
            </div>
          ))}
        </div>
      ) : (
        !current && (
          <p className="muted">
            All packs opened.{" "}
            <button type="button" className="linkish" onClick={onReseal}>
              Reseal packs (demo)
            </button>
          </p>
        )
      )}
    </section>
  );
}
