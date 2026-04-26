# I Built a Full App Without Writing a Single Line of Code

I write developer docs for a living. For two years, I explained how others build apps — APIs, SDKs, serverless functions. I understood the concepts. I could write about them clearly. But I had never built anything myself.

Three weeks ago, that changed.

---

## The Problem

I had a simple, annoying problem. I wanted to track things — tasks, meals, goals — in one place. I tried apps. A lot of them. None of them fit. They were either too much or too little. Too rigid or too scattered. Every app I tried felt like it was built for someone else's brain.

So I asked myself a stupid question: *What if I just built the exact app I want?*

The catch — I can't code.

---

## The Setup

I opened Claude, Anthropic's AI model, and described what I wanted. A mobile app. Four sections: Tasks, Food, Goals, and Exercise. A simple backend to store everything. Auth so only I can access my data.

That first prompt turned into a working project structure in minutes. React Native with Expo for the mobile app. A Node.js serverless function on Catalyst for the backend. A single database table with a column called `itemType` that separates tasks from food from goals. Simple.

I didn't write a single line of code. Not one. Every file, every function, every component — Claude wrote it. But every decision about *what* to build and *how* it should work — that was mine.

[screenshot: TracE home screen — Tasks tab]

---

## What Actually Got Built

The app is called **TracE**. Here's what's in it today, at version 1.2.0:

**Tasks** — Add tasks with priority levels (high, medium, low). Expand a task to see its full history. If you can't get to a task today, you don't just reschedule it — you write a *delay reason*. That delay gets logged with a timestamp. Every task carries its own thread of delays, like a mini conversation with yourself about why you keep pushing it.

**Delay threads** — This was the feature I didn't plan. It emerged from use. When you delay a task, you write why. When you delay it again, you write why again. After a week, you have a thread of honest excuses staring back at you. It's uncomfortable. It works.

**Food logging** — Breakfast, lunch, dinner, snacks. No calorie counting. Just a record of what you ate. Simple text entries, organized by meal.

**Goals** — Longer-term items. Same delay thread system as tasks. You can fork a goal into a task when you're ready to act on it — with a calendar picker to set the date.

**Reminders** — This replaced the Exercise section. You type a reminder, pick a date and time from a custom calendar picker, choose whether it's one-time, daily, weekly, or monthly. The app schedules a local notification on your phone. You can snooze it (5 min, 10 min, 30 min, 1 hour) or mark it done.

**Auth** — Custom authentication. PBKDF2 password hashing. Session tokens. No third-party auth service — just a login screen and a secure flow.

**Search** — A global search overlay that works across all four tabs. Type a query and it searches through tasks, food, reminders, and goals.

[screenshot: Reminder tab with the custom date/time picker open]

---

## The Backend: One Table, One Function

The entire backend is a single serverless function running on Zoho Catalyst. One Express.js file. Routes for add, update, delete, fetch. One database table called `TeMain` with columns like `itemType`, `itemContent`, `status`, `taskDate`, and `userId`.

Every item type — tasks, food, reminders, goals — goes into the same table. The `itemType` column tells the app what it's looking at. For reminders, the `status` column stores a JSON string with the reminder datetime, completion state, and snooze info. It's not elegant by database design standards. But it works, it's fast, and it took minutes to set up.

Deploying is one command: `catalyst deploy`. The function goes live on a serverless URL. No servers to manage. No infra to think about.

[screenshot: the app on an actual phone — maybe the Reminders empty state or a task with delay thread]

---

## The Part AI Can't Do

Here's what I've learned after 30 days of building and using this app:

AI writes code fast. Impressively fast. But it doesn't know what you need. It doesn't know that delay threads would become the most useful feature. It doesn't know that exercise tracking would feel pointless and reminders would feel essential. It doesn't know that a native date picker looks out of place and a custom calendar modal feels right.

Every meaningful decision in this app came from using it daily and noticing what was missing, what was annoying, and what I kept ignoring.

The AI is the engineer. You're still the product person.

---

## What Surprised Me

**I dropped an entire section.** Exercise tracking felt forced from day one. I never opened that tab with any enthusiasm. So I ripped it out and replaced it with Reminders — something I actually needed. That decision took 30 days of real usage to make, and about 2 hours of AI-assisted coding to execute.

**Delay reasons changed my behavior.** I started writing shorter, more honest delay reasons. "Tired" instead of "will do tomorrow." That small act of writing *why* you're not doing something makes you confront it. Some tasks I deleted after seeing 5 delays in a row. That's the right outcome — you don't need to do everything, but you should stop pretending you will.

**The app got better because I used it every day.** Not as a test. As my actual system. I log meals in it. I track tasks in it. I set reminders in it. When something felt wrong, I opened Claude and fixed it that evening. The feedback loop between using and building is incredibly tight when you're the only user and the AI is the only engineer.

---

## The Stack

For anyone curious:

- **Mobile:** React Native + Expo (SDK 54), TypeScript, expo-router
- **Backend:** Node.js serverless function on Zoho Catalyst
- **Database:** Catalyst Data Store (single table)
- **Auth:** Custom PBKDF2 + session tokens
- **Notifications:** expo-notifications (local scheduling)
- **AI:** Claude — every line of code, every file, every component
- **Build & Deploy:** EAS Build for Android APK, `catalyst deploy` for backend
- **Code written by me:** 0 lines

---

## What's Next

I'm still building. The app gets better every week because I keep using it and keep noticing gaps. That's the whole point — this isn't a product I'm shipping to others. It's a tool I built for myself, with an AI, because no existing app did what I needed.

If you're someone who understands what you want to build but can't code — you're closer than you think. The gap between "I have an idea" and "I have an app on my phone" has never been smaller.

I'll keep documenting the build here. Follow along if you're building something too.

— @deepakThamizhK
