# SmartSuite OS — Post-V1.0 Backlog

Everything here is explicitly postponed until after Version 1.0 ships. Nothing in this list is allowed into the V1 development cycle.

---

## New SaaS Modules

| Item | Description |
|------|-------------|
| **Hotel Module** | Full PMS for hotels: rooms, reservations, housekeeping, billing |
| **Clinic Module** | Appointment scheduling, patient records, billing |
| **Retail Module** | POS for retail: inventory, barcode, receipts |
| **Broker Module** | B2B sourcing, RFQ, bid management |

---

## Platform Extensions

| Item | Description |
|------|-------------|
| **IAM** | Fine-grained identity and access management, roles and permission sets |
| **Integration Layer** | Webhooks, event subscriptions, third-party app integrations |
| **Plugin SDK** | Public SDK for building plugins on top of SmartSuite OS |
| **Public APIs** | Documented REST API for external developers |
| **SSO** | Single Sign-On for enterprise tenants |
| **OAuth** | OAuth 2.0 provider implementation |
| **OpenID Connect** | OpenID Connect provider for enterprise identity federation |

---

## AI & Automation

| Item | Description |
|------|-------------|
| **Marketplace AI Assistant** | AI-powered product recommendations and procurement suggestions |
| **Advanced BI** | Custom reports, pivot tables, data export, scheduled reporting |
| **AI Center V2** | Usage analytics, cost optimization, prompt management per tenant |

---

## Infrastructure

| Item | Description |
|------|-------------|
| **Multi-tenancy V2** | Namespace isolation, per-tenant database sharding |
| **CDN & Asset Optimization** | Global CDN for menu images, product photos |
| **Audit Log UI** | Admin UI for reading AuditService logs |
| **Notification Center UI** | Restaurant admin notification inbox and read/unread state |

---

## Deferred V1 Work

These were considered for V1 but explicitly deferred:

| Item | Reason Deferred |
|------|----------------|
| PDF invoice download | Requires PDF generation library integration |
| Subscription payment reminder emails | Requires email template engine |
| Marketplace supplier mobile app | Scope too large for V1 |
| Multi-currency invoicing | Single-currency sufficient for V1 markets |
| Offline POS mode | Service worker complexity |
| Kitchen Display System V2 (touchscreen) | Hardware dependency |

---

## Rules

- Nothing from this backlog enters a sprint without an explicit Blueprint document approved by the CTO.
- Items may be promoted from backlog to roadmap only after V1.0 ships.
- Adding new items to this list is encouraged — it is not a commitment to build them.
