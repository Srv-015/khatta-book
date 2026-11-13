# Khatta Book

Personal udhar / credit tracker for recording money given to people and repayments received. Built with Next.js 14 (App Router), Tailwind CSS, MongoDB and ExcelJS, with a bcrypt-hashed account password and signed HTTP-only login cookie.
Run it on your own PC with local MongoDB, or connect it to a MongoDB Atlas database.

## What you need
1. **Node.js 20.6 or newer** – https://nodejs.org
2. **MongoDB** – use MongoDB Community Server locally (https://www.mongodb.com/try/download/community) or create a database in MongoDB Atlas.
   Prefer Docker for a local database? `docker run -d --name khatta-mongo -p 27017:27017 -v khatta-data:/data/db --restart unless-stopped mongo:7`

## Run it
```bash
npm install
```
Create `.env.local` in the project root and set your MongoDB connection string and a private signing secret:
```dotenv
MONGODB_URI=mongodb://127.0.0.1:27017/khatta-book
AUTH_SECRET=replace-with-a-long-random-secret
```
For Atlas, use your Atlas connection string for `MONGODB_URI`. Keep `.env.local` private and do not commit it.

Start the app:
```bash
npm run dev                     # http://localhost:3000
```
On first run, the login page lets you create the account; only the first account can be created. For production, run `npm run build` once, then `npm start`.

## Backups (please use them)
- In the app: **Export > Download backup (.json)**. This file can be restored in the same screen.
- `npm run backup` writes a raw safety copy of the app's MongoDB collections to `./backups/`. Schedule it (Windows Task Scheduler / cron) and copy the folder to a USB drive or cloud storage.
- Excel / CSV exports can be re-imported from the same screen (existing IDs are skipped).

## Forgot your password?
`npm run reset-password -- "your-new-password"`

## Layout
- `app/(app)/*` – pages (dashboard, transactions, people, repayments, reports, settings)
- `app/api/*` – REST routes; data routes require login, while `/api/auth/*` handles sign-in and first-account setup
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
