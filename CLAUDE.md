# Nanny Comp Log

Next.js (App Router) + Neon Postgres app for logging a nanny's hours and pay.

- Pay periods run Saturday–Friday. Overtime is hours over the threshold (40) at the OT rate (28). Pay is **regular** (non-overtime, entered by hand) and **personal** (personal due = OT pay + stipend + expenses); each has a due and a paid amount (`regular_due` / `regular_paid` / `regular_date` columns, formerly `homepay_*`).
- `src/lib/calc.ts` holds the shared math, status (`periodStatus`) and formatting. A closed period is **balanced** when regular paid equals regular due (and is paid at all for any hours) and personal paid equals personal due; the badge just says "unbalanced" otherwise.
- Admin mode (separate password) unlocks editing. Payments autosave through `useSaver`; focusing an empty paid box fills in the full amount due, and an empty date box fills in today.
- Popups use the shared `Modal` (`src/components/Modal.tsx`): pay period detail (`PeriodDetail.tsx`) and payment view/edit (`PaymentCard.tsx`).
- Tables live in `src/components/SummaryTables.tsx`. `PaymentLog` (every payment detail plus badges, rows open the payment popup) is Payments → Summary and Reports → Payments at the pay-period grouping; Reports' month / year rollups use `PaymentsTable`. Timesheet → Summary rows link to the pay period batch editor.
- Checks before pushing: `npx tsc --noEmit` and `npx next build` (a dummy `DATABASE_URL` is enough to build).
- **Never commit or push without asking first.** Several sets of changes often go into one build; make the edits, run the checks, then ask.

## Backlog

- **Manual schedule editor.** Create and edit the schedule by hand, alongside the deduced one.
- **Google Calendar write-back.** Connect to Google and write the schedule to the calendar.
- **Remove the schedule debug switch** (model and effort picker on the Schedule page, marked `DEBUG`) once the deduction prompt is tuned.
- **Check imported history against the new balanced rule.** Older periods with hours but no regular paid, or where regular paid ≠ regular due (imported Homepay earnings vs net), now show "unbalanced".
- **Drop the legacy `homepay_*` payment columns** once the regular due / paid release is merged: remove them from `setup.ts` (and its catch-up copy), the payment API and `import.ts`.
