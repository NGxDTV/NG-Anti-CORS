

console.log("NG-Anti-CORS active: CORS-Requests allowed for this domain");

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

        if (!settings || !settings.showNotification) {
            return;
        }

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

        notification.addEventListener("mouseover", () => {
            notification.style.opacity = "1";
        });
        notification.addEventListener("mouseout", () => {
            notification.style.opacity = "0.8";
        });

        function appendNotification() {
            if (document.body) {
                document.body.appendChild(notification);
                window.ngAntiCorsNotification = notification;

                const duration = (settings.notificationDuration || 5) * 1000;
                setTimeout(() => {
                    try {
                        if (notification.parentNode) {
                            notification.parentNode.removeChild(notification);
                        }
                    } catch (e) {
                        console.error("Error removing notification:", e);
                    }
                    window.ngAntiCorsNotification = null;
                }, duration);
            } else {
                setTimeout(appendNotification, 100);
            }
        }

        appendNotification();
    }

    chrome.runtime.sendMessage({ action: "getSettings" }, (settings) => {
        if (!settings) {
            settings = { showNotification: true, notificationDuration: 5 };
        }

        try {
            const domain = window.location.hostname || 'unknown';
            showNotification(domain, settings);
        } catch (error) {
            console.error("Error showing notification:", error);
        }
    });

    chrome.runtime.onMessage.addListener((message) => {
        if (message.action === "settingsChanged") {
            const settings = message.settings;

        }
        if (message.action === "corsDisabled") {
            removeExistingNotification();
        }
        return false;
    });
}
