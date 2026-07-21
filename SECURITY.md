# Security Policy

## Project status

NestEase is a portfolio MVP and has not undergone a third-party security audit. Do not use it with production personal data, property data, payment data, or live contractor conversations without completing an independent security and privacy review.

## Reporting a vulnerability

Please report suspected vulnerabilities privately to the repository owner through the contact method listed on [Jacky Zhong's GitHub profile](https://github.com/Jacky040124). Do not open a public issue containing exploit details, credentials, personal information, or live customer data.

Include the affected component, reproduction steps, impact, and any suggested mitigation. No formal response-time or bounty commitment is currently offered.

## Current trust boundaries

- Property-manager sessions are authenticated through Supabase Auth.
- Contractor sessions and external owner/tenant actions use signed tokens.
- The backend uses Supabase service-role access for server operations; route-level authorization must therefore be treated as a production-critical control.
- SMS, MMS, email, AI, hosting, and database vendors may process sensitive data. Their retention and privacy settings require deployment-specific review.
