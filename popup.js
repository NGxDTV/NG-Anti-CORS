document.addEventListener('DOMContentLoaded', init);

let currentDomain = '';
let enabledDomains = {};
let settings = {
    showNotification: true,
    notificationDuration: 5
};

async function loadSettings() {
    const result = await chrome.storage.local.get(['enabledDomains', 'settings']);

    if (result && result.enabledDomains && typeof result.enabledDomains === 'object') {
        enabledDomains = result.enabledDomains || {};
    } else {
        enabledDomains = {};
    }
    try {
        const tabs = await chrome.tabs.query({});
        for (const tab of tabs) {
            if (tab && tab.url) {
                const domain = extractDomain(tab.url);
                if (domain && enabledDomains && typeof enabledDomains === 'object' && !enabledDomains.hasOwnProperty(domain)) {
                    const response = await new Promise((resolve) => {
                        chrome.runtime.sendMessage({ action: 'getDomainState', domain }, resolve);
                    });

                    if (response && response.state) {

                        enabledDomains[domain] = true;
                        console.log(`Added temporary domain to cache: ${domain}`);
                    }
                }
            }
        }
    } catch (err) {
        console.error('Error loading temporary domains:', err);
    }

    if (result.settings) {
        settings = { ...settings, ...result.settings };
    }

    const showNotification = document.getElementById('show-notification');
    const notificationDuration = document.getElementById('notification-duration');

    if (showNotification) showNotification.checked = settings.showNotification;
    if (notificationDuration) notificationDuration.value = settings.notificationDuration;
}

function setupTabs() {
    const tabs = document.querySelectorAll('.tab');
    const contents = document.querySelectorAll('.tab-content');

    if (!tabs || !contents) return;

    tabs.forEach(tab => {
        if (!tab) return;
        tab.addEventListener('click', () => {
            tabs.forEach(t => {
                if (t) t.classList.remove('active');
            });
            contents.forEach(c => {
                if (c) c.classList.remove('active');
            });

            tab.classList.add('active');

            if (tab.id) {
                const contentId = `content-${tab.id.split('-')[1]}`;
                const contentElement = document.getElementById(contentId);
                if (contentElement) {
                    contentElement.classList.add('active');
                }
            }
        });
    });
}

