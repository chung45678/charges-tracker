# Leaky: 67-second demo script & shot list

**Project:** Leaky, a browser-based web app that finds forgotten subscriptions, price hikes and double charges in a bank statement CSV.
**Audience:** students and early-career people who pay for a pile of apps and never check their statements. Secondary audience: admissions readers and recruiters watching a portfolio.
**Story:** *I couldn't see my own subscriptions → I built a tool → it found $3,211/yr and things I'd never have caught → here's my receipt.*

**Rendered cut:** `demo/out/leaky-demo.mp4` (1920×1080, 30 fps, silent with burned-in captions). `leaky-demo.srt` holds the voiceover lines with exact timings. Re-shoot any time with `npm run demo && node demo/record.cjs && bash demo/render.sh`.

## Continuity: what must stay the same in every shot

- **One dataset throughout:** the 2-year sample statement (1,272 payments). Every number on screen comes from it: $3,211/yr, 182 h, +11% Rogers, +16% Netflix, Spotify double charge, $38,867 at 25 yrs.
- **One frame:** 1920×1080 browser capture, light theme, no browser chrome, no scrollbar, UI at 150% so text reads on a phone.
- **One caption style:** ink pill, bottom centre, yellow highlighter on the key phrase. The yellow is the brand colour and only ever marks money.
- **Wage stays $17.60/hr** (Ontario minimum wage) so the "hours of work" figure never changes between shots.
- **Camera moves:** slow push-ins (1.1–1.4 s, ease in-out), always reset before the next scroll. No whip pans, no cuts mid-move.
- **Skipped on purpose:** the file picker dialog, waiting time, every repeated click past the third toggle.

## Shot list

| Time | Visual / Live Action | Camera & Framing | Voiceover |
|---|---|---|---|
| **1 · HOOK & PROBLEM** | | | |
| 0:00–0:05 | Online-banking activity list: "Chequing ••4471", rows of coffee, transit, groceries, newest first. List starts scrolling down on its own. | Full-screen capture, static frame. Content scrolls; camera doesn't move. | "This is two years of my bank account. 1,272 payments." |
| 0:05–0:10 | Scroll continues through near-identical rows. A Spotify and a Disney+ charge slide past, unmarked. | Same static frame; the slow scroll *is* the motion. | "Somewhere in here are subscriptions I forgot I was paying for." |
| 0:10–0:15 | Every subscription row snaps to highlighter yellow, nearest first, until the screen is striped. | Same frame. The yellow wave is the beat. | "Finding them by hand? Not happening." |
| **2 · LIVE SOLUTION & AHA** | | | |
| 0:15–0:19 | **Hard cut** to Leaky's landing page, results area empty. Cursor glides to **Choose file** and clicks (ripple). File dialog skipped. | Full-width capture, static. Cursor travel ≈0.65 s. | "So I built Leaky. Drop in a statement export…" |
| 0:19–0:25 | Receipt **prints** top to bottom beside the headline. At 0:21, push in on the yellow **TOTAL PER YEAR $3,210.64** line. | Static for the print, then slow push-in (1.7×, 1.3 s) centred on the total. | "…and it prints every subscription on a receipt. In under a second." |
| 0:25–0:31 | Pull back, scroll to the summary row, push in on **PER YEAR $3,211** next to **182 h** of work. | Smooth scroll (1 s), then push-in (1.9×) on the two stats. | "$3,211 a year. That's 182 hours of work at my wage." |
| 0:31–0:40 | Scroll to **What to act on**. The first three cards get a yellow ring one after another: Rogers +11%, Netflix +16%, Spotify double charge. | Push-in (1.45×) framing exactly cards 1–3. Hold while each ring lands about 1.4 s apart. | "It catches what I'd never notice: two price hikes and a double charge." |
| 0:40–0:46 | Scroll to the subscription table. Cursor flips three **Cancel?** switches: YouTube Premium, Disney+, Claude Pro. Rows strike through as each switch flips. | Medium framing on the table, no zoom so all three rows stay in shot. Cursor moves between switches about 1.3 s apart. | "Three video apps and two AI chatbots? Time to cut a few." |
| 0:46–0:53 | Scroll up to **Cancel simulator** ($575.76/yr cut). Time-horizon slider runs 10 → 25 years. Green curve climbs and the figure rolls up to **$38,867**. | Push-in (1.45×) on the simulator card; slider animates for 2.6 s inside the hold. | "Invest that instead: $38,867 in 25 years." |
| **3 · OUTCOME & CTA** | | | |
| 0:53–1:00 | Scroll to top: receipt now shows cut items struck through. Cursor clicks **Save receipt as image** and the PNG preview pops up. | Smooth scroll to top, static wide. Modal is the final product shot. | "And I get a receipt worth sharing." |
| 1:00–1:07 | **End card:** drop logo, "Leaky", "Find the money *leaking out* of your account.", "Free · runs in your browser · nothing is uploaded", repo URL. Fade to black at 1:06. | Full-frame card, 0.6 s fade-in, held. | "Leaky runs entirely in your browser. Nothing gets uploaded. Try it with your own statement, link below." |

## Recording the voiceover

1. Open `leaky-demo.mp4` muted in any editor (CapCut, iMovie, DaVinci Resolve) and import `leaky-demo.srt` as subtitles. Each line starts exactly when it should be spoken.
2. Record each line separately, phone 15–20 cm from your mouth in a carpeted room. Read it as if you're telling a friend, not presenting.
3. Drop each clip at its subtitle's start time. Lines are written to fit with about 0.5 s to spare at a natural pace.
4. Optional: lo-fi or minimal electronic bed at −24 dB, ducked under the voice. Keep the caption burn-in. Most people watch on mute.

## Cut-downs

- **30 s (Reels/TikTok, 9:16):** 0:05–0:15 hook → 0:19–0:25 receipt → 0:31–0:40 leaks → 1:00 end card. Crop to the centre column; captions already sit in the safe area.
- **15 s:** 0:10–0:15 yellow wave → 0:19–0:25 receipt print → end card.
