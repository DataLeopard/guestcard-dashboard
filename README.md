# GuestCard Dashboard — Live Submission Tracker

Real-time spreadsheet dashboard that displays every guest card submitted through the GuestCard chatbot. Runs on a separate localhost and updates live as new leads come in — no refresh needed.

## How It Works

The GuestCard chatbot (localhost:5175) saves every submission to the browser's localStorage. This dashboard (localhost:5176) polls localStorage every 2 seconds and renders all submissions in a sortable, filterable spreadsheet. Open both side by side — complete a guest card in the chatbot and watch it appear instantly in the dashboard.

## Features

- **Live spreadsheet** — all guest card submissions displayed in a sortable table with columns for name, email, phone, move-in, bedrooms, budget, pets, properties sent to, status, and timestamp
- **Real-time sync** — polls localStorage every 2 seconds with a live indicator; new rows appear automatically
- **Lead pipeline** — update each lead's status (Sent, Contacted, Toured, Placed, Lost) directly from the dropdown
- **Sortable columns** — click any column header to sort ascending/descending
- **Status filters** — filter the table by lead status to focus on specific pipeline stages
- **Expandable rows** — click any row to reveal must-haves, notes, property emails, and contact count
- **Stats bar** — real-time counts for total leads, sent, contacted, toured, placed, and average budget
- **CSV export** — download all submissions as a CSV file for use in spreadsheets or CRMs
- **Delete and clear** — remove individual rows or clear all data
- **Dark theme** — consistent with the GuestCard chatbot design

## Running Both Apps

```bash
# Terminal 1 — Start the chatbot
cd apps/2026-03-16-guestcard-chat
npm run dev       # http://localhost:5175

# Terminal 2 — Start the dashboard
cd apps/2026-03-16-guestcard-dashboard
npm run dev       # http://localhost:5176
```

Open both in your browser side by side. Complete a search in the chatbot, send the guest card, and the dashboard updates instantly.

## Tech Stack

- **React 19** — component UI with hooks
- **Vite 6** — dev server and builds
- **localStorage** — cross-tab data sync (no backend needed)
- **CSS** — custom dark spreadsheet theme

---

Built in the Lab · 2026