function updateToggleStatus(enabled) {
    const statusElement = document.getElementById('toggle-status');
    if (statusElement) {
        statusElement.textContent = enabled ? 'CORS requests are ALLOWED for this domain' : 'Browser CORS behavior unchanged';
        statusElement.className = enabled ? 'status-green' : 'status-red';
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

async function init() {
    await loadSettings();
    setupTabs();

    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs && tabs.length > 0) {
        const activeTab = tabs[0];
        if (activeTab && activeTab.url) {
            currentDomain = extractDomain(activeTab.url);
        }

        if (currentDomain) {
            const domainElement = document.getElementById('current-domain');
            if (domainElement) {
                domainElement.textContent = currentDomain;

                const response = await new Promise((resolve) => {
                    chrome.runtime.sendMessage({ action: 'getDomainState', domain: currentDomain }, resolve);
                });

                const toggle = document.getElementById('cors-toggle');
                const rememberSetting = document.getElementById('remember-setting');

                if (!toggle) return; if (response && response.state !== undefined) {
                    toggle.checked = response.state;

                    if (response.isPersistent) {
                        enabledDomains[currentDomain] = response.state;
                    }

                    if (rememberSetting) rememberSetting.checked = response.isPersistent;

                    const preflightToggle = document.getElementById('preflight-toggle');
                    const preflightOption = document.querySelector('.preflight-option');

                    if (preflightToggle && preflightOption) {
                        preflightOption.style.display = response.state ? 'block' : 'none';
                        preflightToggle.checked = response.preflightEnabled || false;
                        preflightToggle.disabled = !response.state;

                        const helpText = document.querySelector('.preflight-option .help-text');
                        if (helpText) {
                            helpText.innerHTML =
                                'Enable this option for advanced CORS methods like PATCH,<br>DELETE, OPTIONS, etc.<br>' +
                                '<span style="display: block; margin-top: 5px; font-style: italic;">' +
                                '• Basic (Current): GET, POST, HEAD<br>' +
                                '• Advanced (With Preflight): All methods including<br>PATCH, DELETE, OPTIONS, CREDENTIAL,<br>CREDENTIALWHEADERS and more.</span>';
                        }

                        preflightToggle.addEventListener('change', async function () {
                            const enabled = this.checked;
                            const remember = document.getElementById('remember-setting').checked;

                            try {
                                await new Promise((resolve) => {
                                    chrome.runtime.sendMessage({
                                        action: 'togglePreflight',
                                        domain: currentDomain,
                                        enabled: enabled,
                                        remember: remember
                                    }, resolve);
                                });

                                console.log(`Preflight ${enabled ? 'enabled' : 'disabled'} for ${currentDomain}`);
                            } catch (error) {
                                console.error('Error toggling preflight:', error);
                                preflightToggle.checked = !enabled;
                            }
                        });
                    }
                } else {
                    toggle.checked = enabledDomains[currentDomain] || false;
                    if (rememberSetting) rememberSetting.checked = enabledDomains[currentDomain] !== undefined;
                }

                updateToggleStatus(toggle.checked);

                toggle.addEventListener('change', toggleCorsBlocking);

                const rememberCheckbox = document.getElementById('remember-setting');
                if (rememberCheckbox) {
                    rememberCheckbox.addEventListener('change', async function () {
                        const remember = this.checked;
                        const isEnabled = toggle.checked;

                        if (isEnabled) {
                            const response = await new Promise((resolve) => {
                                chrome.runtime.sendMessage({
                                    action: 'toggleCors',
                                    domain: currentDomain,
                                    enabled: isEnabled,
                                    remember: remember
                                }, resolve);
                            });

                            if (response && response.success) {
                                if (remember) {
                                    enabledDomains[currentDomain] = isEnabled;
                                } else {
                                    chrome.storage.local.get(['enabledDomains'], async (result) => {
                                        const savedDomains = result.enabledDomains || {};
                                        if (savedDomains[currentDomain] !== undefined) {
                                            delete savedDomains[currentDomain];
                                            await chrome.storage.local.set({ enabledDomains: savedDomains });
                                        }
                                    });
                                }

                                populateDomainsList();
                            }
                        }
                    });
                }
            }

            populateDomainsList();
            setupSettingsForm();

            const saveSettingsButton = document.getElementById('save-settings');
            if (saveSettingsButton) {
                saveSettingsButton.addEventListener('click', saveSettings);
            }
        }
    }
}

async function toggleCorsBlocking() {
    const enabled = this.checked;
    const remember = document.getElementById('remember-setting').checked;
    const toggle = document.getElementById('cors-toggle');

    toggle.disabled = true;
    updateToggleStatus(enabled);

    try {
        const response = await new Promise((resolve) => {
            chrome.runtime.sendMessage({
                action: 'toggleCors',
                domain: currentDomain,
                enabled: enabled,
                remember: remember
            }, resolve);
        });

        if (!response || !response.success) {
            console.error('Failed to toggle CORS blocking:', response?.error);

            toggle.checked = !enabled;
            updateToggleStatus(!enabled);
        } else {
            console.log('CORS blocking toggled successfully');

            if (enabled) {
                enabledDomains[currentDomain] = enabled;
            } else {
                delete enabledDomains[currentDomain];
            }

            const preflightToggle = document.getElementById('preflight-toggle');
            const preflightOption = document.querySelector('.preflight-option');

            if (preflightToggle && preflightOption) {
                preflightOption.style.display = enabled ? 'block' : 'none';
                preflightToggle.disabled = !enabled;

                if (!enabled) {
                    preflightToggle.checked = false;
                    chrome.runtime.sendMessage({
                        action: 'togglePreflight',
                        domain: currentDomain,
                        enabled: false,
                        remember: remember
                    });
                }
            }

            populateDomainsList();
        }
    } catch (error) {
        console.error('Error toggling CORS blocking:', error);

        toggle.checked = !enabled;
        updateToggleStatus(!enabled);
    } finally {
        toggle.disabled = false;
    }
}

async function populateDomainsList() {
    const domainsList = document.getElementById('domains-list');
    if (!domainsList) return;

    domainsList.innerHTML = '';

    try {
        const storageResult = await chrome.storage.local.get(['enabledDomains']);
        const savedDomains = storageResult && storageResult.enabledDomains ? storageResult.enabledDomains : {};
        const tabs = await chrome.tabs.query({});
        const activeDomains = new Set();
        for (const tab of tabs) {
            if (tab && tab.url) {
                const domain = extractDomain(tab.url);
                if (domain) {
                    activeDomains.add(domain);
                }
            }
        }

        const allDomains = { ...savedDomains };

        for (const domain of activeDomains) {

            if (savedDomains[domain] !== undefined) continue;

            const response = await new Promise((resolve) => {
                chrome.runtime.sendMessage({ action: 'getDomainState', domain }, resolve);
            });

            if (response && response.state === true) {
                allDomains[domain] = true;
            }
        }

        for (const domain in enabledDomains) {
            if (!allDomains.hasOwnProperty(domain)) {
                allDomains[domain] = enabledDomains[domain];
            }
        }

        const domains = Object.keys(allDomains);

        if (domains.length === 0) {
            const row = document.createElement('tr');
            row.innerHTML = '<td colspan="3" style="text-align: center;">No domains configured</td>';
            domainsList.appendChild(row);
            return;
        }

        domains.sort();

        for (const domain of domains) {
            const enabled = allDomains[domain];
            const isPersisted = domain in savedDomains;

            const row = document.createElement('tr');

            const domainCell = document.createElement('td');
            domainCell.textContent = domain;
            row.appendChild(domainCell);

            const startupCell = document.createElement('td');
            const startupCheckbox = document.createElement('input');
            startupCheckbox.type = 'checkbox';
            startupCheckbox.checked = isPersisted && enabled;
            startupCheckbox.addEventListener('change', async function () {
                if (this.checked) {
                    savedDomains[domain] = true;
                    await chrome.storage.local.set({ enabledDomains: savedDomains });

                    enabledDomains[domain] = true;

                    if (domain === currentDomain) {
                        document.getElementById('remember-setting').checked = true;
                    }
                } else {

                    delete savedDomains[domain];
                    await chrome.storage.local.set({ enabledDomains: savedDomains });

                    if (domain === currentDomain) {
                        document.getElementById('remember-setting').checked = false;
                    }
                }
            });
            startupCell.appendChild(startupCheckbox);
            row.appendChild(startupCell);

            const actionsCell = document.createElement('td');
            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = 'Delete';
            deleteBtn.className = 'delete-domain';
            deleteBtn.addEventListener('click', async function () {
                delete savedDomains[domain];
                delete enabledDomains[domain];
                await chrome.storage.local.set({ enabledDomains: savedDomains });

                chrome.runtime.sendMessage({
                    action: 'toggleCors',
                    domain: domain,
                    enabled: false,
                    remember: false
                });

                row.remove();

                if (domain === currentDomain) {
                    document.getElementById('cors-toggle').checked = false;
                    document.getElementById('remember-setting').checked = false;
                    updateToggleStatus(false);
                }

                if (Object.keys(allDomains).length <= 1) {
                    populateDomainsList();
                }
            });
            actionsCell.appendChild(deleteBtn);
            row.appendChild(actionsCell);

            domainsList.appendChild(row);
        }
    } catch (error) {
        console.error('Error populating domains list:', error);
        domainsList.innerHTML = '<tr><td colspan="3" style="text-align: center;">Error loading domains</td></tr>';
    }
}

function setupSettingsForm() {
    document.getElementById('show-notification').checked = settings.showNotification;
    document.getElementById('notification-duration').value = settings.notificationDuration;
}

async function saveSettings() {
    settings.showNotification = document.getElementById('show-notification').checked;
    settings.notificationDuration = parseInt(document.getElementById('notification-duration').value, 10);

    await chrome.storage.local.set({ settings });

    await chrome.runtime.sendMessage({
        action: 'settingsUpdated',
        settings: settings
    });

    const saveBtn = document.getElementById('save-settings');
    const originalText = saveBtn.textContent;
    saveBtn.textContent = 'Saved!';
    saveBtn.disabled = true;

    setTimeout(() => {
        saveBtn.textContent = originalText;
        saveBtn.disabled = false;
    }, 1500);
}

chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "corsStateChanged" && message.domain === currentDomain) {
        updateToggleStatus(message.enabled);
        const toggle = document.getElementById('cors-toggle');
        if (toggle) toggle.checked = message.enabled;
        const preflightToggle = document.getElementById('preflight-toggle');
        const preflightOption = document.querySelector('.preflight-option');

        if (preflightToggle && preflightOption) {
            preflightOption.style.display = message.enabled ? 'block' : 'none';
            preflightToggle.disabled = !message.enabled;

            if (!message.enabled) {
                preflightToggle.checked = false;
            } else if (message.preflightEnabled !== undefined) {
                preflightToggle.checked = message.preflightEnabled;
            }
        }
    }
    return false;
});
