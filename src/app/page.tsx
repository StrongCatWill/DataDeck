import { AgeGate } from "@/components/AgeGate";
import { Dashboard } from "@/components/Dashboard";
import { BOUNTIES } from "@/lib/bounties";
import { generateCards } from "@/lib/cards";
import { loadSampleRows } from "@/lib/csv";

export default function Home() {
  const cards = generateCards(loadSampleRows());
  return (
    <AgeGate>
      <Dashboard cards={cards} bounties={BOUNTIES} />
    </AgeGate>
  );
}
