# Expand AI — Photo Uncrop & Video Animator

A monorepo for an iOS app (built with Expo SDK 54, developable from **Windows + PowerShell** via EAS),
a Firebase backend, and a website + admin dashboard.

```
uncropper/
├── app/          # Expo SDK 54 iOS app (React Native + expo-router + TypeScript)
├── functions/    # Firebase Cloud Functions (Admin SDK: users, tickets, AI proxy)
├── web-admin/    # Vite + React website AND admin dashboard
├── firebase.json # Firebase project config (Hosting, Functions, Firestore, Storage)
├── firestore.rules
├── storage.rules
└── README.md
```

## What's built

| Area | Status |
|------|--------|
| Anonymous / Google / Apple sign-in (Firebase Auth) | ✅ |
| In-app support ticket submission | ✅ |
| AI Uncrop (outpaint) + Animate — via **cloud API proxy** (Replicate/Fal) | ✅ wired, needs API key |
| On-device CoreML SDXL / LivePortrait | ⛔ not possible from Windows/Expo — see "AI engine" below |
| Web marketing site | ✅ |
| Admin dashboard: monitor users, disable, password-reset, support tickets | ✅ |

## Prerequisites (Windows PowerShell)

```powershell
node --version   # 18+ (you have 24)
npm  --version
npm install -g eas-cli
```

You do **not** need a Mac. EAS Build compiles the iOS app on Apple's cloud machines.
For day-to-day development, run the JS bundle with `npx expo start` and preview it on a
physical iPhone using the **Expo Go** app (for unsigned JS) or an **EAS dev build**
(for the native auth modules — Apple/Google sign-in need a dev build, not Expo Go).

## 1. Firebase project setup

1. Create a project at https://console.firebase.google.com
2. Enable **Authentication** → Sign-in methods: **Anonymous**, **Google**, **Apple**.
3. Create a **Firestore** database (production mode).
4. Enable **Storage**.
5. Register apps:
   - iOS app (bundle id `com.expandai.uncropper`) → download `GoogleService-Info.plist`.
   - Web app → copy the config object into the `.env` files below.
6. Install the CLI and log in:
   ```powershell
   npm install -g firebase-tools
   firebase login
   firebase use --add        # pick your project, alias it "default"
   ```

## 2. Configure env files

Copy each `.env.example` to `.env` and fill in your Firebase web config + AI key:

```powershell
Copy-Item app\.env.example app\.env
Copy-Item web-admin\.env.example web-admin\.env
Copy-Item functions\.env.example functions\.env
```

## 3. Backend (Cloud Functions)

```powershell
cd functions
npm install
npm run build
firebase deploy --only functions,firestore:rules,storage
```

Make yourself an admin (one-time), using your UID from the Firebase Auth console:

```powershell
# After deploy, call the bootstrap function once with the secret from functions/.env
firebase functions:shell
# then in the shell:  bootstrapAdmin({ uid: 'YOUR_UID', secret: 'YOUR_BOOTSTRAP_SECRET' })
```

## 4. Web + admin dashboard

```powershell
cd web-admin
npm install
npm run dev           # local dev at http://localhost:5173
npm run build
firebase deploy --only hosting
```

The public site is at `/`. The admin dashboard is at `/admin` and requires a Firebase
account with the `admin` custom claim.

## 5. iOS app

```powershell
cd app
npm install
npx expo install --fix      # pins every dep to the exact SDK 54 version
npx expo start              # dev server; press 'i' won't work on Windows — scan QR with iPhone
```

To produce an installable iOS build (Apple Developer account required, $99/yr):

```powershell
eas login
eas build:configure
eas build --platform ios --profile development   # dev client w/ native auth modules
eas build --platform ios --profile production    # App Store build
eas submit --platform ios                        # upload to App Store Connect
```

## AI engine note

Your original spec called for **on-device** CoreML (SDXL outpaint + LivePortrait) on the
Apple Neural Engine. That requires macOS + Xcode + `coremltools` and cannot be built or run
from Windows/Expo. Per the chosen approach, the uncrop/animate features call a **cloud
inference API** (`functions/src/ai.ts`, default provider Replicate). When you later have a
Mac, you can replace the cloud calls with an Expo **native module / config plugin** that
loads a `.mlpackage` and runs on-device — the app UI and the `useAi()` hook stay the same.
