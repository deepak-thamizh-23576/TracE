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
| Web | Same codebase — Expo web build deployed to Catalyst Slate |
| Backend | Node.js serverless function on Zoho Catalyst (API-only) |
| Database | Catalyst Data Store |
| File storage | Zoho Stratus |
| Infra automation | Zoho MCP |
| Auth | Custom PBKDF2 + multi-device session tokens |
| Notifications | expo-notifications (local) |
| Build | EAS Build (Android APK), EAS Update (OTA), `catalyst deploy` |

## URLs

| Environment | URL |
|-------------|-----|
| Web (production) | `https://trace.onslate.com` |
| API (production) | `https://trackeverythingte-904503171.catalystserverless.com/server/track_everything_te_function/` |
| Local dev | `http://localhost:3000/server/track_everything_te_function/` |

## Project Structure

```
functions/          # Catalyst serverless backend (Express.js) — API only
mobile/             # Expo React Native + web app (same codebase)
```

## Run Locally

### Backend
```bash
catalyst serve
# Function available at http://localhost:3000/server/track_everything_te_function/
```

### Mobile / Web
```bash
cd mobile
npx expo start          # mobile (iOS/Android)
npx expo start --web    # web at http://localhost:8081
```

## Deploy

```bash
# Deploy backend to Development environment
catalyst deploy --only functions
# Then promote to Production via Catalyst console → Functions → Promote

# Deploy web frontend to Catalyst Slate
cd mobile && npx expo export --platform web --clear \
  && mkdir -p dist/.catalyst \
  && echo -e 'framework = "static"\ndeployment_name = "default"' > dist/.catalyst/slate-config.toml \
  && cd .. && catalyst deploy slate --production

# Mobile OTA update
cd mobile && eas update --branch production --message "description"

# Mobile native build
cd mobile && eas build --profile preview --platform android
```
