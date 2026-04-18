# Trust SaaS Commerce Platform

Trust is a React + Vite storefront SaaS application backed by Supabase.

This branch includes a full multi-tenant subscription system with:

- 24-hour free trial onboarding
- 250 EGP monthly plan
- 1000 EGP monthly plan
- tenant-aware RBAC and Supabase RLS
- sandbox subscription checkout and payment confirmation
- subscription lifecycle management
- plan-based feature gating
- admin subscription management

## Quick Start

1. Copy `.env.example` to `.env`
2. Set:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Apply the Supabase migrations
4. Install dependencies
5. Start the dev server

```bash
npm install
npm run dev
```

## Verification Commands

```bash
npm run typecheck
npm run build
npm run test:run
```

## Documentation

- Subscription architecture and API documentation: `docs/subscriptions.md`
- Main Supabase subscription migration: `supabase/migrations/20260418120000_add_multi_tenant_subscription_system.sql`
