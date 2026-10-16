# TransitPulse Bus Survey App ⚡

> High-Speed Field Data Collection Tool for Transit Surveyors

**TransitPulse** is a functional, mobile-first, high-contrast web application designed for field transit surveyors to track bus metadata, arrival/departure times, and parallel passenger boarding/alighting counts with maximum speed and zero visual clutter.

Built in strict compliance with the **TransitPulse Specification Blueprint**.

---

## 🎯 Key Design & Functional Highlights

- **Utilitarian & High-Contrast**: Outdoor sunlight-optimized UI with deep black text, bold metrics, and instant contrast toggle for day/night field shifts.
- **Strict 4-Slot Parallel Grid**: 2x2 responsive desktop grid / stacked mobile layout tracking up to 4 concurrent buses.
- **4 Distinct Color Themes**:
  - **Slot 1**: Royal Blue (`#1d4ed8`)
  - **Slot 2**: Emerald Green (`#047857`)
  - **Slot 3**: Amber / Safety Orange (`#d97706`)
  - **Slot 4**: Crimson / Purple (`#7c3aed`)
- **Large Touch Targets**: Extra-large, thumb-friendly buttons (`+1`, `+5`, `-1`, `-5`) with `touch-action: manipulation` (no 300ms mobile delay) and haptic vibration feedback.
- **Zero-Loss localStorage Persistence**:
  - `survey_recorder_name`: Session identity saved in localStorage; initial blocking modal prompts for name on first load; header reset button triggers confirmation dialog.
  - `active_bus_cards`: Every counter tap (`+1`, `+5`, `-1`, `-5`), edit, or arrival syncs **immediately** to localStorage to prevent data loss on accidental page refresh.
- **Offline / Field Resilience**: Submissions queue locally if internet connectivity is intermittent or lost, and automatically sync via `POST /api/surveys/batch` as soon as connection is restored.
- **Automated GPS & Timestamps**: Modal automatically fetches `navigator.geolocation` coordinates on open (with manual override & re-fetch), auto-records arrival time, and auto-stamps departure time upon submission if not manually adjusted.
- **Export & Analytics**: Native CSV report download endpoint (`GET /api/surveys/export`) formatted with UTF-8 BOM, plus real-time aggregated survey metrics (`GET /api/stats`).

---

## 🏗️ Architecture & Database Schema

### Database (`SQLite` via Node.js standard library `node:sqlite`)

Table: `bus_surveys`
```sql
CREATE TABLE bus_surveys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recorder_name TEXT NOT NULL,
  survey_date TEXT NOT NULL,
  route_no TEXT NOT NULL,
  vehicle_no TEXT NOT NULL,
  route_text TEXT NOT NULL,
  ownership_type TEXT NOT NULL CHECK(ownership_type IN ('Private', 'SLTB')),
  service_type TEXT NOT NULL CHECK(service_type IN ('Normal', 'AC')),
  seat_capacity_slot TEXT NOT NULL CHECK(seat_capacity_slot IN ('Below 20', '21-30', '31-40', '41-50', '51-60', 'Over 60')),
  location TEXT NOT NULL,
  arrival_time TEXT NOT NULL,
  departure_time TEXT NOT NULL,
  positive_count INTEGER NOT NULL DEFAULT 0,
  negative_count INTEGER NOT NULL DEFAULT 0,
  net_sum INTEGER NOT NULL DEFAULT 0,
  submitted_at_timestamp TEXT DEFAULT (DATETIME('now', 'localtime'))
);
```

### API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/surveys/submit` | Receives completed bus card payload and writes to SQLite DB |
| `POST` | `/api/surveys/batch` | Syncs multiple queued surveys from offline local storage |
| `GET` | `/api/surveys/export` | Downloads recorded surveys as a formatted CSV file |
| `GET` | `/api/surveys` | Lists submitted surveys (JSON) with limit parameter |
| `GET` | `/api/stats` | Aggregated totals (total buses, total boarded, total alighted, total net) |
| `DELETE` | `/api/surveys/:id` | Deletes a survey record by ID |

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Application
```bash
npm start
# Server starts at http://localhost:3000
```

### 3. Run Automated Tests
```bash
npm test
```

---

## 📱 Mobile Field Surveyor Workflow

1. **Initial Surveyor Prompt**: Enter surveyor name (e.g., "Surveyor 04"). Saved to `localStorage`.
2. **Track Arrival**: Click `+ Add New Bus`. GPS coordinates and arrival timestamp populate automatically.
3. **Select Metadata**:
   - Route Number (triggers numeric keypad via `inputmode="numeric" pattern="[0-9]*"`)
   - Vehicle Number (e.g., `WP NB-4521`)
   - Route Description (e.g., `Pettah - Maharagama`)
   - Operator Type (`Private` / `SLTB`)
   - Bus Condition (`Normal` / `AC`)
   - Number of Seats (`Below 20`, `21-30`, `31-40`, `41-50`, `51-60`, `Over 60`)
4. **Passenger Counting**: Rapidly tap `+1` / `+5` (Boarded) and `-1` / `-5` (Alighted). Net count updates instantly with zero animation latency.
5. **Submit Record**: Click `Submit Bus Record`. If departure time wasn't manually tweaked, it automatically captures current time, saves to DB, and frees up the color slot.
6. **Export CSV**: Click `📋 Records` &rarr; `📥 Download Survey CSV` to retrieve field data.
