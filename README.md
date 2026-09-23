# AutoHauz — Quality Used Cars in Australia

AutoHauz is a modern, fast, and secure dealership platform tailored for a single Australian used-car dealership. It provides a robust public-facing vehicle listing site and a secure internal staff dashboard for inventory, leads, and invoicing management.

## Tech Stack
- **Frontend Framework**: Next.js 16 (App Router, Server Actions)
- **Styling**: Tailwind CSS v4 (Semantic Tokens System)
- **Database & Auth**: Supabase (PostgreSQL, Row Level Security, MFA)
- **Security**: Cloudflare Turnstile
- **Emails**: AWS SES (via Nodemailer)

## Project Structure
```text
src/
├── app/                  # Next.js App Router (pages & API routes)
│   ├── (public)/         # SEO-friendly marketing and vehicle discovery pages
│   ├── admin/            # Staff-only secure dashboard
│   ├── api/              # Route handlers and crons
├── components/           # Reusable UI elements (shadcn + semantic components)
└── lib/                  # Core utilities (auth, database, invoicing, SEO)
supabase/                 # Database migrations and edge functions
docs/                     # Comprehensive developer & architectural documentation
```

## Local Development Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure Environment Variables:**
   Copy the example environment template and populate it with your local Supabase keys.
   ```bash
   cp .env.example .env.local
   ```
   Set `ADMIN_EMAIL` in `.env.local` to bootstrap the admin user.

3. **Start Local Supabase:**
   ```bash
   supabase start
   supabase db push
   ```

4. **Start the Development Server (Port 3100):**
   ```bash
   npm run dev -- -p 3100
   ```
   The application will be available at `http://localhost:3100`.

## Scripts
- `npm run dev` - Starts the Next.js development server
- `npm run build` - Creates an optimized production build
- `npm run start` - Runs the production build
- `npm run lint` - Runs ESLint to check for code quality issues
- `npm run test` - Runs Vitest test suites

## Documentation
For deep technical guides, please refer to the `/docs` directory:
- [Architecture & System Design](docs/ARCHITECTURE.md)
- [Database Schema & Migrations](docs/DATABASE.md)
- [API Reference](docs/API.md)
- [Deployment & Operations](docs/DEPLOYMENT.md)
