if (!window.ngAntiCorsActive) {
    window.ngAntiCorsActive = true;
    window.ngAntiCorsNotification = null;

    function removeExistingNotification() {
        try {
            const existingNotification = document.getElementById("ng-anti-cors-notification");
            if (existingNotification && existingNotification.parentNode) {
                existingNotification.parentNode.removeChild(existingNotification);
            }
            if (window.ngAntiCorsNotification && window.ngAntiCorsNotification.parentNode) {
                window.ngAntiCorsNotification.parentNode.removeChild(window.ngAntiCorsNotification);
            }
        } catch (e) {
            console.error("Error cleaning up old notification:", e);
        }
        window.ngAntiCorsNotification = null;
    }

    function showNotification(domain, settings) {
        removeExistingNotification();
        if (!settings || !settings.showNotification) return;
        const notification = document.createElement("div");
        notification.id = "ng-anti-cors-notification";
        notification.textContent = `NG-Anti-CORS: CORS requests are allowed for ${domain}`;
        notification.style.position = "fixed";
        notification.style.bottom = "10px";
        notification.style.right = "10px";
        notification.style.background = "green";
        notification.style.color = "white";
        notification.style.padding = "5px 10px";
        notification.style.borderRadius = "4px";
        notification.style.zIndex = "9999";
        notification.style.fontSize = "12px";
        notification.style.opacity = "0.8";
        notification.style.transition = "opacity 0.3s";
        notification.addEventListener("mouseover", () => notification.style.opacity = "1");
        notification.addEventListener("mouseout", () => notification.style.opacity = "0.8");
        function appendNotification() {
            if (document.body) {
                document.body.appendChild(notification);
                window.ngAntiCorsNotification = notification;
                const duration = (settings.notificationDuration || 5) * 1000;
                setTimeout(() => {
                    try {
                        if (notification.parentNode) notification.parentNode.removeChild(notification);
                    } catch (e) {
                        console.error("Error removing notification:", e);
                    }
                    window.ngAntiCorsNotification = null;
                }, duration);
            } else setTimeout(appendNotification, 100);
        }
        appendNotification();
    }

    const domain = extractDomain(window.location.href);
    chrome.runtime.sendMessage({ action: "getDomainState", domain }, (domainState) => {
        if (!domainState || !domainState.state) return;
        function shouldShowCorsNotification() {
            try {
                const hostname = new URL(window.location.href).hostname.toLowerCase();
                const excludedDomains = ["youtube.com", "google.com", "gstatic.com", "ytimg.com", "googleapis.com", "doubleclick.net", "ggpht.com"];
                if (excludedDomains.some(d => hostname.includes(d))) return false;
                const corsMetaTags = document.querySelectorAll('meta[http-equiv="Access-Control-Allow-Origin"]');
                if (corsMetaTags.length > 0) return false;
                return true;
            } catch (e) {
                console.error("Error checking CORS implementation:", e);
                return true;
            }
        }
        if (!shouldShowCorsNotification()) return;
        chrome.runtime.sendMessage({ action: "getSettings" }, (settings) => {
            if (!settings) settings = { showNotification: true, notificationDuration: 5 };
            try {
                if (settings.showNotification) showNotification(domain, settings);
            } catch (error) {
                console.error("Error showing notification:", error);
            }
        });
    });

    chrome.runtime.onMessage.addListener((message) => {
        if (message.action === "settingsChanged") { const settings = message.settings; }
        if (message.action === "corsDisabled") removeExistingNotification();
        if (message.action === "corsStateChanged" && message.domain === currentDomain) {
            window.ngAntiCorsEnabled = message.enabled === true;
            window.ngAntiCorsPreflightEnabled = message.preflightEnabled === true;
            window.postMessage({ type: "NG_ANTI_CORS_STATUS", enabled: window.ngAntiCorsEnabled, preflightEnabled: window.ngAntiCorsPreflightEnabled }, "*");
            if (!window.ngAntiCorsEnabled) removeExistingNotification();
        }
        return false;
    });

    window.addEventListener("message", (event) => {
        if (event.source === window && event.data?.type === "FETCH_REQUEST") {
            if (!window.ngAntiCorsEnabled) {
                console.log("NG-Anti-CORS: Ignoring fetch request because CORS is disabled for this domain");
                window.postMessage({ type: "FETCH_RESPONSE", id: event.data.id, ok: false, error: "NG-Anti-CORS is disabled for this domain" }, "*");
                return;
            }
            const advancedMethods = ["PUT", "DELETE", "OPTIONS", "PATCH", "PROPFIND", "PROPPATCH", "MKCOL", "COPY", "MOVE", "LOCK", "UNLOCK"];
            const method = event.data.options?.method?.toUpperCase() || "GET";
            if (advancedMethods.includes(method) && !window.ngAntiCorsPreflightEnabled) {
                console.log(`NG-Anti-CORS: Ignoring ${method} request because preflight handling is disabled`);
                window.postMessage({ type: "FETCH_RESPONSE", id: event.data.id, ok: false, error: `Advanced method ${method} requires enabling Preflight Request handling` }, "*");
                return;
            }
            const { id, url, options } = event.data;
            try {
                chrome.runtime.sendMessage({ type: "FETCH_PROXY", id, url, options }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.error("NG-Anti-CORS: Extension error:", chrome.runtime.lastError);
                        window.postMessage({ type: "FETCH_RESPONSE", id, ok: false, error: "Extension context invalidated or error occurred" }, "*");
                        return;
                    }
                    window.postMessage({ type: "FETCH_RESPONSE", id, ok: response.ok, status: response.status, statusText: response.statusText, text: response.text, headers: response.headers || {}, error: response.error }, "*");
                });
            } catch (error) {
                console.error("NG-Anti-CORS: Failed to send message to extension:", error);
                window.postMessage({ type: "FETCH_RESPONSE", id, ok: false, error: "Extension communication failed. Page may need to be refreshed." }, "*");
            }
        } else if (event.source === window && event.data?.type === "NG_ANTI_CORS_READY") {
            window.postMessage({ type: "NG_ANTI_CORS_STATUS", enabled: window.ngAntiCorsEnabled, preflightEnabled: window.ngAntiCorsPreflightEnabled }, "*");
        } else if (event.source === window && event.data?.type === "NG_ANTI_CORS_STATUS_UPDATED") {
            console.log(`NG-Anti-CORS content script: Status updated to ${event.data.enabled ? "enabled" : "disabled"}, Preflight: ${event.data.preflightEnabled ? "enabled" : "disabled"}`);
        }
    });

    function extractDomain(url) {
        if (!url) return "";
        try {
            const hostname = new URL(url).hostname;
            const parts = hostname.split(".");
            return parts.length > 2 ? parts.slice(-2).join(".") : hostname;
        } catch (e) {
            console.error("Error extracting domain:", e);
            return "";
        }
    }

    function isProtectedDomain(url) {
        if (!url) return false;
        try {
            const hostname = new URL(url).hostname;
            if (hostname === "chrome.google.com") return true;
            if (url.startsWith("chrome://")) return true;
            if (url.startsWith("chrome-extension://")) return true;
            return false;
        } catch (e) { return false; }
    }

    const currentDomain = extractDomain(window.location.href);
    let isProtected = false;
    if (isProtectedDomain(window.location.href)) {
        console.log(`NG-Anti-CORS: Skipping protected domain: ${currentDomain}`);
        isProtected = true;
    }

    if (!isProtected) {
        try {
            chrome.runtime.sendMessage({ action: "getDomainState", domain: currentDomain }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error("NG-Anti-CORS: Extension error:", chrome.runtime.lastError);
                    return;
                }
                console.log(`Domain state for ${currentDomain}:`, response);
                window.ngAntiCorsEnabled = response && response.state === true;
                window.ngAntiCorsPreflightEnabled = response && response.preflightEnabled === true;
                const script = document.createElement("script");
                script.src = chrome.runtime.getURL("inject.js");
                document.documentElement.appendChild(script);
                script.onload = () => {
                    script.remove();
                    window.postMessage({ type: "NG_ANTI_CORS_STATUS", enabled: window.ngAntiCorsEnabled, preflightEnabled: window.ngAntiCorsPreflightEnabled }, "*");
                };
            });
        } catch (error) {
            console.error("NG-Anti-CORS: Failed to communicate with extension:", error);
        }
    }
}
