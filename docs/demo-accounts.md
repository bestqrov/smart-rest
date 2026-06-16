# Demo Accounts

The login page (`app/login/page.tsx`) and seed script (`prisma/seed.ts`) ship with a single demo tenant: Morocco only.

| Field | Value |
|---|---|
| Country | 🇲🇦 Morocco |
| Cafe | Café de la Plage |
| City | Agadir |
| Subdomain | `plage` |
| Email | `plage@demo.com` |
| Password | `demo1234` |

Previously the demo set included 9 countries (Saudi Arabia, UAE, Algeria, Tunisia, Libya, Egypt, Senegal, Côte d'Ivoire, in addition to Morocco). These were removed from both `DEMO_ACCOUNTS` in the login page and the `main()` seeding flow in `prisma/seed.ts`, to keep the public demo focused on a single, well-maintained tenant.

Per-country category/product data (`SA_CATS`, `AE_CATS`, `DZ_CATS`, `TN_CATS`, `LY_CATS`, `EG_CATS`, `SN_CATS`, `CI_CATS`, etc.) still exists in `prisma/seed.ts` but is no longer seeded — kept in case a country is reintroduced later.
