# Nanny Comp Log

Next.js (App Router) + Neon Postgres app for logging a nanny's hours and pay.

- Pay periods run Saturday–Friday. Overtime is hours over the threshold (40) at the OT rate (28); personal comp due = OT pay + stipend + expenses.
- `src/lib/calc.ts` holds the shared math, status (`periodStatus`) and formatting. A closed period is **balanced** when Homepay net is paid for any hours and personal paid equals personal due; the badge just says "unbalanced" otherwise.
- Admin mode (separate password) unlocks editing. Payments autosave through `useSaver`.
- Popups use the shared `Modal` (`src/components/Modal.tsx`): pay period detail (`PeriodDetail.tsx`) and payment view/edit (`PaymentCard.tsx`).
- Tables live in `src/components/SummaryTables.tsx`. `PaymentLog` (every payment detail plus badges, rows open the payment popup) is Payments → Summary and Reports → Payments at the pay-period grouping; Reports' month / year rollups use `PaymentsTable`. Timesheet → Summary rows link to the pay period batch editor.
- Checks before pushing: `npx tsc --noEmit` and `npx next build` (a dummy `DATABASE_URL` is enough to build).

## Backlog

- **Manual schedule editor.** Create and edit the schedule by hand, alongside the deduced one.
- **Google Calendar write-back.** Connect to Google and write the schedule to the calendar.
- **Remove the schedule debug switch** (model and effort picker on the Schedule page, marked `DEBUG`) once the deduction prompt is tuned.
- **Check imported history against the new balanced rule.** Older periods with hours but no Homepay net now show "unbalanced".
