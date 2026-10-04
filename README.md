# Suricata Log Viewer

A small browser-based viewer for Suricata `eve.json` / JSONL logs.

## Features

- Loads the supplied `eve-sample.jsonl` through file upload or drag-and-drop.
- Parses one JSON object per line without modifying the source file.
- Shows timestamp, event type, source → destination and a human-readable event summary.
- Filters by `event_type`.
- Searches the complete JSON event content.
- Sorts by timestamp, newest or oldest first.
- Handles missing/null/invalid timestamps without placing them at 1970 unexpectedly.
- Handles numeric Unix timestamps in seconds or milliseconds.
- Color-codes alert severity.
- Pagination.
- Raw JSON can be expanded for any event.
- No framework or build step required.

## Run

The simplest option is to open `index.html` in a browser and load `eve-sample.jsonl`.

For a local HTTP server:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

Place `eve-sample.jsonl` in the same directory if you want it available alongside the app, then use the **Load JSONL** button to select it.

## Files

```text
suricata-log-viewer/
├── index.html
├── styles.css
├── app.js
└── README.md
```

## Notes

The application does not pre-clean or hand-edit `eve-sample.jsonl`. Each non-empty line is parsed independently as JSON.

If a line is malformed, it is skipped and the UI reports how many lines were ignored. Missing or invalid timestamps are displayed as such and are sorted last.

Suricata alert severity follows the common numeric convention where `1` is highest severity, `2` medium and `3+` lower severity.

## Submission

For the assignment, commit the project to GitHub and include this README.

If AI assistance was used, provide the actual exported AI prompt/chat history requested by the assignment. Do not replace the required verbatim history with a generated or reconstructed log.
