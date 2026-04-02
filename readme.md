# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Artifacts

### SafarSaathi Mobile App (`artifacts/safarsaathi`)

A safety companion mobile app built with Expo React Native.

**Features:**
- Home screen with quick access to all safety features
- Start Safe Trip — enter destination and ETA, monitor journey
- Live Tracking — real-time map with risk score display, SOS button, route display
- Risk Detection Engine — rule-based detection (route deviation, unusual stops, no response)
- Risk Alert Dialog — 15-second countdown dialog asking "Are you safe?"
- Emergency Flow — full emergency screen with contact notification simulation
- Watch Me Mode — timer-based safety check-in (15/30/45/60 min)
- Trusted Contacts — add/remove/manage emergency contacts (AsyncStorage)
- Safety Map — risk zone visualization with mock data
- Demo Mode — "Simulate Risk" button for hackathon presentations

**Tech:**
- Expo SDK 54, React Native
- react-native-maps (1.18.0, Expo Go compatible)
- expo-location for GPS
- expo-haptics for tactile feedback
- react-native-reanimated for animations
- AsyncStorage for contact persistence
- Provider pattern (TripContext) for state management

**Color Palette:**
- Primary: #1E3A8A (Deep Blue)
- Safe: #10B981 (Green)
- Warning: #F59E0B (Amber)
- Danger: #EF4444 (Red)
- Background: #F9FAFB

**Metro Config:** Custom resolveRequest in `metro.config.js` provides a web mock for `react-native-maps` so the web bundle doesn't crash.

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server
│   └── safarsaathi/        # SafarSaathi Expo mobile app
│       ├── app/            # Expo Router screens
│       ├── components/     # Reusable UI components
│       ├── constants/      # Colors, strings
│       ├── context/        # TripContext (state management)
│       └── mocks/          # Web platform mocks
├── lib/                    # Shared libraries
│   ├── api-spec/
│   ├── api-client-react/
│   ├── api-zod/
│   └── db/
└── scripts/
```
