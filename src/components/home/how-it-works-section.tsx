
const STEPS = [
  { step: "1", title: "Discover", body: "Search by make, model, body type or budget." },
  { step: "2", title: "Inspect", body: "See it in person and take a closer look." },
  { step: "3", title: "Finance or Buy", body: "Explore finance options or pay outright." },
  { step: "4", title: "Drive Away", body: "Complete the paperwork and hit the road." },
];

export function HowItWorksSection() {
  return (
    <section className="py-12 bg-card border-y border-border/50" aria-labelledby="steps-heading">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 id="steps-heading" className="text-2xl sm:text-3xl font-bold font-heading text-foreground mb-8">
          How it works
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 relative">
          {STEPS.map((s) => (
            <div
              key={s.title}
              className="flex flex-col gap-3 relative"
            >
              <div className="flex items-center gap-3">
                <div
                  className="flex size-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground shadow-sm shrink-0"
                >
                  {s.step}
                </div>
                <h3 className="text-lg font-bold font-heading text-foreground">{s.title}</h3>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed pl-13 sm:pl-0">
                {s.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
