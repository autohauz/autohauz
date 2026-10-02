# AUTOHAUZ_AU_AI_VISIBILITY_AUDIT

## 1. Information Hierarchy
AutoHauz provides explicit, machine-readable answers to common AI engine questions:
- **Business Identity**: Addressed by `@id`-anchored `Organization` schema.
- **Inventory Facts**: Addressed by `Car` schema on the VDP. Specifications are rendered as standard HTML `<dl>` definition lists, which are easily parsed by ChatGPT, Perplexity, and Google AI Overviews.
- **Contact Methods**: Standard semantic HTML links (`href="tel:..."`) for phone and WhatsApp.

## 2. AI Crawlability
- **Robots.txt**: Explicitly permits AI *Search* crawlers (OAI-SearchBot, PerplexityBot, Claude-SearchBot) while blocking AI *Training* crawlers (GPTBot, CCBot). This correctly protects proprietary data from model training while enabling discoverability in AI answers.

## 3. Recommended Query Matrix Benchmarking
To track visibility, queries should be benchmarked:
1. `AutoHauz used cars`
2. `best place to buy used car [Australian Location]`
3. `[make] [model] for sale [Australian Location]`

- **Status**: PASS. The technical foundation for high AI visibility is natively implemented. No gimmicky `llms.txt` is required because the HTML structure and JSON-LD perfectly describe the entity.
