import { SiteEntityGraph } from "@/components/site-entity-graph";

// Site-wide organization/website/dealer JSON-LD for every public page
// (SRS §16.4). The graph itself lives in <SiteEntityGraph /> because the
// homepage sits outside this route group and needs the same nodes.
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteEntityGraph />
      <div className="min-h-screen bg-background text-foreground">
        {children}
      </div>
    </>
  );
}
