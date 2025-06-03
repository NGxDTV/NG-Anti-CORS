let enabledDomains = {};
let enabledTabs = new Set();
let preflightEnabledDomains = {};
let settings = { showNotification: true, notificationDuration: 5 };

function updateIcon(tabId, domain) {
    const enabled = domain && enabledDomains[domain];
    const iconName = enabled ? "icon-green" : "icon-red";
    const iconDetails = { path: { "16": `images/${iconName}-16.png`, "48": `images/${iconName}-48.png`, "128": `images/${iconName}-128.png` } };
    if (tabId) iconDetails.tabId = tabId;
    chrome.action.setIcon(iconDetails);
    const title = enabled ? `CORS allowed for ${domain}` : `CORS-behavior unchanged for ${domain}`;
    tabId ? chrome.action.setTitle({ tabId, title }) : chrome.action.setTitle({ title });
}

const RULE_ID_BASE = Math.floor(Math.random() * 100000) + 10000;
const RULE_ID = RULE_ID_BASE;
const PREFLIGHT_RULE_ID = RULE_ID_BASE + 1;

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD, PROPFIND, PROPPATCH, MKCOL, COPY, MOVE, LOCK, UNLOCK",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Expose-Headers": "*",
    "Access-Control-Max-Age": "7200"
};

async function setupDeclarativeRules() {
    try { await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [RULE_ID, PREFLIGHT_RULE_ID] }); } catch (err) { console.error("Error removing rules:", err); }
    if (enabledTabs.size === 0) return;
    const resourceTypes = ["xmlhttprequest","other"];
    const filteredEnabledTabs = new Set();
    for (const tabId of enabledTabs) {
        try {
            const tab = await chrome.tabs.get(tabId);
            if (tab && tab.url && !isExcludedCORSDomain(tab.url)) filteredEnabledTabs.add(tabId);
        } catch (e) {}
    }
    if (filteredEnabledTabs.size === 0) return;
    const responseHeaders = Object.entries(CORS_HEADERS).map(([header, value]) => ({ operation: chrome.declarativeNetRequest.HeaderOperation.SET, header, value }));
    const normalRule = { id: RULE_ID, priority: 1, action: { type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS, responseHeaders }, condition: { tabIds: Array.from(filteredEnabledTabs), urlFilter: "*", resourceTypes } };
    const rules = [normalRule];
    const preflightTabs = new Set();
    for (const tabId of enabledTabs) {
        try {
            const tab = await chrome.tabs.get(tabId);
            const domain = extractDomain(tab.url);
            if (domain && preflightEnabledDomains[domain] === true && !isExcludedCORSDomain(tab.url)) preflightTabs.add(tabId);
        } catch (err) { console.error("Error checking tab for preflight:", err); }
    }
    if (preflightTabs.size > 0) {
        const excludedDomains = ["youtube.com","google.com","gstatic.com","ytimg.com","googleapis.com","doubleclick.net","ggpht.com","googlevideo.com"];
        const preflightRule = { id: RULE_ID + 1, priority: 1, action: { type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS, responseHeaders }, condition: { tabIds: Array.from(preflightTabs), urlFilter: "*", resourceTypes, requestMethods: ["options"], excludedRequestDomains: excludedDomains } };
        rules.push(preflightRule);
    }
    await chrome.declarativeNetRequest.updateSessionRules({ addRules: rules });
}

function extractDomain(url) {
    if (!url) return "";
    try { const hostname = new URL(url).hostname; const parts = hostname.split("."); return parts.length > 2 ? parts.slice(-2).join(".") : hostname; } catch (e) { console.error("Error extracting domain:", e); return ""; }
}

function isProtectedDomain(url) {
    if (!url) return false;
    try { const hostname = new URL(url).hostname; if (hostname === "chrome.google.com") return true; if (url.startsWith("chrome://")) return true; if (url.startsWith("chrome-extension://")) return true; return false; } catch (e) { return false; }
}

function isExcludedCORSDomain(url) {
    if (!url) return false;
    try { const hostname = new URL(url).hostname.toLowerCase(); const excludedDomains = ["youtube.com","google.com","gstatic.com","ytimg.com","googleapis.com","doubleclick.net","ggpht.com","googlevideo.com"]; return excludedDomains.some(domain => hostname.includes(domain)); } catch (e) { return false; }
}

