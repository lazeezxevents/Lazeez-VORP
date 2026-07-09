# 4. Data & Database Documentation

## Database Schema (overview)

- Primary stores: relational database (Postgres) — tables: users, bookings, slots, payments, audit_logs.
- Caching: Redis for session/counters.

## ER Diagram

- See `diagrams/er_diagram.mmd` for a mermaid ER starter.

## Data Dictionary (example)

- `bookings`:
  - `id` (uuid): PK
  - `user_id` (uuid): FK -> users.id
  - `slot_id` (uuid): FK -> slots.id
  - `status` (varchar): enum(created, confirmed, cancelled)
  - `created_at` (timestamp)

## Relationships

- One `user` to many `bookings`.

## Indexes & Performance

- Indexes: bookings(user_id), bookings(slot_id), bookings(created_at) — tune for read patterns.

## Data Lifecycle & Retention

- Raw retention: 90 days in primary DB, archival to object storage for 7 years (configurable).
- Deletion: soft-delete + GDPR purge endpoint that removes PII within configured SLA.

## Backups & Recovery

- Daily DB snapshots, WAL archiving for point-in-time recovery.
