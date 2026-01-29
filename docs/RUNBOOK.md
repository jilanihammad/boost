# Boost — Runbook (Pilot Ops)

## Onboard a merchant (v0)
1) Collect:
- business name, address, hours
- primary contact
- what offer they’ll run (and constraints)

2) Create merchant + location in admin flow

3) Create first offer
- set daily cap
- set eligible hours
- choose bounty ($/redemption)

4) Train staff (5 minutes)
- customer shows QR
- staff scans QR in merchant web
- if scan fails, use manual code

## Daily checks
- redemptions by merchant
- anomalies (repeated codes, high velocity)
- offer caps/hours correct

## Weekly report to merchant
- redemptions per day
- estimated incremental traffic (qualitative v0)
- recommendation: tweak offer type, cap, hours

## Billing (v0)
- Manual invoice: redemptions × bounty
- Payment via Zelle/ACH/Venmo (whatever you choose) until Stripe is added

## Fraud handling (v0)
- If suspicious activity:
  - pause offer
  - invalidate active claims
  - require staff-only manual redemption temporarily