async function updateTabState(tabId, url) {
    const domain = extractDomain(url);
    if (!domain) return;
    if (isProtectedDomain(url)) return false;
    if (isExcludedCORSDomain(url)) {}
    const enabled = enabledDomains[domain] === true;
    updateIcon(tabId, domain);
    if (enabled) {
        enabledTabs.add(tabId);
        try { await chrome.scripting.executeScript({ target: { tabId }, files: ["content-script.js"] }); } catch (err) { console.error("Error injecting script:", err); }
    } else { enabledTabs.delete(tabId); }
    await setupDeclarativeRules();
    return enabled;
}

async function handleToggleCors(domain, enabled, remember) {
    try {
        if (remember) { enabled ? (enabledDomains[domain] = enabled) : delete enabledDomains[domain]; await chrome.storage.local.set({ enabledDomains }); }
        else if (enabledDomains[domain] !== undefined && !enabled) { delete enabledDomains[domain]; await chrome.storage.local.set({ enabledDomains }); }
        else if (enabled && !remember) enabledDomains[domain] = enabled;
        broadcastCorsStateChange(domain, enabled);
        const tabs = await chrome.tabs.query({});
        const affectedTabs = tabs.filter(tab => tab.url && extractDomain(tab.url) === domain);
        for (const tab of affectedTabs) {
            if (isProtectedDomain(tab.url)) continue;
            await updateTabState(tab.id, tab.url);
            try {
                const preflightEnabled = preflightEnabledDomains[domain] === true;
                await chrome.scripting.executeScript({ target: { tabId: tab.id }, function: (enabled, preflightEnabled) => { if (!enabled) { const notification = document.getElementById("ng-anti-cors-notification"); if (notification?.parentNode) notification.parentNode.removeChild(notification); } window.ngAntiCorsEnabled = enabled; window.ngAntiCorsPreflightEnabled = preflightEnabled; window.postMessage({ type: "NG_ANTI_CORS_STATUS", enabled, preflightEnabled }, "*"); }, args: [enabled, preflightEnabled] });
                if (!enabled) chrome.tabs.reload(tab.id);
            } catch (err) { console.error("Error updating CORS state:", err); if (!enabled) chrome.tabs.reload(tab.id); }
        }
        return true;
    } catch (err) { console.error("Error in handleToggleCors:", err); return false; }
}

