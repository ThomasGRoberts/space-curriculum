# Space Policy and International Relations Curriculum

A static, browser-based visualization of the proposed Georgia Tech curriculum. The site reads the published **Top Language** and **Courses** tabs from Google Sheets when each page loads; the spreadsheet remains the source of truth. No proposal or course data is copied into this repository. Electives are grouped by the Courses tab's **Frequency** column, with cards in spreadsheet order within each group. The Core heading uses the singular form for one course, and category names in the description inherit their section colors automatically.

## Run locally

From this folder, run:

```sh
python3 server.py
```

Then open <http://localhost:8000>. Python 3 is the only local runtime requirement. The same static files can also be served by any basic web server.

## Publish with GitHub Pages

The site has a root-level `index.html` and uses relative asset paths, so it works from the `/space-curriculum/` project-site path. In the repository, open **Settings → Pages** and set **Build and deployment** to **Deploy from a branch**, choose **main** and **/(root)**, then save.

The browser fetches both published CSV tabs directly from Google Sheets on each page load. The CSV endpoint allows cross-origin browser reads, so GitHub Pages needs no backend, API key, build step, or copied spreadsheet data. Keep both tabs published to the web. A failed or unavailable sheet request is shown on the page rather than replaced with stale local data.

Use **Print / Save as PDF** for the portrait US Letter export.
