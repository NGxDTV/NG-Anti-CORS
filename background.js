


let enabledDomains = {};
let enabledTabs = new Set();
let settings = {
    showNotification: true,
    notificationDuration: 5
};

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

    if (tabId) {
        iconDetails.tabId = tabId;
    }

    chrome.action.setIcon(iconDetails);

    const title = enabled ?
        `CORS Blocker is ON for ${domain}` :
        `CORS Blocker is OFF for ${domain}`;

    if (tabId) {
        chrome.action.setTitle({ tabId, title });
    } else {
        chrome.action.setTitle({ title });
    }
}

const RULE_ID = 1;
const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, PUT, POST, DELETE, HEAD, OPTIONS, PATCH",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Allow-Credentials": "true"
};

async function setupDeclarativeRules() {
    await chrome.declarativeNetRequest.updateSessionRules({
        removeRuleIds: [RULE_ID]
    });

    if (enabledTabs.size > 0) {
        const responseHeaders = Object.entries(CORS_HEADERS).map(([name, value]) => ({
            operation: chrome.declarativeNetRequest.HeaderOperation.SET,
            header: name,
            value
        }));

        await chrome.declarativeNetRequest.updateSessionRules({
            addRules: [{
                id: RULE_ID,
                priority: 1,
                action: {
                    type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
                    responseHeaders
                },
                condition: {
                    urlFilter: "*",
                    resourceTypes: [
                        "xmlhttprequest",
                        "websocket",
                        "main_frame",
                        "sub_frame",
                        "stylesheet",
                        "script",
                        "image",
                        "font",
                        "object",
                        "other",
                        "media",
                        "ping"
                    ]
                }
            }]
        });
    }
}

function extractDomain(url) {
    if (!url) return '';

    try {
        const hostname = new URL(url).hostname;

        const parts = hostname.split('.');
        if (parts.length > 2) {
            return parts.slice(-2).join('.');
        }

        return hostname;
    } catch (e) {
        console.error('Error extracting domain:', e);

        return '';
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
            await chrome.scripting.executeScript({
                target: { tabId },
                files: ['content-script.js']
            });
        } catch (err) {
            console.error("Error injecting script: ", err);
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
            enabledDomains[domain] = enabled;
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
                            if (notification && notification.parentNode) {
                                notification.parentNode.removeChild(notification);
                            }

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

    if (message.action === 'toggleCors') {

        Promise.resolve(handleToggleCors(message.domain, message.enabled, message.remember))
            .then(result => {
                sendResponse({ success: result });
            })
            .catch(error => {
                console.error("Error in toggleCors handler:", error);
                sendResponse({ success: false, error: error.message });
            });
        return true;
    }

    if (message.action === 'getDomainState') {
        const domain = message.domain;
        if (domain) {

            const isEnabled = enabledDomains[domain] === true;

            chrome.storage.local.get(['enabledDomains'], (result) => {
                const savedDomains = result.enabledDomains || {};
                const isPersistent = domain in savedDomains;

                console.log(`getDomainState for ${domain}: enabled=${isEnabled}, isPersistent=${isPersistent}`);

                sendResponse({
                    state: isEnabled,
                    isPersistent: isPersistent
                });
            });
            return true;
        }
        sendResponse({ state: false, isPersistent: false });
        return true;
    }

    if (message.action === 'settingsUpdated') {
        settings = { ...settings, ...message.settings };
        chrome.storage.local.set({ settings })
            .then(() => sendResponse({ success: true }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
    }

    if (message.action === 'getSettings') {
        sendResponse(settings);
        return true;
    }

    return false;
});


chrome.storage.local.get(["enabledDomains", "settings"], async (result) => {
    if (result.hasOwnProperty("enabledDomains")) {
        enabledDomains = result.enabledDomains;
        console.log("Loaded enabled domains from storage:", enabledDomains);
    }

    if (result.hasOwnProperty("settings")) {
        settings = { ...settings, ...result.settings };
        console.log("Loaded settings from storage:", settings);
    }

    chrome.tabs.query({}, async (tabs) => {
        console.log(`Initializing ${tabs.length} open tabs`);
        for (const tab of tabs) {
            if (tab.url && tab.url.startsWith('http')) {
                const domain = extractDomain(tab.url);
                const enabled = await updateTabState(tab.id, tab.url);
                console.log(`Initialized tab ${tab.id} (${domain}): CORS ${enabled ? 'enabled' : 'disabled'}`);
            }
        }
    });
});

chrome.tabs.onRemoved.addListener((tabId) => {
    if (enabledTabs.has(tabId)) {
        enabledTabs.delete(tabId);
        setupDeclarativeRules();
    }
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
    chrome.tabs.get(activeInfo.tabId, async (tab) => {
        if (tab && tab.url) {
            await updateTabState(tab.id, tab.url);
        }
    });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        updateTabState(tabId, tab.url);
    }
});
