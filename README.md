# Ruth's Exercises

A small web app for Grandma: three full-body strength workouts a week from her
exercise paper, walking on the other days, and weights remembered for her. No
accounts, no server-side data, no build step, no dependencies.

**Live: https://burtbrayden-dotcom.github.io/ruth-fitness/** (GitHub Pages, deploys
automatically from `main`).

## Run it

```bash
python3 serve.py          # then open http://localhost:8766
```

`serve.py` is `python3 -m http.server` plus a no-cache header, so edits always
show up. Opening `index.html` straight from disk also works, but YouTube
refuses to play embedded videos from a `file://` page (error 153); the
"Open it on YouTube" link under each video still works.

**For her phone** it's hosted on GitHub Pages (link above). Pushing to `main`
redeploys in about a minute, and her phone picks up the change on its next
online visit. Her saved progress is unaffected. On her phone she can use
Share → *Add to Home Screen* (iPhone) or *Install app* (Android). It then
opens full-screen and keeps working at the gym with poor reception (videos
need signal).

## Test

```bash
node --test               # 45 tests: schedule, progression, walking, storage
```

The tests cover the rules. The screens were tested by hand in a browser at
375px and desktop widths and at double text size.

## Editing the program

Everything she reads is in **`js/program.js`**, kept apart from the app code:

| To change… | Edit |
|---|---|
| An exercise's name, cues, setup, easier option, caution | `exercises.<id>` |
| A video | `exercises.<id>.video` → `{ id, title, channel, note? }` (the YouTube 11-character id) |
| Which exercises are in Workout 1/2/3 | `workouts.day1/2/3.items` |
| Starting weight / machine step size | `startWeight`, `increment` |
| Sets, rep range, rest | `prescription` |
| Dumbbell sizes her gym has | `dumbbellLadder` |
| Default lifting days | `schedule.defaultLiftDays` (0 = Sunday). She can also change them under Help. |
| Walking rules | `walking` |
| Her name | `person.name` |

After adding or renaming a file, bump `VERSION` in `sw.js` so installed copies
refresh. **Don't rename an exercise id** (the key, e.g. `leg_press`) once she has
used the app. Saved history is matched by id, and an unknown id is dropped the
next time the app saves. Change the `name` instead. Run `node --test` after any edit; the
program-data tests check that every workout references real exercises with
all the fields the screen needs.

## How progression works (`js/logic.js` → `recommend`)

Double progression, conservative, and **every change is an offer she has to accept**:

| Last time | Next time |
|---|---|
| First time | Paper starting weight (or "start light" if the paper had none) |
| Reps inside 6–8 | Same weight, add a rep where comfortable |
| 8 + 8, felt **easy** | *Offers* the next weight (+5 lb machine / next dumbbell size) |
| 8 + 8, felt **about right** | Same weight once more; *offers* the increase if it happens twice in a row |
| Felt **too hard** (a struggle, or form slipped) | *Offers* a lighter weight (or the easier option if already at the lightest) |
| Just moved up | Same weight, "fewer reps at a new weight is normal" |

She records one weight, two rep taps and one "how did it feel" tap per exercise.
If the next dumbbell is more than 25% heavier (5 → 8 lb), the offer says it's
fine to stay. Trim `dumbbellLadder` to her gym's actual rack.

## Walking (`walkStatus`)

1. No goal yet: she logs steps for 3 finished days (today doesn't count until it's over) (quick-add "+10 minutes" ≈ 1,000 steps,
   or types the number from a phone/pedometer).
2. The app suggests her average rounded **up** to the nearest 500 as a starting goal.
3. At most once a week, if she reached the goal on 3+ of the last 7 days, it
   *offers* +500 steps (about 5 minutes). It stops at 10,000. "Not yet" quiets it
   for a week, and she can lower the goal any time.

## Saved data

Everything is in this browser's `localStorage` under `ruth-fitness.v1`, on one device only.
Help → *Save a backup file* / *Load a backup file* moves it between devices
(loading asks first, because it replaces what's there).
A damaged save never stops the app: it starts fresh, keeps a copy
(`ruth-fitness.v1.damaged-copy`), and says so on screen.

## Files

```
index.html          page shell
styles.css          large text, 48px+ targets, 7:1+ contrast
js/program.js       THE PROGRAM - exercises, workouts, videos, walking, safety text
js/logic.js         dates, schedule, progression, walking rules (pure, tested)
js/store.js         load/save/validate saved progress (pure, tested)
js/ui.js            DOM helpers (no innerHTML)
js/controls.js      tap-button groups + rest timer
js/app.js           shell, navigation, Today screen
js/workout.js       the workout flow
js/screens.js       Walking, Progress, Help & Settings
sw.js, manifest.webmanifest, icon*   offline + "add to home screen"
tests/logic.test.js node --test
serve.py            local server
```

## Video sources

Each one was checked through YouTube's oEmbed endpoint (exists and allows
embedding) and against its page description and thumbnail for the right
equipment variant.

| Exercise | Video | Channel |
|---|---|---|
| Leg press | Proper Leg Press Form • Weight Lifting Exercises for Osteoporosis | Margaret Martin, Physical Therapist |
| Leg curl | Beginner's Guide: Seated Leg Curl | SilverSneakers |
| Glute kickback | Cable Hip Extension Glute Exercise using a cable system | Melita ReGen Lab + Performance Center |
| Dumbbell RDL | Dumbbell Romanian Deadlift (RDL) \| TECHNIQUE for Beginners | Mobility Doc |
| Chest press | Life Fitness Pro2 Chest Press Instructions | Life Fitness / Hammer Strength |
| Lat pulldown | Beginner's Guide: Lat Pulldown | SilverSneakers |
| Lateral raise | Senior: Lateral Raise with Dumbbell Two Hands | Rehab My Patient |
| Biceps curl | Senior: How to do a Bicep Curl with Dumbbell Sitting | Rehab My Patient |
| Leg extension | Leg Extension Machine Do's and Don'ts | Stride Strong Physical Therapy |
| Hip abduction | Life Fitness Pro2 Hip Abductor Instructions | Life Fitness / Hammer Strength |
| Hip adduction | Life Fitness Pro2 Hip Adductor Instructions | Life Fitness / Hammer Strength |
| Shoulder press | How to Perform a Seated Dumbbell Shoulder Press | Nuffield Health |
| Face pull | How to do a Face Pull \| Proper Form & Technique \| NASM | NASM |
| Triceps extension | Senior: How to do a Tricep Curl | Rehab My Patient |
| Pec fly | How to Use the Pec Fly Machine | Physical Therapy First |

Most have auto-generated captions only. SilverSneakers (leg curl, lat
pulldown) has human captions, and the NASM face pull has none, so the app
tells her to follow the written steps for that one.
