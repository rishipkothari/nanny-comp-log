# Nanny Comp Log

Next.js (App Router) + Neon Postgres app for logging a nanny's hours and pay.

- Pay periods run Saturday–Friday. Overtime is hours over the threshold (40) at the OT rate (28); personal comp due = OT pay + stipend + expenses.
- `src/lib/calc.ts` holds the shared math, status (`periodStatus`) and formatting. A closed period is **balanced** when Homepay net is paid for any hours and personal paid equals personal due; the badge just says "unbalanced" otherwise.
- Admin mode (separate password) unlocks editing. Payments autosave through `useSaver`.
- Popups use the shared `Modal` (`src/components/Modal.tsx`): pay period detail (`PeriodDetail.tsx`) and payment view/edit (`PaymentCard.tsx`).
- Checks before pushing: `npx tsc --noEmit` and `npx next build` (a dummy `DATABASE_URL` is enough to build).

## Backlog

- **Duplicate payments table.** Payments → Table (the full payment log) overlaps Summary → Payments → Table at the pay-period grouping. Decide which one stays, or make Summary keep only the month / year-to-date / year rollups.
- **Manual schedule editor.** Create and edit the schedule by hand, alongside the deduced one.
- **Google Calendar write-back.** Connect to Google and write the schedule to the calendar.
- **Remove the schedule debug switch** (model and effort picker on the Schedule page, marked `DEBUG`) once the deduction prompt is tuned.
- **Check imported history against the new balanced rule.** Older periods with hours but no Homepay net now show "unbalanced".
