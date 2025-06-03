# NG-Anti-CORS 1.3 🛡️ 

## The Ultimate CORS Enabler for Developers 🚀

![Version](https://img.shields.io/badge/version-1.3-blue)
![Chrome](https://img.shields.io/badge/Chrome-supported-green)
![Edge](https://img.shields.io/badge/Edge-supported-green)
![Opera](https://img.shields.io/badge/Opera-supported-green)

**NG-Anti-CORS** is a powerful browser extension that enables Cross-Origin Resource Sharing with a single click – perfect for testing APIs and debugging web apps in local environments. 🔧

---

## Features ✨

- **Easy to Use** 🖱️ &nbsp;– One-click activation for any domain  
- **Domain-specific Control** 🌐 &nbsp;– Enable CORS per-site  
- **Advanced Fetch & XHR Support** 🔄 – Deep integration with browser request APIs  
- **Preflight Control** 🛂 – Optional handling of CORS preflight (`OPTIONS`) requests  
- **All HTTP Methods** 📡 – Basic mode supports **GET, POST, HEAD *and PUT***; Advanced mode unlocks PATCH, DELETE, OPTIONS and the rest  
- **Visual Indicators** 💡 – Color-coded icons show current status  
- **Save Settings** 💾 – Keep your preferences after browser restarts  
- **Customizable Notifications** 🔔 – Decide how and when toast notifications appear  
- **Supports Requests with Credentials\*** 🔑 – Cookies / auth headers pass through if the target server sends `Access-Control-Allow-Credentials: true`  
- **Lightweight** 🪶 – Pure Declarative Net Request, zero remote calls, minimal overhead  

\* Browsers require the **target API** to set `Access-Control-Allow-Credentials: true`; NG-Anti-CORS never injects that header automatically.

---

## Installation 📥

### 1. Chrome Web Store (recommended)

1. Open the [Chrome / Edge / Opera listing](https://chromewebstore.google.com/detail/ng-anti-cors/amlaedkdelmhjggadmigdcihfalbgpha)  
2. Click **Add to Chrome** and confirm

### 2. Manual Installation

1. Download the [latest release .zip](https://github.com/NGxDTV/NG-Anti-CORS/releases)  
2. Unzip to any folder  
3. Open `chrome://extensions/` (or `edge://extensions/`)  
4. Enable **Developer mode** (top right)  
5. Click **Load unpacked** and select the unzipped folder  

> **Opera users:** Install the helper extension **“Install Chrome Extensions”** first, then follow the Chrome steps.

---

## Usage 🚀

1. Open a page that shows CORS errors  
2. Click the NG-Anti-CORS icon  
3. Toggle **Enable CORS** for the current domain  
4. *(Optional)* Toggle **Preflight Request handling** for advanced scenarios  
5. *(Optional)* Check **Remember this setting** to persist across restarts  
6. Reload the page – CORS restrictions are gone!

*When NG-Anti-CORS is disabled for a domain, it leaves the browser’s security model untouched.*

---

### Understanding CORS Modes

| Mode | Enabled HTTP methods | Typical use-case |
|------|---------------------|------------------|
| **Basic** (default) | GET, POST, **PUT**, HEAD | Simple REST calls, most front-end dev work |
| **Advanced** (Preflight) | Full method set: PATCH, DELETE, OPTIONS … | APIs needing custom headers, credentials, complex verbs |

Enable **Preflight Request handling** when:

- You call APIs with PATCH, DELETE, OPTIONS, etc.  
- Your requests include custom headers (e.g. `Authorization`, `X-Auth-Token`)  
- You see “Method not allowed” or failed preflight in DevTools  
- You need to send cookies or HTTP-auth cross-origin and the server supports it

---

## Adjusting Settings ⚙️

1. Click the NG-Anti-CORS icon  
2. Open the **Settings** tab  
3. Change notification duration, default toggles, …  
4. Click **Save**

---

## For Developers 👨‍💻

Ideal for:

- Front-end devs consuming third-party APIs  
- Testing local micro-services (e.g. `localhost:3000` ↔︎ `localhost:5000`)  
- Debugging CORS errors in staging / prod  
- Rapid API prototyping with tools like Postman, Swagger UI, etc.

---

## Troubleshooting 🔧

1. Verify the extension is active (green icon)  
2. Check that CORS is enabled for the current domain  
3. Hard-reload the page (Ctrl + F5)  
4. Inspect DevTools → Network for failing requests  
5. Confirm the target server actually blocks CORS – some errors originate elsewhere

---

## Privacy & Security 🔒

- **No telemetry** – zero personal data collected  
- **No remote servers** – all logic runs locally via the Chrome Declarative Net Request API; no proxying  
- **Minimal storage** – only remembers your per-domain toggles  

> **Security notice:** Use NG-Anti-CORS only in development or on trusted sites. Turning off CORS weakens standard browser protections.

---

## Version History 📝

### 1.3
- Fixed stray notifications on untouched domains  
- Exempted Google / YouTube CORS flow from modification  
- Smarter detection of existing CORS headers  
- Only shows notifications when relevant and respecting user settings  
- Improved handling of protected Chrome/Edge pages  
- Switched header ops from **APPEND → SET** to avoid duplicates  
- Unique DNR rule IDs to bypass extension conflicts  
- Performance tweaks: skip domains that don’t need CORS fixes  

*(Older logs: see CHANGELOG.md)*

---

## Contributing 🤝

1. Fork → `git checkout -b feature/AmazingFeature`  
2. Commit → `git commit -m "feat: add AmazingFeature"`  
3. Push → `git push origin feature/AmazingFeature`  
4. Open a Pull Request – we ❤️ PRs!

---

## License 📄

MIT – see [LICENSE](LICENSE).

---

Developed with ❤️ for the web-dev community.
