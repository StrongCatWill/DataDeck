import { ResearcherPortal } from "@/components/ResearcherPortal";

export default async function ResearcherPage({ searchParams }: { searchParams: Promise<{ grant?: string }> }) {
  const { grant } = await searchParams;
  return <ResearcherPortal initialGrantId={grant ?? ""} />;
}