function broadcastCorsStateChange(domain, enabled) {
    const preflightEnabled = preflightEnabledDomains[domain] === true;
    chrome.runtime.sendMessage({ action: "corsStateChanged", domain, enabled, preflightEnabled }).catch(err => { if (!err.message?.includes("Could not establish connection")) console.error("Error broadcasting CORS state change:", err); });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "toggleCors") { Promise.resolve(handleToggleCors(message.domain, message.enabled, message.remember)).then(result => sendResponse({ success: result })).catch(error => sendResponse({ success: false, error: error.message })); return true; }
    if (message.action === "togglePreflight") {
        const { domain, enabled, remember } = message;
        if (!domain) { sendResponse({ success: false, error: "Domain is required" }); return true; }
        if (enabled) preflightEnabledDomains[domain] = true; else delete preflightEnabledDomains[domain];
        chrome.tabs.query({}, async (tabs) => {
            const affectedTabs = tabs.filter(tab => tab.url && extractDomain(tab.url) === domain);
            await setupDeclarativeRules();
            for (const tab of affectedTabs) {
                if (isProtectedDomain(tab.url)) continue;
                try {
                    const isEnabled = enabledDomains[domain] === true;
                    await chrome.scripting.executeScript({ target: { tabId: tab.id }, function: (corsEnabled, preflightEnabled) => { window.ngAntiCorsEnabled = corsEnabled; window.ngAntiCorsPreflightEnabled = preflightEnabled; window.postMessage({ type: "NG_ANTI_CORS_STATUS", enabled: corsEnabled, preflightEnabled }, "*"); }, args: [isEnabled, enabled] });
                } catch (err) { console.error("Error updating preflight state:", err); }
            }
            chrome.runtime.sendMessage({ action: "corsStateChanged", domain, enabled: enabledDomains[domain] === true, preflightEnabled: enabled }).catch(err => { if (!err.message?.includes("Could not establish connection")) console.error("Error broadcasting preflight state change:", err); });
        });
        if (remember) {
            chrome.storage.local.set({ preflightEnabledDomains }).then(() => { console.log(`Preflight ${enabled ? "enabled" : "disabled"} for ${domain}`); sendResponse({ success: true }); }).catch(error => { console.error("Error saving preflight settings:", error); sendResponse({ success: false, error: error.message }); });
        } else sendResponse({ success: true });
        return true;
    }
    if (message.action === "getDomainState") {
        const domain = message.domain;
        if (domain) {
            const isEnabled = enabledDomains[domain] === true;
            const isPreflightEnabled = preflightEnabledDomains[domain] === true;
            chrome.storage.local.get(["enabledDomains","preflightEnabledDomains"], result => {
                const savedDomains = result.enabledDomains || {};
                const savedPreflightDomains = result.preflightEnabledDomains || {};
                const isPersistent = domain in savedDomains;
                const isPreflightPersistent = domain in savedPreflightDomains;
                sendResponse({ state: isEnabled, isPersistent, preflightEnabled: isPreflightEnabled, preflightPersistent: isPreflightPersistent });
            });
            return true;
        }
        sendResponse({ state: false, isPersistent: false, preflightEnabled: false, preflightPersistent: false });
        return true;
    }
    if (message.action === "settingsUpdated") { settings = { ...settings, ...message.settings }; chrome.storage.local.set({ settings }).then(() => sendResponse({ success: true })).catch(error => sendResponse({ success: false, error: error.message })); return true; }
    if (message.action === "getSettings") { sendResponse(settings); return true; }
    return false;
});

chrome.storage.local.get(["enabledDomains","preflightEnabledDomains","settings"], async result => {
    if (result && typeof result === "object") {
        if (result.enabledDomains) enabledDomains = result.enabledDomains;
        if (result.preflightEnabledDomains) preflightEnabledDomains = result.preflightEnabledDomains;
        if (result.settings) settings = { ...settings, ...result.settings };
    }
    chrome.tabs.query({}, async tabs => {
        for (const tab of tabs) {
            if (tab.url?.startsWith("http")) {
                if (isProtectedDomain(tab.url)) continue;
                await updateTabState(tab.id, tab.url);
            }
        }
    });
});

chrome.tabs.onRemoved.addListener(tabId => { if (enabledTabs.has(tabId)) { enabledTabs.delete(tabId); setupDeclarativeRules(); } });
chrome.tabs.onActivated.addListener(async activeInfo => { if (!activeInfo?.tabId) return; chrome.tabs.get(activeInfo.tabId, async tab => { if (tab?.url) await updateTabState(tab.id, tab.url); }); });
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => { if (changeInfo?.status === "complete" && tab?.url) updateTabState(tabId, tab.url).catch(err => console.error("Error updating tab state:", err)); });

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "FETCH_PROXY") {
        if (sender && sender.tab && sender.tab.id) {
            const tabId = sender.tab.id;
            if (!enabledTabs.has(tabId)) { sendResponse({ ok: false, error: "NG-Anti-CORS is disabled for this domain" }); return true; }
            const domain = extractDomain(sender.tab.url);
            const method = message.options?.method?.toUpperCase() || "GET";
            const advancedMethods = ["PUT","DELETE","OPTIONS","PATCH"];
            if (advancedMethods.includes(method) && domain && preflightEnabledDomains[domain] !== true) { sendResponse({ ok: false, error: `Advanced CORS method ${method} requires enabling preflight handling for this domain` }); return true; }
        }
        const { url, options } = message;
        fetch(url, options).then(async (response) => {
            const text = await response.text();
            const headers = {}; response.headers.forEach((value, key) => headers[key] = value);
            sendResponse({ ok: true, status: response.status, statusText: response.statusText, text, headers });
        }).catch(error => sendResponse({ ok: false, error: error.message }));
        return true;
    }
});
