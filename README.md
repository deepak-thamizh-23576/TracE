# TracE — Track Everything

A personal productivity app built entirely by AI with the help of Catalyst, Zoho MCP and Expo. I use this app to track tasks, food, goals, and reminders all in one place.

## What is does

- **Tasks** with priority levels and delay threads. When you skip a task, you log why — named Delay. Delays can be forked as new task.
- **Food** logging by meal. 
- **Goals** high-level task management that is not date-specific.
- **Reminders** with date, time, recurrence, snooze, and local push notifications.
- **Search** across all tabs.

## Stack

| Layer | Tech |
|-------|------|
| Mobile | React Native, Expo SDK 54, TypeScript, expo-router |
| Backend | Node.js serverless function on Zoho Catalyst |
| Database | Catalyst Data Store |
| Infra automation | Zoho MCP |
| Auth | Custom PBKDF2 + session tokens |
| Notifications | expo-notifications (local) |
| Build | EAS Build (Android APK), `catalyst deploy` (backend) |

## Project Structure

```
functions/          # Catalyst serverless backend (Express.js)
mobile/             # Expo React Native app
TrackEverythingTe/  # Catalyst web client (Svelte 5, deployed via slate)
```

## Run Locally

### Backend
```bash
cd functions/track_everything_te_function
npm install
cd ../..
catalyst serve
```

### Mobile
```bash
cd mobile
npm install
npx expo start
```

## Deploy

```bash
catalyst deploy          # backend + web client
eas build -p android     # mobile APK
```
