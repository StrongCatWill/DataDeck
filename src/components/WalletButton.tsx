"use client";

import dynamic from "next/dynamic";

// The adapter's button reads window; render it client-only.
export const WalletButton = dynamic(
  async () => (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false },
);
