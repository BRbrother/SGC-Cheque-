================================================================================
SGC CHEQUE MANAGER — OFFLINE ANDROID WEB APPLICATION (PWA)
Owned by: Shekhawat Groups of Companies
Tagline: Smart Cheque Management. Complete Control.
================================================================================

1. OVERVIEW
SGC Cheque Manager is a 100% offline, mobile-first Progressive Web App (PWA)
engineered specifically for Google Chrome on Android devices.
- Zero external libraries, zero CDNs, zero internet dependency after first load.
- All company, bank account, calibration, and cheque records are stored locally
  on your own device via IndexedDB.
- Never transmits data to any cloud or external server.

2. PROJECT FILES
- index.html         : Mobile-first corporate UI & print layout markup
- style.css          : Navy, Royal Blue, White & Gold banking theme + @media print
- db.js              : IndexedDB local database engine + JSON backup/restore
- app.js             : Application logic, Indian Rupee words engine & calibration
- sw.js              : Service Worker for full offline caching
- manifest.json      : Web App Manifest for Android Home Screen installation
- icons/icon-192.png : App icon (192x192)
- icons/icon-512.png : App icon (512x512)
- README.txt         : Setup, hosting, installation, and backup guide

3. HOW TO HOST LOCALLY ON A PC USING PYTHON HTTP SERVER
Service Workers and PWA installation require HTTP/HTTPS (not file://).
Step 1: Extract the ZIP archive into a folder (e.g., sgc-cheque-manager).
Step 2: Open Terminal / Command Prompt inside that folder.
Step 3: Run:
        python -m http.server 8080
        (or: python3 -m http.server 8080)
Step 4: Find your PC's local Wi-Fi IP address:
        - Windows: run `ipconfig` (look for IPv4 Address, e.g., 192.168.1.15)
        - Mac/Linux: run `ifconfig` or `ip addr`

4. HOW TO RUN ON ANDROID GOOGLE CHROME
Step 1: Connect your Android phone to the same Wi-Fi network as your PC
        (or host the static folder on any local/intranet web server).
Step 2: Open Google Chrome on your Android phone.
Step 3: Navigate to: http://<YOUR-PC-IP>:8080/
Step 4: Wait 2-3 seconds for the Service Worker to cache all assets.
        The header badge will display "Offline Ready". You can now turn off
        Wi-Fi / Mobile Data completely—the app works 100% offline.

5. HOW TO INSTALL AS AN ANDROID HOME-SCREEN APP
Step 1: While viewing SGC Cheque Manager in Android Chrome, tap the three-dot
        menu (⋮) in the top-right corner.
Step 2: Tap "Add to Home screen" or "Install app".
Step 3: Confirm by tapping "Install" / "Add".
Step 4: Launch "SGC Cheque" directly from your Android app drawer/home screen
        in full-screen standalone mode without browser bars.

6. HOW TO BACK UP AND RESTORE DATA
- Backup:
  1. Tap "Backup" in the bottom navigation bar.
  2. Tap "Download Complete JSON Backup".
  3. A dated `.json` file is saved to your device's Downloads folder.
- Restore:
  1. Tap "Backup" in the bottom navigation bar.
  2. Choose your saved `.json` backup file under "Restore from JSON Backup".
  3. Tap "Restore Backup File" and confirm the prompt.

7. CHEQUE PRINTING COMPLIANCE NOTE
- Always use genuine bank-issued cheque leaves for actual cheque printing.
- Configure X/Y offsets (in mm), font size, and print scale per bank account,
  and verify alignment using "Plain-Paper Alignment Test Print" first.
================================================================================
