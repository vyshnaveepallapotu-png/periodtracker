# 🌸 Period Tracker with PCOS/PCOD Alerts

A simple web app (HTML, CSS, JavaScript) that runs in VS Code. No installs, no backend.

**Features**
- Log period start/end dates, flow and notes
- Cycle statistics, next-period prediction and a calendar view
- **Alerts** when a period is late or missed, with a **possible PCOS/PCOD** warning when irregular cycles come with related symptoms
- **Nearest gynaecologists and hospitals** (OpenStreetMap data) using your location or a typed area, with distance, map and directions
- Data stays in your browser (localStorage). Download or delete it any time

## Run it in VS Code
1. Install [VS Code](https://code.visualstudio.com/).
2. **File → Open Folder…** and choose this `period-tracker` folder.
3. Install the **Live Server** extension (VS Code will suggest it, or search `ritwickdey.LiveServer` in Extensions).
4. Right-click `index.html` → **Open with Live Server**. The app opens at `http://127.0.0.1:5500`.

No extension? Open a terminal in VS Code (`Ctrl + ``) and run:
```bash
python -m http.server 8000
```
then visit `http://localhost:8000`. (Location access needs `localhost` or https, so don't just double-click the file.)

An internet connection is needed for the map and the hospital search.

## How the alerts work
| Situation | Alert |
|---|---|
| More than 35 days since last period began | Yellow: period is late |
| More than 60 days | Orange: more than 2 months late |
| 90 days (3 months) or more | Red: please get checked |
| Cycles outside 21-35 days at least twice, or cycles differing by 20+ days | Yellow: irregular cycles |
| Irregular/missed periods **plus** acne, extra hair or scalp hair thinning (or 2 metabolic signs) | Red: **possible PCOS/PCOD** |

This follows the idea behind the Rotterdam criteria: PCOS is suspected when 2 of 3 are present (irregular ovulation, high-androgen signs, polycystic ovaries on ultrasound). The app can only look at the first two, so it only **flags a possibility** and never diagnoses.

## Run the tests
```bash
node tests.js
```

## Files
- `index.html`, `style.css`: page and styling
- `logic.js`: cycle maths and PCOS/PCOD screening rules (no DOM, so it is testable)
- `app.js`: interface, calendar, storage and hospital search
- `tests.js`: 11 tests for the logic

## Important
This app is **not medical advice**. Late periods can also be caused by pregnancy, thyroid problems, stress, weight change, breastfeeding or medication. See a doctor for a proper check-up.
