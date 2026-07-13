# Speedy Reader

A free, open-source RSVP (Rapid Serial Visual Presentation) speed-reading
trainer. 

Built as a replacement for the free tier of spreeder.com, which caps
free drills at 200 words.

## Access

Live site: **https://wastella.github.io/speedy-reader/**

Or run it locally. It's a static site with no build step:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

## How it works

1. Paste your drill text into the box.
2. Set **WPM** (words per minute) and **chunk size** (words shown at once).
3. Click **Start drill** and read along.
4. While it's running you can adjust WPM and chunk size live, jump forward
   or back, and pause using the on-screen controls or these keys:
   - `Space` — play / pause
   - `←` / `→` — jump back / forward 5 chunks
   - `↑` / `↓` — WPM ±25
5. Your last-used WPM and chunk size are saved in your browser
   (`localStorage`) so the app starts there next time. Use it to progressively overload.
