/*
 * The training program. Everything Ruth reads about an exercise lives here,
 * separate from the app code - change an exercise, a video, a rep range or
 * a cue in this file and the app follows. See README.md "Editing the program".
 *
 * Source: Brayden's paper "Full Body day 1/2/3" + "Ruth's Exercises"
 * (starting weights). Substitutions made at Brayden's direction:
 *   Rear delt machine  -> cable face pull
 *   Outer / inner thigh -> hip abduction / adduction machines (same thing, named plainly)
 *   Glute kickback     -> her choice of glute kickback OR dumbbell RDL
 */
(function (root) {
  'use strict';

  const PROGRAM = {
    person: { name: 'Ruth' },

    // Two sets of 6-8 controlled reps. Not to failure.
    prescription: { sets: 2, repsMin: 6, repsMax: 8, restSeconds: 90 },

    // Standard light dumbbell sizes. "Heavier" means the next one up here.
    dumbbellLadder: [1, 2, 3, 5, 8, 10, 12, 15, 17.5, 20, 25, 30],

    schedule: {
      defaultLiftDays: [1, 3, 5], // Mon, Wed, Fri (0 = Sunday)
      rotation: ['day1', 'day2', 'day3'],
    },

    // A slot can be a choice; she picks once and the app remembers.
    choices: {
      glute: {
        label: 'Seat (glute) exercise',
        options: ['glute_kickback', 'db_rdl'],
        default: 'glute_kickback',
      },
    },

    workouts: {
      day1: {
        title: 'Workout 1',
        items: ['leg_press', 'leg_curl', { choice: 'glute' }, 'chest_press', 'lat_pulldown', 'db_lateral_raise', 'db_curl'],
      },
      day2: {
        title: 'Workout 2',
        items: ['leg_extension', 'hip_abduction', 'leg_curl', 'db_shoulder_press', 'face_pull', 'lat_pulldown', 'db_triceps_ext'],
      },
      day3: {
        title: 'Workout 3',
        items: ['leg_press', 'hip_adduction', { choice: 'glute' }, 'pec_fly', 'lat_pulldown', 'db_shoulder_press', 'db_curl'],
      },
    },

    warmup: {
      minutes: '5 to 8',
      steps: [
        'Walk on the treadmill or ride the bike at an easy pace for about 5 minutes. You should be able to talk easily.',
        'Roll your shoulders backward 10 times.',
        'Hold onto something sturdy and march in place 10 times.',
        'On your first exercise, do a few easy practice reps with a light weight before your first real set.',
      ],
    },

    effort: {
      summary: 'Each set should feel like work, but you should finish knowing you could have done 2 or 3 more. Never push until you cannot move the weight.',
      feel: {
        easy: { label: 'Felt easy', help: 'I could have done many more' },
        right: { label: 'Felt about right', help: 'A challenge, with a few left in me' },
        hard: { label: 'Felt too hard', help: 'A struggle, or I lost good form' },
      },
    },

    exercises: {
      leg_press: {
        name: 'Leg press',
        paperName: 'Leg press (40 lb)',
        works: 'Fronts and backs of the thighs and the seat muscles. Helps with standing up from a chair and climbing stairs.',
        equipment: 'machine',
        equipmentText: 'Leg press machine',
        startWeight: 40,
        increment: 5,
        setup: 'Sit with your back flat against the pad. Put your feet flat on the platform, about hip-width apart. Set the seat so your knees are bent about as much as when you sit in a chair - not squashed up to your chest.',
        cues: [
          'Push through your whole foot, mostly your heels, and breathe out as you push.',
          'Stop just before your knees are straight, then let the platform come back slowly.',
        ],
        easier: 'Use less weight, and do not let the platform come down as far.',
        caution: 'Keep your lower back against the pad. If your hips start to curl up at the bottom, do not lower as far.',
        video: { id: "FNTd_mxtWmo", title: "Proper Leg Press Form \u2022 Weight Lifting Exercises for Osteoporosis", channel: "Margaret Martin, Physical Therapist" },
      },

      leg_curl: {
        name: 'Leg curl',
        paperName: 'Leg curl (35 lb)',
        works: 'Backs of the thighs (hamstrings). Helps with walking and supports the knees.',
        equipment: 'machine',
        equipmentText: 'Leg curl machine (seated is easiest to get in and out of)',
        startWeight: 35,
        increment: 5,
        setup: 'Line your knees up with the machine\'s pivot point - usually marked with a coloured dot. The ankle pad sits just above your heels. Lower the thigh pad until it holds your legs snugly.',
        cues: [
          'Bend your knees to pull the pad down and under you, slowly.',
          'Let it come back up slowly - do not let the weight slam down.',
        ],
        easier: 'Use less weight and make the movement smaller.',
        caution: null,
        video: { id: "t9sTSr-JYSs", title: "Beginner's Guide: Seated Leg Curl", channel: "SilverSneakers" },
      },

      glute_kickback: {
        name: 'Glute kickback',
        paperName: 'Glute kickback (10 lb each leg)',
        choiceLabel: 'Glute kickback - machine or cable, standing, holding on',
        works: 'The seat muscles (glutes). Helps with balance, stairs, and getting up.',
        equipment: 'machine',
        equipmentText: 'Glute kickback machine, or a cable machine with an ankle strap',
        perSide: true,
        sideWord: 'leg',
        startWeight: 10,
        increment: 5,
        setup: 'If you use a cable, sit on a bench to put the strap around your ankle (and again to move it to the other leg), then clip it on. Face the machine, hold on firmly with both hands, and stand tall. Do all your reps on one leg, then switch.',
        cues: [
          'Push your leg straight back slowly, squeezing your seat. Keep your back still - do not arch it.',
          'A small movement is fine. Bring the leg back slowly.',
        ],
        easier: 'Use less weight, or do it with no weight while holding on to something sturdy.',
        caution: 'Hold on with both hands the whole time for balance.',
        video: { id: "f3ebTCWwOwg", title: "Cable Hip Extension Glute Exercise using a cable system. Cable Kick Back.", channel: "Melita ReGen Lab + Performance Center", note: "The video uses a cable. If your gym has a glute kickback machine, the movement is the same." },
      },

      db_rdl: {
        name: 'Dumbbell Romanian deadlift (hip hinge)',
        paperNote: 'Not on your paper - Brayden added it as an option instead of the glute kickback.',
        choiceLabel: 'Dumbbell Romanian deadlift - bending at the hips with two dumbbells',
        works: 'Backs of the thighs, seat muscles and back. Practises bending forward to pick things up safely.',
        equipment: 'dumbbell',
        equipmentText: 'Two light dumbbells',
        pair: true,
        startWeight: null,
        increment: 0,
        setup: 'Stand tall with your feet hip-width apart and a light dumbbell in each hand, resting against the front of your thighs. Standing in front of a bench or rack gives you something to grab if you need it.',
        cues: [
          'Bend your knees slightly, then push your hips straight back, as if closing a car door with your seat. Keep your back flat.',
          'Slide the dumbbells down your thighs only as far as your back stays flat - about knee level is plenty. Squeeze your seat to stand up.',
        ],
        easier: 'Practise with no weight and your hands on your thighs until the movement feels natural.',
        caution: 'Choose the glute kickback instead if you have thinning bones (osteoporosis), back problems, or feel unsteady - unless your doctor or physical therapist has said this one is fine for you.',
        video: { id: "uUjqvxEWcbo", title: "Dumbbell Romanian Deadlift (RDL) | TECHNIQUE for Beginners", channel: "Mobility Doc" },
      },

      chest_press: {
        name: 'Chest press machine',
        paperName: 'Diverging chest press (10 lb)',
        works: 'Chest, fronts of the shoulders and backs of the arms. Helps with pushing - doors, carts, getting up off the floor.',
        equipment: 'machine',
        equipmentText: 'Chest press machine (on your paper: "diverging chest press")',
        startWeight: 10,
        increment: 5,
        setup: 'Set the seat so the handles line up with the middle of your chest. Sit with your back against the pad and your feet flat on the floor.',
        cues: [
          'Push the handles forward smoothly and breathe out. Stop just before your elbows lock.',
          'Bring them back slowly until your hands are near your chest. Do not let the weights bang.',
        ],
        easier: 'Use less weight, and only bring the handles back part of the way.',
        caution: null,
        video: { id: "sEfN2Gebvag", title: "Life Fitness Pro2 Chest Press Instructions", channel: "Life Fitness / Hammer Strength", note: "Your machine may look a little different - the movement is the same." },
      },

      lat_pulldown: {
        name: 'Lat pulldown machine',
        paperName: 'Diverging lat pulldown (20 lb)',
        works: 'Upper back and the fronts of the arms. Helps posture and pulling.',
        equipment: 'machine',
        equipmentText: 'Lat pulldown machine (on your paper: "diverging lat pulldown")',
        startWeight: 20,
        increment: 5,
        setup: 'Set the thigh pad so your legs fit snugly under it. Reach up, hold the handles, and sit down with your chest tall.',
        cues: [
          'Pull the handles down toward your upper chest, leading with your elbows, and breathe out.',
          'Let them rise slowly until your arms are almost straight.',
        ],
        easier: 'Use less weight, and do not let your arms go all the way up.',
        caution: null,
        video: { id: "AOpi-p0cJkc", title: "Beginner's Guide: Lat Pulldown", channel: "SilverSneakers", note: "The video uses a bar; your machine may have two separate handles - the movement is the same." },
      },

      db_lateral_raise: {
        name: 'Side arm raise (dumbbell lateral raise)',
        paperName: 'Dumbbell lateral raise (5 lb)',
        works: 'The sides of the shoulders. Helps with lifting and reaching out to the side.',
        equipment: 'dumbbell',
        equipmentText: 'Two light dumbbells and a bench or sturdy chair',
        pair: true,
        startWeight: 5,
        increment: 0,
        setup: 'Sit tall near the front of a bench or chair, feet flat on the floor, a dumbbell in each hand by your sides, palms facing in.',
        cues: [
          'Raise your arms out to the sides with a slight bend in the elbows, up to shoulder height - no higher.',
          'Lower slowly. Keep your shoulders down, away from your ears.',
        ],
        easier: 'Use lighter dumbbells or none, and only raise your arms partway.',
        caution: 'If you feel pinching in your shoulder, do not raise your arms as high.',
        video: { id: "lh1OMIlinrU", title: "Senior: Lateral Raise with Dumbbell Two Hands", channel: "Rehab My Patient", note: "Short video with little talking - follow the steps written below it." },
      },

      db_curl: {
        name: 'Arm curl (dumbbell biceps curl)',
        paperName: 'Dumbbell bicep curl (5 lb)',
        works: 'The fronts of the upper arms. Helps with carrying groceries and lifting things.',
        equipment: 'dumbbell',
        equipmentText: 'Two light dumbbells and a bench or sturdy chair',
        pair: true,
        startWeight: 5,
        increment: 0,
        setup: 'Sit tall with your feet flat and a dumbbell in each hand, arms hanging down, palms facing forward.',
        cues: [
          'Keep your elbows by your sides and curl the weights up toward your shoulders.',
          'Lower slowly all the way down. No swinging.',
        ],
        easier: 'Use lighter dumbbells, or do one arm at a time.',
        caution: null,
        video: { id: "8I640AY2j-U", title: "Senior: How to do a Bicep Curl with Dumbbell Sitting", channel: "Rehab My Patient", note: "Short video with little talking - follow the steps written below it." },
      },

      leg_extension: {
        name: 'Leg extension machine',
        paperName: 'Leg extension (30 lb)',
        works: 'Fronts of the thighs. Helps the knees and getting up from a chair.',
        equipment: 'machine',
        equipmentText: 'Leg extension machine',
        startWeight: 30,
        increment: 5,
        setup: 'Line your knees up with the machine\'s pivot point (the coloured dot). The ankle pad rests on the front of your lower legs, just above your feet. Hold the side handles.',
        cues: [
          'Straighten your legs slowly and pause for a moment at the top.',
          'Lower slowly - do not let the weight drop.',
        ],
        easier: 'Use less weight, and start with your knees less bent.',
        caution: 'If your knees hurt, make the movement smaller or skip it today.',
        video: { id: "E4ssgvtzjR8", title: "Leg Extension Machine Do's and Don'ts", channel: "Stride Strong Physical Therapy", note: "The video shows some common mistakes on purpose - copy the \"do\" version." },
      },

      hip_abduction: {
        name: 'Outer thigh machine (hip abduction)',
        paperName: 'Outer thigh (40 lb)',
        works: 'The outsides of the hips. Helps you stay steady side to side when walking.',
        equipment: 'machine',
        equipmentText: 'Hip abduction machine - the one where you push your knees OUT',
        startWeight: 40,
        increment: 5,
        setup: 'Sit with your back against the pad. The pads go on the outsides of your knees. Start with your legs together.',
        cues: [
          'Push your knees outward slowly and steadily.',
          'Come back slowly. Do not let the weights touch down hard.',
        ],
        easier: 'Use less weight and make the movement smaller.',
        caution: null,
        video: { id: "RfC_GJ9FvP0", title: "Life Fitness Pro2 Hip Abductor Instructions", channel: "Life Fitness / Hammer Strength", note: "If your gym has one machine for both inner and outer thigh, it works the same way - just set it for pushing out." },
      },

      hip_adduction: {
        name: 'Inner thigh machine (hip adduction)',
        paperName: 'Inner thigh (30 lb)',
        works: 'The inner thighs. Helps with steadiness and supports the hips and knees.',
        equipment: 'machine',
        equipmentText: 'Hip adduction machine - the one where you squeeze your knees IN',
        startWeight: 30,
        increment: 5,
        setup: 'Sit with your back against the pad. The pads go on the insides of your knees. Set the starting width so you feel a gentle stretch - not a wide one.',
        cues: [
          'Squeeze your knees together slowly.',
          'Let them open slowly, only as wide as is comfortable.',
        ],
        easier: 'Use less weight and a narrower starting width.',
        caution: 'Start with a narrow setting. Opening too wide can strain the groin.',
        video: { id: "iJ7hmniZqdI", title: "Life Fitness Pro2 Hip Adductor Instructions", channel: "Life Fitness / Hammer Strength", note: "If your gym has one machine for both inner and outer thigh, it works the same way - just set it for squeezing in." },
      },

      db_shoulder_press: {
        name: 'Overhead press (seated dumbbell shoulder press)',
        paperName: 'Dumbbell overhead shoulder press (5 lb)',
        works: 'Shoulders and the backs of the arms. Helps with reaching up to high shelves.',
        equipment: 'dumbbell',
        equipmentText: 'Two light dumbbells and a bench with a back rest set upright',
        pair: true,
        startWeight: 5,
        increment: 0,
        setup: 'Sit on a bench with the back rest upright and your feet flat. Hold the dumbbells at shoulder height, palms facing forward or facing each other - whichever is more comfortable.',
        cues: [
          'Press the weights up until your arms are almost straight, and breathe out. Keep your back against the pad.',
          'Lower slowly back to shoulder height.',
        ],
        easier: 'Use lighter dumbbells, or press one arm at a time.',
        caution: 'Skip this one if reaching overhead hurts your shoulder, and mention it to your doctor.',
        video: { id: "poD_-zaG9hk", title: "How to Perform a Seated Dumbbell Shoulder Press | Nuffield Health", channel: "Nuffield Health", note: "The person in the video uses heavier weights - start light." },
      },

      face_pull: {
        name: 'Face pull (cable machine with rope)',
        paperNote: 'This replaces "Rear delt" on your paper.',
        works: 'The backs of the shoulders and upper back. Helps posture and keeps the shoulders healthy.',
        equipment: 'cable',
        equipmentText: 'Cable machine with a rope handle',
        startWeight: null,
        increment: 5,
        setup: 'Set the cable at about face height and clip on the rope. Hold one end of the rope in each hand, thumbs toward you, and step back until your arms are straight. Stand with one foot a little in front of the other for balance.',
        cues: [
          'Pull the rope toward your face, elbows out and up, and squeeze your shoulder blades together.',
          'Let your arms straighten slowly. Keep it light - this one is about control.',
        ],
        easier: 'Use less weight, or sit on a bench to do it.',
        caution: 'When you finish, step forward until the weights rest before you let go of the rope. If you feel the cable pulling you forward, sit on a bench to do this one.',
        video: { id: "eTCBSFlCJ_s", title: "How to do a Face Pull | Proper Form & Technique | NASM", channel: "National Academy of Sports Medicine (NASM)", note: "This short video has no talking - follow the steps written below it." },
      },

      db_triceps_ext: {
        name: 'Back-of-arm raise (one-arm triceps extension)',
        paperName: 'Dumbbell tricep extension (5 lb)',
        paperNote: 'On your paper: "Dumbbell tricep extension". Here it is done one arm at a time, which is easier on the shoulders.',
        works: 'The backs of the upper arms. Helps with pushing yourself up from a chair.',
        equipment: 'dumbbell',
        equipmentText: 'One light dumbbell and a bench or chair with a back rest',
        perSide: true,
        sideWord: 'arm',
        startWeight: 5,
        increment: 0,
        setup: 'Sit tall with your back supported and your feet flat. Hold one dumbbell in one hand and raise that arm straight up. Use your other hand to support the raised arm just below the elbow. Do all your reps, then switch arms.',
        cues: [
          'Keep your elbow pointing up. Bend it to lower the weight slowly behind your head.',
          'Straighten your arm to lift it back up. Move slowly - do not let it drop.',
        ],
        easier: 'Use a lighter dumbbell, or no weight at all, and lower it only partway.',
        caution: 'If reaching overhead is uncomfortable, ask a staff member to show you the cable "triceps pushdown" instead.',
        video: { id: "97UFFpyN8A4", title: "Senior: How to do a Tricep Curl", channel: "Rehab My Patient", note: "The video calls it a \"tricep curl\" - it is the same exercise." },
      },

      pec_fly: {
        name: 'Chest fly machine (pec fly)',
        paperName: 'Pec fly (20 lb)',
        works: 'The chest and fronts of the shoulders. Helps with hugging and carrying things in front of you.',
        equipment: 'machine',
        equipmentText: 'Pec fly machine (also called a "pec deck")',
        startWeight: 20,
        increment: 5,
        setup: 'Set the seat so the handles are at chest height. Sit with your back against the pad. Set the starting position so your arms are not stretched far back.',
        cues: [
          'Bring your arms together in front of you, like a wide hug, and breathe out.',
          'Open slowly, only as far as is comfortable.',
        ],
        easier: 'Use less weight, and do not open your arms as far.',
        caution: 'Do not let your arms go back behind your body.',
        video: { id: "s0-r_osOKQQ", title: "How to Use the Pec Fly Machine", channel: "Physical Therapy First" },
      },
    },

    walking: {
      longTermGoal: 10000,
      minimumGoal: 1000,
      stepUp: 500,           // goal rises by this much, at most once a week
      daysToStepUp: 3,       // ...after reaching the goal this many days in the past week
      baselineDays: 3,       // logged days before suggesting a starting goal
      stepsPerMinute: 100,   // about 100 steps a minute at an ordinary walking pace
      quickWalks: [5, 10, 15, 20, 30],
      tips: [
        'Short walks count. Two or three 10-minute walks are just as good as one long one.',
        'Walk at a pace where you can still talk comfortably.',
        'Wear supportive shoes. In bad weather, walk indoors - a shopping centre or a store works well.',
        'Missed a day? That is fine. Pick up again tomorrow.',
        'Stop and rest if you feel chest pain, dizziness, or unusually short of breath. If chest pain, pressure or tightness, or severe shortness of breath does not go away within a few minutes of resting, call 911.',
      ],
    },

    safety: {
      intro: 'This app is a guide to help you exercise regularly. It is not medical advice, and it does not know your health history.',
      points: [
        'Before you start, check with your doctor - especially if you have a heart or lung condition, high blood pressure, diabetes, joint or back problems, thinning bones, have had a fall, or have not been active for a while.',
        'Start with a weight that feels comfortable. Smooth, controlled movements matter more than heavy weights.',
        'Hold onto a support whenever you are standing and want extra balance.',
        'Stop the exercise right away if you feel pain, dizziness, chest discomfort, or anything that feels unusual. Do not push through it to finish a set.',
        'If chest pain, pressure or tightness, or severe shortness of breath does not go away within a few minutes of resting, call 911.',
        'Breathe normally. Do not hold your breath while lifting.',
        'Change or skip any exercise that does not feel right for you. Use the easier option whenever you want.',
      ],
    },
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = PROGRAM;
  else root.PROGRAM = PROGRAM;
})(typeof window !== 'undefined' ? window : this);
