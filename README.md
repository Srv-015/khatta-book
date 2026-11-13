# Khatta Book

Personal udhar / credit tracker. Next.js 14 (App Router) + Tailwind + MongoDB + ExcelJS, with a real login (bcrypt + signed HTTP-only cookie).
Everything runs on your own PC; your records live in your local MongoDB data folder.

## What you need
1. **Node.js 20.6 or newer** – https://nodejs.org
2. **MongoDB Community Server** running locally – https://www.mongodb.com/try/download/community
   (install it as a service, so it starts with your PC; it keeps its data files on your disk).
   Prefer Docker? `docker run -d --name khatta-mongo -p 27017:27017 -v khatta-data:/data/db --restart unless-stopped mongo:7`

## Run it
```bash
npm install
cp .env.example .env.local      # Windows: copy .env.example .env.local
# edit .env.local: set AUTH_SECRET to a long random string
npm run dev                     # http://localhost:3000
```
On first run, the login page asks you to create your account (only the first account can be created).
For everyday use, `npm run build` once, then `npm start`.

## Backups (please use them)
- In the app: **Export > Download backup (.json)**. This file can be restored in the same screen.
- `npm run backup` writes a raw safety copy of the whole database to `./backups/`. Schedule it (Windows Task Scheduler / cron) and copy the folder to a USB drive or cloud storage.
- Excel / CSV exports can be re-imported from the same screen (existing IDs are skipped).

## Forgot your password?
`npm run reset-password -- "your-new-password"`

## Layout
- `app/(app)/*` – pages (dashboard, transactions, people, repayments, reports, settings)
- `app/api/*` – REST routes (all require login; middleware.js blocks everything else)
- `lib/models.js` – MongoDB models · `lib/calc.js` – balances, statuses, countdown
- `components/*` – shell, forms, shared UI

Notes: amounts, dates and times are stored exactly as entered (dates as `YYYY-MM-DD`), so time zones never shift them. Status (Pending / Partially Paid / Fully Settled / Overdue) and countdown are calculated live from repayments and the due date.

## Using it on your phone
- The app is built phone-first: bottom tab bar, a floating **+** button for new entries, card lists instead of tables, and forms that slide up as a bottom sheet with a numeric keypad for amounts.
- **Same Wi-Fi, no deployment:** run `npm run dev -- -H 0.0.0.0`, find your computer's IP (Mac: System Settings > Wi-Fi > Details), then open `http://<that-ip>:3000` on the phone.
- **From anywhere:** deploy it (e.g. Vercel) and open the HTTPS address on your phone.
- **Install it like an app:** iPhone: Safari > Share > Add to Home Screen. Android: Chrome menu > Install app / Add to Home screen.

## Expected repayment
Each transaction has an **Expected repayment** choice instead of a date: 2–4 Days, 5–10 Days, 10–20 Days, 1–2 Months, 3–4 Months, 4–5 Months, 5–6 Months or Others.
- The earliest and latest expected dates are calculated from the transaction date (calendar months, month-end and leap years handled) and saved with the transaction (`repayDuration`, `dueMin`, `dueMax`). Changing the transaction date or the choice recalculates them.
- **Others** shows an optional custom date and optional notes. No range is generated.
- A transaction becomes **Overdue** the day after its latest expected date, if anything is still owed.
- Older records need no migration: their saved date is treated as a fixed "Others" date.
- Excel/CSV exports now have `Expected Repayment`, `Expected Repayment From`, `Expected Repayment To` and `Expected Repayment Notes` columns. Import accepts both the new and the older export format.

## Reports page: Person report
Pick a person to see every saved loan ("Given") and repayment ("Received") for them: type, amount, date and time. Tap a card to flip it and read its notes; cards without notes show "No Notes Available". Totals (given, received, outstanding) are shown above the list. The list is built from the records you already have, with nothing stored separately, and it loads in chunks of 30 as you scroll. Times are shown as saved (hour and minute); older records saved without a time show "Time not saved".

## Phone bottom bar
It slides away while you scroll down and slides back while you scroll up, like YouTube or Instagram (always shown at the very top, at the very bottom and on short pages). To reverse the direction, change `HIDE_NAV_ON` at the top of `components/Shell.js`.

## Person report notes
Cards with notes flip to show them. Cards without notes do not flip; a short "No Notes Available" pill appears above the bottom bar and disappears by itself.

## Reports vs Export
**Reports** shows only the Person report. **Export** (`/export`) has Excel & CSV export plus backup, restore and import. On phones both are in the gear menu (Settings, Reports, Export); on desktop they are separate sidebar entries.

## Making the deployed app fast (Vercel + Atlas)
Vercel runs functions in Washington, D.C. by default. If your Atlas cluster is in India or Singapore, every database call crosses the world, which feels like lag. Set the function region to the one closest to your Atlas cluster: Vercel > your project > Settings > Functions > Function Region (Mumbai `bom1`, Singapore `sin1`), then redeploy. Check your cluster's region on its Atlas card.
