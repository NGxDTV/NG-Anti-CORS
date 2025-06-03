if (typeof window.__ngAntiCorsInjected === 'undefined') {
    window.__ngAntiCorsInjected = true;
    window.__ngAntiCorsEnabled = false;
    window.__ngAntiCorsPreflightEnabled = false;

    // Store original methods
    const originalFetch = window.fetch;
    const originalXhrOpen = XMLHttpRequest.prototype.open;
    const originalXhrSend = XMLHttpRequest.prototype.send;

    // Create a communication channel with the content script
    window.addEventListener('message', (event) => {
        if (event.source === window && event.data?.type === 'NG_ANTI_CORS_STATUS') {
            const oldStatus = window.__ngAntiCorsEnabled;
            const oldPreflightStatus = window.__ngAntiCorsPreflightEnabled;

            window.__ngAntiCorsEnabled = event.data.enabled === true;
            window.__ngAntiCorsPreflightEnabled = event.data.preflightEnabled === true;
            if (oldStatus !== window.__ngAntiCorsEnabled || oldPreflightStatus !== window.__ngAntiCorsPreflightEnabled) {
                const enabledText = window.__ngAntiCorsEnabled ? 'enabled' : 'disabled';
                const preflightText = window.__ngAntiCorsPreflightEnabled ? 'enabled' : 'disabled';

                console.log(
                    `%c NG-Anti-CORS %c ${enabledText.toUpperCase()} %c Preflight: %c ${preflightText.toUpperCase()} `,
                    'background: #333; color: white; font-weight: bold;',
                    window.__ngAntiCorsEnabled ? 'background: green; color: white;' : 'background: red; color: white;',
                    'background: #333; color: white; font-weight: bold;',
                    window.__ngAntiCorsPreflightEnabled ? 'background: green; color: white;' : 'background: orange; color: white;'
                );

                if (window.__ngAntiCorsEnabled) {
                    console.log(
                        `%c Basic CORS %c ${window.__ngAntiCorsEnabled ? '✓' : '✗'} Methods: GET, POST, HEAD %c Advanced CORS %c ${window.__ngAntiCorsPreflightEnabled ? '✓' : '✗'} Methods: PATCH, PUT, DELETE, etc.`,
                        'font-weight: bold;',
                        window.__ngAntiCorsEnabled ? 'color: green;' : 'color: red;',
                        'font-weight: bold;',
                        window.__ngAntiCorsPreflightEnabled ? 'color: green;' : 'color: orange;'
                    );
                }

                // Send confirmation back to content script
                window.postMessage({
                    type: 'NG_ANTI_CORS_STATUS_UPDATED',
                    enabled: window.__ngAntiCorsEnabled,
                    preflightEnabled: window.__ngAntiCorsPreflightEnabled
                }, '*');
            }
        }
    });
    
    function shouldInterceptRequest(method, url, init) {
        const basicMethods = ['GET', 'POST', 'HEAD', 'PUT'];
        method = (method || 'GET').toUpperCase();

        if (!window.__ngAntiCorsEnabled) {
            return false;
        }
        
        // Only intercept cross-origin requests, not same-origin requests
        try {
            const requestUrl = new URL(url, window.location.href);
            
            // If the request is to the same origin, don't intercept it
            if (requestUrl.origin === window.location.origin) {
                return false;
            }
            
            // Don't intercept requests to YouTube, Google or similar domains
            const host = requestUrl.hostname.toLowerCase();
            if (host.includes('youtube.com') || 
                host.includes('google.com') || 
                host.includes('gstatic.com') || 
                host.includes('ytimg.com') || 
                host.includes('googleapis.com') ||
                host.includes('doubleclick.net') ||
                host.includes('ggpht.com') ||
                host.includes('googlevideo.com')) {
                console.log('NG-Anti-CORS: Not intercepting request to excluded domain:', host);
                return false;
            }
        } catch (e) {
            // If we can't parse the URL, assume it's relative and don't intercept
            return false;
        }

        if (init) {
            if ((init.credentials === 'include' || init.credentials === 'same-origin') &&
                !window.__ngAntiCorsPreflightEnabled) {
                return false;
            }

            if (init.headers && !window.__ngAntiCorsPreflightEnabled) {
                const headers = init.headers;
                if (headers instanceof Headers) {
                    let hasCustomHeaders = false;
                    headers.forEach((value, key) => {
                        if (!['accept', 'accept-language', 'content-language', 'content-type'].includes(key.toLowerCase())) {
                            hasCustomHeaders = true;
                        }
                    });
                    if (hasCustomHeaders) {
                        return false;
                    }
                }
            }
            
            // Don't intercept requests that already have CORS headers set by the application
            // This ensures we don't break existing working CORS setups
            if (init.mode === 'no-cors') {
                return false; // Application is already handling CORS in a specific way
            }
        }

        if (basicMethods.includes(method)) {
            return true;
        }

        const advancedMethods = ['DELETE', 'OPTIONS', 'PATCH', 'PROPFIND', 'PROPPATCH', 'MKCOL', 'COPY', 'MOVE', 'LOCK', 'UNLOCK'];
        if (advancedMethods.includes(method)) {
            return window.__ngAntiCorsPreflightEnabled;
        }

        return false;
    }
    
    window.fetch = function (input, init = {}) {
        const method = init?.method || 'GET';
        let url = input;
        
        // Handle Request object input
        if (typeof input === 'object' && input instanceof Request) {
            url = input.url;
            if (!init.method && input.method) {
                method = input.method;
            }
        }

        // Check if this is a Google or YouTube domain request
        // YouTube has special CORS handling that we shouldn't interfere with
        try {
            const urlObj = new URL(url, window.location.href);
            const host = urlObj.hostname.toLowerCase();
            if (host.includes('youtube.com') || 
                host.includes('google.com') || 
                host.includes('gstatic.com') || 
                host.includes('ytimg.com') || 
                host.includes('googleapis.com') ||
                host.includes('doubleclick.net') ||
                host.includes('ggpht.com')) {
                // Don't intercept requests to Google/YouTube domains as they have their own CORS setup
                return originalFetch.apply(this, arguments);
            }
        } catch (e) {
            // If URL parsing fails, just continue
        }

        // Don't intercept if shouldInterceptRequest says we shouldn't
        if (!shouldInterceptRequest(method, url, init)) {
            return originalFetch.apply(this, arguments);
        }
        
        // Checks for existing CORS configurations
        if (init && (
            (init.mode && init.mode !== 'cors') || // If mode is explicitly set to something other than 'cors'
            (init.referrerPolicy === 'no-referrer') || // These are often set when the site handles CORS itself
            (typeof input === 'object' && input.mode && input.mode !== 'cors') || // For Request objects
            (init.cache === 'only-if-cached') // This requires same-origin mode
        )) {
            return originalFetch.apply(this, arguments);
        }

        const id = Math.random().toString(36).substr(2);
        const message = { type: 'FETCH_REQUEST', id, url: input, options: init };
        return new Promise((resolve, reject) => {
            function handleResponse(event) {
                if (event.data?.type === 'FETCH_RESPONSE' && event.data.id === id) {
                    window.removeEventListener('message', handleResponse);
                    if (event.data.ok) {
                        const responseInit = {
                            status: event.data.status,
                            statusText: event.data.statusText,
                            headers: event.data.headers || {}
                        };

                        const status = event.data.status;
                        const noBodyStatuses = [204, 205, 304];

                        if (noBodyStatuses.includes(status)) {
                            resolve(new Response(null, responseInit));
                        } else {
                            resolve(new Response(event.data.text, responseInit));
                        }
                    } else {
                        reject(new Error(event.data.error || 'Fetch proxy failed'));
                    }
                }
            }
            window.addEventListener('message', handleResponse);
            window.postMessage(message, '*');
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
        // First, check if this is a cross-origin request that we need to intercept
        if (!this._ngAntiCorsUrl ||
            !this._ngAntiCorsUrl.includes('://') ||
            this._ngAntiCorsUrl.startsWith(window.location.origin) ||
            !shouldInterceptRequest(this._ngAntiCorsMethod, this._ngAntiCorsUrl)) {
            return originalXhrSend.apply(this, arguments);
        }
        
        // Check if this is a Google or YouTube domain request
        // YouTube has special CORS handling that we shouldn't interfere with
        try {
            const urlObj = new URL(this._ngAntiCorsUrl);
            const host = urlObj.hostname.toLowerCase();
            if (host.includes('youtube.com') || 
                host.includes('google.com') || 
                host.includes('gstatic.com') || 
                host.includes('ytimg.com') || 
                host.includes('googleapis.com') ||
                host.includes('doubleclick.net') ||
                host.includes('ggpht.com')) {
                // Don't intercept requests to Google/YouTube domains
                return originalXhrSend.apply(this, arguments);
            }
        } catch (e) {
            // If URL parsing fails, just continue
        }
        
        // Let's attempt to detect if this request would work without interception
        try {
            // If withCredentials is true, the developer is already handling CORS
            if (this.withCredentials === true) {
                return originalXhrSend.apply(this, arguments);
            }
            
            // Check if there are any custom headers that typically indicate CORS is already handled
            const corsHeaders = ['x-requested-with', 'authorization', 'origin'];
            let hasCustomCorsHeaders = false;
            for (const header of corsHeaders) {
                try {
                    if (this.getRequestHeader && this.getRequestHeader(header)) {
                        hasCustomCorsHeaders = true;
                        break;
                    }
                } catch(e) {}
            }
            
            if (hasCustomCorsHeaders) {
                return originalXhrSend.apply(this, arguments);
            }
        } catch(e) {
            // Ignore errors and proceed with interception
        }

        const id = Math.random().toString(36).substr(2);
        const xhr = this;

        const options = {
            method: this._ngAntiCorsMethod,
            headers: {},
            body: body
        };

        if (xhr.getAllResponseHeaders) {
            try {
                for (let i = 0; i < xhr.getAllResponseHeaders().length; i++) {
                    const header = xhr.getAllResponseHeaders()[i];
                    if (header && header.name) {
                        options.headers[header.name] = header.value;
                    }
                }
            } catch (err) {
                console.warn('Unable to copy XHR headers:', err);
            }
        }

        const message = {
            type: 'FETCH_REQUEST',
            id,
            url: this._ngAntiCorsUrl,
            options
        };

        function handleResponse(event) {
            if (event.data?.type === 'FETCH_RESPONSE' && event.data.id === id) {
                window.removeEventListener('message', handleResponse);

                if (event.data.ok) {
                    xhr.responseText = event.data.text;
                    xhr.response = event.data.text;
                    xhr.status = event.data.status;
                    xhr.statusText = event.data.statusText;
                    xhr.dispatchEvent(new Event('load'));
                    xhr.dispatchEvent(new Event('loadend'));
                } else {
                    xhr.dispatchEvent(new Event('error'));
                    xhr.dispatchEvent(new Event('loadend'));
                }
            }
        }

        window.addEventListener('message', handleResponse);
        window.postMessage(message, '*');
    };

    window.postMessage({ type: 'NG_ANTI_CORS_READY' }, '*');
}