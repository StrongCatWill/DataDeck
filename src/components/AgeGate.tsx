"use client";

import { useEffect, useState } from "react";

// 18+ confirmation on first launch (NFR-5, Art. 8).
export function AgeGate({ children }: { children: React.ReactNode }) {
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => {
    try {
      setOk(localStorage.getItem("dd:18plus") === "yes");
    } catch {
      setOk(false);
    }
  }, []);

  if (ok === null) return null;
  if (ok) return <>{children}</>;
  return (
    <div className="gate">
      <h1>Data Deck</h1>
      <p>Data Deck is for adults. This demo runs on Solana devnet with sample data only.</p>
      <button
        onClick={() => {
          try {
            localStorage.setItem("dd:18plus", "yes");
          } catch {}
          setOk(true);
        }}
      >
        I am 18 or older
      </button>
    </div>
  );
}
