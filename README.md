# ABC Revision Architect

A clean, fast, and minimal MVP web application for CA (Chartered Accountant) aspirants to solve the **1.5-Day Revision Problem** between exams. This application focuses on tracking **marks coverage** instead of task completion, using the proven ABC analysis prioritization format.

## Technologies Used

- **Frontend**: React, TailwindCSS, Vite, React Router DOM, Chart.js, jsPDF, React-Hot-Toast.
- **Backend**: Node.js, Express, bcryptjs, jsonwebtoken.
- **Database**: SQLite (`better-sqlite3`). A local single-file `.db` for MVP speed and simplicity, upgraded with multi-user isolation.

## Features

- **Marks Coverage Dashboard**: Visualize your progress using a confidence score model and real-time total marks tracking, backed by an interactive pie chart and bar charts.
- **ABC Priority Tracker**: Chapter priority split into High (A), Medium (B), and Low (C) priority blocks based on their expected exam weightage.
- **1.5-Day Planner Engine**: Input roughly how many hours you have left to study; the system calculates the fastest sequence to cover unrevised high-value chapters (prioritizing A -> B -> C). Supports PDF Plan exportation.
- **Focus Timer**: Embedded custom Pomodoro tracker designed exclusively for CA revisions (customizable fast/slow intervals) with web-audio alarms.
- **Multi-User Authenticated Sync**: Uses a fully secure, hash-encrypted JWT local authentication system. Your data is isolated to your unique login email account within the database.
- **Dark Theme UI + Notifications**: Sleek UI designed specifically to reduce eye-strain during extreme long-hour late-night pre-exam study marathons, complete with non-intrusive floating `react-hot-toast` notifications.

### Project Structure
```
D:/CA/
├── backend/                  # Express API Server
│   ├── src/
│   │   └── database.js       # SQLite database initialization & seeding
│   ├── server.js             # Main server & REST API
│   ├── package.json
│
├── frontend/                 # Vite React App
│   ├── src/
│   │   ├── api/index.js      # Axios instance & API caller hooks
│   │   ├── components/       # Layouts, Sidebars, Cards
│   │   ├── pages/            # Dashboard, Planner, Subjects
│   │   ├── App.jsx           # App Router
│   │   ├── main.jsx          # Entry point & Chart Config
│   │   ├── index.css         # Tailwind & custom properties
│   ├── package.json
│   ├── vite.config.js
```

## How to Run Locally

### 1. Requirements
Ensure you have Node.js installed. (Version 16+ recommended).

### 2. Start the Backend API
```bash
cd backend
npm install
npm run dev
```
The server will start at `http://localhost:3001` and automatically seed sample database entries for `revision_architect.db`.

### 3. Start the Frontend React Client
```bash
cd frontend
npm install
npm run dev
```
The client will start at `http://localhost:5173`. Open this URL in your browser.

## Sample Data Seeded

The local SQLite table is auto-seeded with 3 mock test subjects heavily modeled after real CA Intermediate / Foundation weightages for testing:
* **Paper 1:** Accounting
* **Paper 2:** Business Law
* **Paper 3:** Quantitative Aptitude 
