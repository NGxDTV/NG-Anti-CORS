if (typeof window.__ngAntiCorsInjected === "undefined") {
    window.__ngAntiCorsInjected = true;
    window.__ngAntiCorsEnabled = false;
    window.__ngAntiCorsPreflightEnabled = false;

    const originalFetch = window.fetch;
    const originalXhrOpen = XMLHttpRequest.prototype.open;
    const originalXhrSend = XMLHttpRequest.prototype.send;

    window.addEventListener("message", (event) => {
        if (event.source === window && event.data?.type === "NG_ANTI_CORS_STATUS") {
            const oldStatus = window.__ngAntiCorsEnabled;
            const oldPreflightStatus = window.__ngAntiCorsPreflightEnabled;
            
            window.__ngAntiCorsEnabled = event.data.enabled === true;
            window.__ngAntiCorsPreflightEnabled = event.data.preflightEnabled === true;
            
            if (oldStatus !== window.__ngAntiCorsEnabled || oldPreflightStatus !== window.__ngAntiCorsPreflightEnabled) {
                const enabledText = window.__ngAntiCorsEnabled ? "enabled" : "disabled";
                const preflightText = window.__ngAntiCorsPreflightEnabled ? "enabled" : "disabled";
                console.log(`%c NG-Anti-CORS %c ${enabledText.toUpperCase()} %c Preflight: %c ${preflightText.toUpperCase()} `, "background: #333; color: white; font-weight: bold;", window.__ngAntiCorsEnabled ? "background: green; color: white;" : "background: red; color: white;", "background: #333; color: white; font-weight: bold;", window.__ngAntiCorsPreflightEnabled ? "background: green; color: white;" : "background: orange; color: white;");
                if (window.__ngAntiCorsEnabled) console.log(`%c Basic CORS %c ${window.__ngAntiCorsEnabled ? "✓" : "✗"} Methods: GET, POST, HEAD %c Advanced CORS %c ${window.__ngAntiCorsPreflightEnabled ? "✓" : "✗"} Methods: PATCH, PUT, DELETE, etc.`, "font-weight: bold;", window.__ngAntiCorsEnabled ? "color: green;" : "color: red;", "font-weight: bold;", window.__ngAntiCorsPreflightEnabled ? "color: green;" : "color: orange;");
                window.postMessage({ type: "NG_ANTI_CORS_STATUS_UPDATED", enabled: window.__ngAntiCorsEnabled, preflightEnabled: window.__ngAntiCorsPreflightEnabled }, "*");
            }
        }
    });

    function shouldInterceptRequest(method, url, init) {
        const basicMethods = ["GET", "POST", "HEAD", "PUT"];
        method = (method || "GET").toUpperCase();
        if (!window.__ngAntiCorsEnabled) return false;

        try {
            const requestUrl = new URL(url, window.location.href);
            if (requestUrl.origin === window.location.origin) return false;
            const host = requestUrl.hostname.toLowerCase();
            if (host.includes("youtube.com") || host.includes("google.com") || host.includes("gstatic.com") || host.includes("ytimg.com") || host.includes("googleapis.com") || host.includes("doubleclick.net") || host.includes("ggpht.com") || host.includes("googlevideo.com")) return false;
        } catch (e) { return false; }
        
        if (init) {
            if ((init.credentials === "include" || init.credentials === "same-origin") && !window.__ngAntiCorsPreflightEnabled) return false;
            if (init.headers && !window.__ngAntiCorsPreflightEnabled) {
                const headers = init.headers;
                if (headers instanceof Headers) {
                    let hasCustomHeaders = false;
                    headers.forEach((value, key) => { if (!["accept", "accept-language", "content-language", "content-type"].includes(key.toLowerCase())) hasCustomHeaders = true; });
                    if (hasCustomHeaders) return false;
                }
            }
            if (init.mode === "no-cors") return false;
        }
        if (basicMethods.includes(method)) return true;

        const advancedMethods = ["DELETE", "OPTIONS", "PATCH", "PROPFIND", "PROPPATCH", "MKCOL", "COPY", "MOVE", "LOCK", "UNLOCK"];
        
        if (advancedMethods.includes(method)) return window.__ngAntiCorsPreflightEnabled;
        return false;
    }

    window.fetch = function (input, init = {}) {
        let method = init?.method || "GET";
        let url = input;

        if (typeof input === "object" && input instanceof Request) {
            url = input.url;
            if (!init.method && input.method) method = input.method;
        }

        try {
            const urlObj = new URL(url, window.location.href);
            const host = urlObj.hostname.toLowerCase();
            if (host.includes("youtube.com") || host.includes("google.com") || host.includes("gstatic.com") || host.includes("ytimg.com") || host.includes("googleapis.com") || host.includes("doubleclick.net") || host.includes("ggpht.com")) return originalFetch.apply(this, arguments);
        } catch (e) { }
        
        if (!shouldInterceptRequest(method, url, init)) return originalFetch.apply(this, arguments);
        if (init && ((init.mode && init.mode !== "cors") || init.referrerPolicy === "no-referrer" || (typeof input === "object" && input.mode && input.mode !== "cors") || init.cache === "only-if-cached")) return originalFetch.apply(this, arguments);
        
        const id = Math.random().toString(36).substr(2);
        const message = { type: "FETCH_REQUEST", id, url: input, options: init };

        return new Promise((resolve, reject) => {
            function handleResponse(event) {
                if (event.data?.type === "FETCH_RESPONSE" && event.data.id === id) {
                    window.removeEventListener("message", handleResponse);

                    if (event.data.ok) {
                        const responseInit = { status: event.data.status, statusText: event.data.statusText, headers: event.data.headers || {} };
                        const status = event.data.status;
                        const noBodyStatuses = [204, 205, 304];
                        
                        if (noBodyStatuses.includes(status)) resolve(new Response(null, responseInit));
                        else resolve(new Response(event.data.text, responseInit));
                    } else reject(new Error(event.data.error || "Fetch proxy failed"));
                }
            }
            window.addEventListener("message", handleResponse);
            window.postMessage(message, "*");
        });
    };

    XMLHttpRequest.prototype.open = function (method, url, async = true, user, password) {
        this._ngAntiCorsMethod = method;
        this._ngAntiCorsUrl = url;
        this._ngAntiCorsAsync = async !== false;
        this._ngAntiCorsUser = user;
        this._ngAntiCorsPassword = password;
        originalXhrOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function (body) {
        if (!this._ngAntiCorsUrl || !this._ngAntiCorsUrl.includes("://") || this._ngAntiCorsUrl.startsWith(window.location.origin) || !shouldInterceptRequest(this._ngAntiCorsMethod, this._ngAntiCorsUrl)) return originalXhrSend.apply(this, arguments);
        
        try {
            const urlObj = new URL(this._ngAntiCorsUrl);
            const host = urlObj.hostname.toLowerCase();
            if (host.includes("youtube.com") || host.includes("google.com") || host.includes("gstatic.com") || host.includes("ytimg.com") || host.includes("googleapis.com") || host.includes("doubleclick.net") || host.includes("ggpht.com")) return originalXhrSend.apply(this, arguments);
        } catch (e) { }

        try {
            if (this.withCredentials === true) return originalXhrSend.apply(this, arguments);
            const corsHeaders = ["x-requested-with", "authorization", "origin"];
            let hasCustomCorsHeaders = false;
            for (const header of corsHeaders) {
                try { if (this.getRequestHeader && this.getRequestHeader(header)) { hasCustomCorsHeaders = true; break; } } catch (e) { }
            }
            if (hasCustomCorsHeaders) return originalXhrSend.apply(this, arguments);
        } catch (e) { }

        const id = Math.random().toString(36).substr(2);
        const xhr = this;
        const options = { method: this._ngAntiCorsMethod, headers: {}, body };

        if (xhr.getAllResponseHeaders) {
            try {
                for (let i = 0; i < xhr.getAllResponseHeaders().length; i++) {
                    const header = xhr.getAllResponseHeaders()[i];
                    if (header && header.name) options.headers[header.name] = header.value;
                }
            } catch (err) { console.warn("Unable to copy XHR headers:", err); }
        }

        const message = { type: "FETCH_REQUEST", id, url: this._ngAntiCorsUrl, options };
        function handleResponse(event) {
            if (event.data?.type === "FETCH_RESPONSE" && event.data.id === id) {
                window.removeEventListener("message", handleResponse);
                if (event.data.ok) {
                    xhr.responseText = event.data.text;
                    xhr.response = event.data.text;
                    xhr.status = event.data.status;
                    xhr.statusText = event.data.statusText;
                    xhr.dispatchEvent(new Event("load"));
                    xhr.dispatchEvent(new Event("loadend"));
                } else {
                    xhr.dispatchEvent(new Event("error"));
                    xhr.dispatchEvent(new Event("loadend"));
                }
            }
        }
        window.addEventListener("message", handleResponse);
        window.postMessage(message, "*");
    };

    window.postMessage({ type: "NG_ANTI_CORS_READY" }, "*");
}
