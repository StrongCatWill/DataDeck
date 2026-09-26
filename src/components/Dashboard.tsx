"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ORG_LABEL, collectionSlots, packsByWeek, priceLabel, type CollectionSlot } from "@/lib/deck";
import { lendCard, stopSharing as stopSharingTx } from "@/lib/solana/clientGrants";
import type { Bounty, Card, GrantView } from "@/lib/types";
import { CardDetail } from "./CardDetail";
import { ConsentSheet } from "./ConsentSheet";
import { Deck } from "./Deck";
import { PackOpening, type Reveal } from "./PackOpening";
import { WalletButton } from "./WalletButton";

const OPENED_KEY = "dd:packs-opened";

function loadOpened(): Set<number> {
  try {
    const weeks = JSON.parse(localStorage.getItem(OPENED_KEY) ?? "[]");
    return new Set(Array.isArray(weeks) ? weeks.filter((w) => typeof w === "number") : []);
  } catch {
    return new Set();
  }
}

function saveOpened(opened: Set<number>) {
  try {
    localStorage.setItem(OPENED_KEY, JSON.stringify([...opened]));
  } catch {}
}

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function Dashboard({ cards, bounties }: { cards: Card[]; bounties: Bounty[] }) {
  const wallet = useWallet();
  const { connection } = useConnection();
  const player = wallet.publicKey?.toBase58() ?? "demo-player";
  const [grants, setGrants] = useState<GrantView[]>([]);
  const [consentFor, setConsentFor] = useState<{ bounty: Bounty; cardId: string } | null>(null);
  const [detailFor, setDetailFor] = useState<CollectionSlot | null>(null);
  const [killResult, setKillResult] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const busy = useRef(false);

  // Packs: opened weeks persist per browser; a reveal in progress does not.
  const packs = useMemo(() => packsByWeek(cards), [cards]);
  const [opened, setOpened] = useState<Set<number>>(new Set());
  const [reveal, setReveal] = useState<Reveal | null>(null);
  useEffect(() => setOpened(loadOpened()), []);

  const revealed = useMemo(
    () =>
      packs.flatMap((p) =>
        opened.has(p.week) ? p.cards : reveal?.week === p.week ? p.cards.slice(0, reveal.shown) : [],
      ),
    [packs, opened, reveal],
  );
  const slots = useMemo(() => collectionSlots(revealed), [revealed]);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/grants?player=${player}`);
    if (res.ok) setGrants(await res.json());
  }, [player]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const active = grants.filter((g) => g.status === "Active" && g.expiresAt * 1000 > Date.now());
  const lendingCardIds = new Set(active.map((g) => g.cardId));
  const cardFor = (b: Bounty) => revealed.find((c) => c.name === b.cardWanted);

  function finishPack() {
    if (!reveal) return;
    const next = new Set(opened).add(reveal.week);
    setOpened(next);
    saveOpened(next);
    setReveal(null);
  }

  function resealPacks() {
    setOpened(new Set());
    saveOpened(new Set());
  }

  async function confirmLend() {
    if (!consentFor || busy.current) return;
    busy.current = true;
    const { bounty, cardId } = consentFor;
    try {
      const { tx } = await lendCard(bounty, cardId, { wallet, connection });
      setNotice(`You are now lending ${bounty.cardWanted} to ${bounty.researcher}.${tx ? ` Tx ${tx}` : ""}`);
    } catch (e) {
      setNotice(`Could not lend: ${errorText(e)}`);
    } finally {
      busy.current = false;
      setConsentFor(null);
      refresh();
    }
  }

  async function stopSharing() {
    if (busy.current) return;
    busy.current = true;
    try {
      const { tx, response } = await stopSharingTx(
        active.map((g) => g.grantId),
        { wallet, connection },
      );
      const r = response as { revoked?: string[]; keysDestroyed?: number };
      setKillResult(
        `Stopped ${r.revoked?.length ?? 0} grant(s) in tx ${tx}. ${r.keysDestroyed ?? 0} undelivered batch keys destroyed. ` +
          `An erasure request was logged to each researcher.`,
      );
    } catch (e) {
      setKillResult(`Could not stop sharing: ${errorText(e)}`);
    } finally {
      busy.current = false;
      refresh();
    }
  }

  return (
    <main>
      <header>
        <h1>Data Deck</h1>
        <WalletButton />
      </header>
      <p className="muted">Devnet demo with sample data. Lend data by the day and keep the off switch.</p>
      {notice && (
        <p className="card notice" role="status">
          {notice}{" "}
          <button type="button" className="linkish" onClick={() => setNotice(null)}>
            Dismiss
          </button>
        </p>
      )}

      <PackOpening
        packs={packs}
        opened={opened}
        reveal={reveal}
        onOpen={(week) => setReveal({ week, shown: 1 })}
        onRevealNext={() => setReveal((r) => r && { ...r, shown: r.shown + 1 })}
        onFinish={finishPack}
        onReseal={resealPacks}
      />

      <Deck slots={slots} lendingCardIds={lendingCardIds} onSelect={setDetailFor} />

      <h2>Bounty board</h2>
      <div className="grid">
        {bounties.map((b) => (
          <div className="card" key={b.id}>
            <strong>{b.researcher}</strong>
            <div className="muted">
              {ORG_LABEL[b.orgType]} · ethics ref: {b.ethicsRef ?? "none"}
            </div>
            <table>
              <tbody>
                <tr><th>Wants</th><td>{b.cardWanted}{b.weeksWanted > 1 ? `, ${b.weeksWanted} weeks` : ""}</td></tr>
                <tr><th>Access</th><td>{b.accessWindowLabel}</td></tr>
                <tr><th>Retention</th><td>{b.retention}</td></tr>
                <tr><th>Pays</th><td>{priceLabel(b)}</td></tr>
              </tbody>
            </table>
            <p>
              <button disabled={!cardFor(b)} onClick={() => setConsentFor({ bounty: b, cardId: cardFor(b)!.id })}>
                {cardFor(b) ? "Review and lend" : "Card not in deck"}
              </button>
            </p>
          </div>
        ))}
      </div>

      <h2>Active grants</h2>
      {active.length === 0 ? (
        <p className="muted">Nothing is being shared.</p>
      ) : (
        <ul>
          {active.map((g) => (
            <li key={g.grantId}>
              <code>{g.grantId.slice(0, 8)}…</code> {g.accessType} · ends{" "}
              {new Date(g.expiresAt * 1000).toLocaleTimeString()} {g.auto && <span className="badge">auto-accepted</span>}{" "}
              <a href={`/researcher?grant=${g.grantId}`} target="_blank">researcher view</a>
            </li>
          ))}
        </ul>
      )}

      <h2>Stop sharing</h2>
      <div className="card">
        <p>
          Stops every future batch key and payment for your grants and turns off auto-accept. Undelivered keys are
          destroyed, so stored copies stay unreadable. Batches a researcher already opened cannot be recalled; we send
          them an erasure request with the revoke transaction as proof of time.
        </p>
        <button className="danger" onClick={stopSharing}>Stop sharing</button>
        {killResult && <p className="muted">{killResult}</p>}
      </div>

      <h2>Privacy panel</h2>
      {/* TODO(role B): side-by-side "what the public chain sees" vs "what the app sees" (FR-11). */}
      <p className="muted">
        The public chain sees grant IDs, salted hashes, timestamps, prices and statuses. Card names, health values and
        study topics stay in the app.
      </p>

      {detailFor && (
        <CardDetail
          slot={detailFor}
          bounties={bounties}
          activeGrants={active}
          onClose={() => setDetailFor(null)}
          onLend={(bounty, card) => {
            setDetailFor(null);
            setConsentFor({ bounty, cardId: card.id });
          }}
        />
      )}

      {consentFor && (
        <ConsentSheet bounty={consentFor.bounty} onCancel={() => setConsentFor(null)} onConfirm={confirmLend} />
      )}
    </main>
  );
}
