let enabledDomains = {};
let enabledTabs = new Set();
let settings = { showNotification: true, notificationDuration: 5 };

function updateIcon(tabId, domain) {
    const enabled = domain && enabledDomains[domain];
    const iconName = enabled ? "icon-green" : "icon-red";
    const iconDetails = {
        path: {
            "16": `images/${iconName}-16.png`,
            "48": `images/${iconName}-48.png`,
            "128": `images/${iconName}-128.png`
        }
    };
    if (tabId) iconDetails.tabId = tabId;
    chrome.action.setIcon(iconDetails);
    const title = enabled ? `CORS allowed for ${domain}` : `CORS-behavior unchanged for ${domain}`;
    tabId ? chrome.action.setTitle({ tabId, title }) : chrome.action.setTitle({ title });
}

const RULE_ID = 1;

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, PUT, POST, DELETE, HEAD, OPTIONS, PATCH, PROPFIND, PROPPATCH, MKCOL, COPY, MOVE, LOCK, UNLOCK",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Max-Age": "7200",
    "Access-Control-Expose-Headers": "*",
    "Access-Control-Allow-Credentials": "true"
};

async function setupDeclarativeRules() {
    await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [RULE_ID] });
    if (enabledTabs.size === 0) return;
    const commonResourceTypes = [
        "xmlhttprequest", "websocket", "main_frame", "sub_frame", "stylesheet",
        "script", "image", "font", "object", "other"
    ];
    const responseHeaders = Object.entries(CORS_HEADERS).map(([header, value]) => ({
        operation: chrome.declarativeNetRequest.HeaderOperation.SET,
        header,
        value
    }));
    const rules = [{
        id: RULE_ID,
        priority: 1,
        action: { type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS, responseHeaders },
        condition: { tabIds: Array.from(enabledTabs), urlFilter: "*", resourceTypes: commonResourceTypes }
    }];
    try {
        await chrome.declarativeNetRequest.updateSessionRules({ addRules: rules });
        console.log("CORS rules updated successfully");
    } catch (error) {
        console.error("Failed to update CORS rules:", error);
    }
}

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

async function updateTabState(tabId, url) {
    const domain = extractDomain(url);
    if (!domain) return;
    const enabled = enabledDomains[domain] === true;
    updateIcon(tabId, domain);
    if (enabled) {
        enabledTabs.add(tabId);
        try {
            await chrome.scripting.executeScript({ target: { tabId }, files: ["content-script.js"] });
        } catch (err) {
            console.error("Error injecting script:", err);
        }
    } else {
        enabledTabs.delete(tabId);
    }
    await setupDeclarativeRules();
    return enabled;
}

async function handleToggleCors(domain, enabled, remember) {
    try {
        if (remember) {
            enabled ? (enabledDomains[domain] = enabled) : delete enabledDomains[domain];
            await chrome.storage.local.set({ enabledDomains });
        } else if (enabledDomains[domain] !== undefined && !enabled) {
            delete enabledDomains[domain];
            await chrome.storage.local.set({ enabledDomains });
        } else if (enabled && !remember) {
            enabledDomains[domain] = enabled;
        }
        const tabs = await chrome.tabs.query({});
        const affectedTabs = tabs.filter(tab => tab.url && extractDomain(tab.url) === domain);
        for (const tab of affectedTabs) {
            await updateTabState(tab.id, tab.url);
            if (!enabled) {
                try {
                    await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        function: () => {
                            const notification = document.getElementById("ng-anti-cors-notification");
                            if (notification?.parentNode) notification.parentNode.removeChild(notification);
                            delete window.ngAntiCorsActive;
                        }
                    });
                    chrome.tabs.reload(tab.id);
                } catch (err) {
                    console.error("Error cleaning up notifications:", err);
                    chrome.tabs.reload(tab.id);
                }
            }
        }
        return true;
    } catch (err) {
        console.error("Error in handleToggleCors:", err);
        return false;
    }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "toggleCors") {
        Promise.resolve(handleToggleCors(message.domain, message.enabled, message.remember))
            .then(result => sendResponse({ success: result }))
            .catch(error => { console.error("Error in toggleCors handler:", error); sendResponse({ success: false, error: error.message }); });
        return true;
    }
    if (message.action === "getDomainState") {
        const domain = message.domain;
        if (domain) {
            const isEnabled = enabledDomains[domain] === true;
            chrome.storage.local.get(["enabledDomains"], result => {
                const savedDomains = result.enabledDomains || {};
                const isPersistent = domain in savedDomains;
                console.log(`getDomainState for ${domain}: enabled=${isEnabled}, isPersistent=${isPersistent}`);
                sendResponse({ state: isEnabled, isPersistent });
            });
            return true;
        }
        sendResponse({ state: false, isPersistent: false });
        return true;
    }
    if (message.action === "settingsUpdated") {
        settings = { ...settings, ...message.settings };
        chrome.storage.local.set({ settings })
            .then(() => sendResponse({ success: true }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
    }
    if (message.action === "getSettings") { sendResponse(settings); return true; }
    return false;
});

chrome.storage.local.get(["enabledDomains", "settings"], async result => {
    if (result && typeof result === "object") {
        if (result.enabledDomains) { enabledDomains = result.enabledDomains; console.log("Loaded enabled domains from storage:", enabledDomains); }
        if (result.settings) { settings = { ...settings, ...result.settings }; console.log("Loaded settings from storage:", settings); }
    } else {
        console.log("No storage data found or invalid format, using defaults");
    }
    chrome.tabs.query({}, async tabs => {
        console.log(`Initializing ${tabs.length} open tabs`);
        for (const tab of tabs) {
            if (tab.url?.startsWith("http")) {
                const enabled = await updateTabState(tab.id, tab.url);
                console.log(`Initialized tab ${tab.id} (${extractDomain(tab.url)}): CORS ${enabled ? "enabled" : "disabled"}`);
            }
        }
    });
});

chrome.tabs.onRemoved.addListener(tabId => {
    if (enabledTabs.has(tabId)) { enabledTabs.delete(tabId); setupDeclarativeRules(); }
});

chrome.tabs.onActivated.addListener(async activeInfo => {
    if (!activeInfo?.tabId) return;
    chrome.tabs.get(activeInfo.tabId, async tab => {
        if (tab?.url) {
            try { await updateTabState(tab.id, tab.url); } catch (err) { console.error("Error updating tab state:", err); }
        }
    });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo?.status === "complete" && tab?.url) {
        try { updateTabState(tabId, tab.url); } catch (err) { console.error("Error updating tab state on tab update:", err); }
    }
});
