# KASA School finance quotation controls and authorization reconciliation

## Production safety decision (27 October 2026)

No tuition, boarding, food, practical or administrative fee should be fabricated from a programme title or UI hint. `submissions/{id}.feeQuote` is an immutable per-application approved quote snapshot. Without that snapshot, the ledger identifies the student application as requiring reconciliation and does not report a fictitious outstanding balance. The reporting summary is explicitly incomplete until quotes and anomalous payments have been reconciled. Recorded receipts are retained.

## Owner-approved tariff entry

A verified, active **School super administrator** uses **Finance → Approved tariff registry** to record a written/externally approved version with:
- programme ID and package ID, version, effective date and approval-document reference
- exact ZMW tuition, practical, administration, accommodation and food amounts
- an explicit approval confirmation; no prepopulated rates
- immutable `feeTariffs/{programmeId}--{packageId}--{version}` document plus transactionally recorded audit entry

Existing tariff versions cannot be edited or deleted through the application. Updates require a separately approved new version. A tariff approval record is an administrative attestation, not substitute evidence for the institution's actual fee decision. Validate the provided external source before using the feature.

## Application-by-application reconciliation

Verified School finance users with `finance.record` select an effective, approved tariff in the Finance ledger and manually confirm the applicant's actual programme/package. They must provide independent document evidence. If a letter or funding decision was already issued, its original agreement reference must also be documented. The operation:
1. Checks both application and approved tariff within a Firestore transaction.
2. Rejects rejected/non-student applications, existing or corrupt fee snapshots, future-effective tariffs, and payment history exceeding the proposed total.
3. Writes one immutable copy of the tariff to `submissions/{id}.feeQuote` with source/evidence/actor/timestamps; it does not modify existing payments or application status.
4. Writes a security audit record in the same transaction. Repeating the operation conflicts instead of overwriting a historical contract.

**No automatic historical backfill.** The operator must match real supporting documents for each legacy record. If the existing letter amount differs, do not force a tariff: escalate for a documented correction process that does not replace the original signed agreement.

## Receipts and reporting

New self-funded receipts require an approved snapshot, an issued acceptance letter, verified positive payment amount, and a globally unique receipt reference. Payments exceeding the approved total are rejected. CDF-funded receipts are managed separately through the existing official verification state machine. Receipt recording does **not** itself verify enrolment or authorize commissions.

Financial reporting paginates application records and indicates when the scan limit is reached. All totals are explicitly partial when any quote is missing or payment data is invalid. Only actual recorded receipts are shown as paid.

## Authorization

The existing central `src/lib/permissions.ts` and `src/lib/security.ts` RBAC implementation (merged in PR #19 and hardened by later KASA PRs) remains canonical. New fee APIs are mapped explicitly to `finance.read` / `finance.record`. Approving new tariffs is additionally restricted to School `super_admin`. Marathon-only accounts have **no School permissions**; School students cannot access Marathon. All writes are server-side with verified Firebase ID tokens, profile activation, same-origin protection and audit records. The default-deny Firestore and Storage rules deny browser access to invoices, tariff registry, submissions and audit logs; Firebase Admin SDK is subject to server API authorization instead.

Older draft PRs #17 and #18 were based on obsolete authorization code and should not be merged over current main. Reconcile features in current main, preserve stronger default-deny rules, and explicitly verify newly added endpoints before release.

## Mandatory acceptance / release gates

- Review formal KASA-approved fees and exact source references. Never label a placeholder as approved.
- Run source tests, TypeScript typechecking, lint, Next.js build and Firebase rules integration.
- Login as super admin: approve one real documented version, try duplicate version, test missing approval evidence.
- Login as finance: confirm tariff is readable but cannot be approved; reconcile a student with matching verified documentation; verify audit and immutable snapshot.
- Test unquoted ledger, invalid/overpaid history, issued-letter agreement requirements, CDF and settled-account receipt blocking, duplicate receipt, and finance totals including over 500 student applications.
- Verify unauthorized student, agent, Marathon-only and inactive accounts receive 403 on both new APIs.
- Validate original acceptance letters, applicable legal/financial retention, actual payments and rates **before** production reconciliation. No live account data should be silently changed by the deployment.
