import { getMakes, getAllModels } from "@/lib/data/inventory";
import { AddMakeForm, MakeRow } from "./catalogue-client";
import { requirePermission } from "@/lib/security/auth";

export const metadata = { title: "Brands & Models" };
export const dynamic = "force-dynamic";

export default async function CataloguePage() {
  await requirePermission("catalogue.write");
  const [makes, models] = await Promise.all([getMakes(), getAllModels()]);
  const popular = makes.filter((m) => m.isPopular);
  const rest = makes.filter((m) => !m.isPopular);

  return (
    <div className="space-y-8 max-w-4xl">
      <header>
        <h1 className="font-heading text-2xl font-bold text-foreground">Brands &amp; Models</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage the makes and models available when listing vehicles. Click a make to expand and add or remove models.
        </p>
      </header>

      {/* Add new make */}
      <section className="rounded-xl border border-border bg-card p-5 space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Add a new make / brand</h2>
        <AddMakeForm />
      </section>

      {/* Popular makes */}
      {popular.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Popular brands</h2>
          {popular.map((make) => (
            <MakeRow key={make.id} make={make} models={models} />
          ))}
        </section>
      )}

      {/* Other makes */}
      {rest.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">All other brands</h2>
          {rest.map((make) => (
            <MakeRow key={make.id} make={make} models={models} />
          ))}
        </section>
      )}

      {makes.length === 0 && (
        <p className="text-sm text-muted-foreground">No makes yet — add one above to get started.</p>
      )}
    </div>
  );
}
