# Khatta Book

A simple personal **Udhar / Credit Tracker** to manage money given, money received, pending balances, and repayments.

Built with **Next.js 14, Tailwind CSS, MongoDB, and ExcelJS**.

## Features

- **Dashboard:** Overview of your financial activity.
- **People:** Track transactions person by person.
- **Transactions:** Record money given and repayments.
- **Repayment Tracking:** Monitor pending, partially paid, settled, and overdue amounts.
- **Person Reports:** View complete transaction history and outstanding balances.
- **Export:** Download records in Excel and CSV formats.
- **Backup & Restore:** Securely back up and restore your records.
- **Mobile Friendly:** Use it on desktop, tablet, or smartphone.
- **Secure Login:** Password protection and authentication.

## Installation

**Requirements:** Node.js 20.6+ and MongoDB.

```bash
git clone https://github.com/Srv-015/khatta-book.git
cd khatta-book
npm install
```

Create your environment file:

```bash
cp .env.example .env.local
```

Add your MongoDB connection string and a secure `AUTH_SECRET` to `.env.local`.

Start the application:

```bash
npm run dev
```

Open **http://localhost:3000** in your browser.

## Expected Repayment

Choose a repayment duration when adding a transaction:

- 2–4 Days
- 5–10 Days
- 10–20 Days
- 1–2 Months
- 3–4 Months
- 4–5 Months
- 5–6 Months
- Others

Expected dates are calculated automatically. Transactions with unpaid balances become overdue after the expected repayment period.

## Reports & Export

- View person-wise transaction history, notes, and balances.
- Export data to Excel or CSV.
- Download and restore JSON backups.
- Import previously exported records.

## Mobile Access

Access Khatta Book from your phone using the same Wi-Fi network or through its deployed HTTPS URL.

You can also add it to your phone's home screen for app-like access.

## Production

```bash
npm run build
npm start
```

For cloud deployment, use a hosted MongoDB database such as MongoDB Atlas and a platform such as Vercel.

---

**Khatta Book – Every transaction, properly tracked.**
