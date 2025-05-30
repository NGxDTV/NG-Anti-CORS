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

    function shouldInterceptRequest(method, url) {
        const basicMethods = ['GET', 'POST', 'HEAD', 'PUT'];
        method = (method || 'GET').toUpperCase();

        if (basicMethods.includes(method) && window.__ngAntiCorsEnabled) {
            return true;
        }

        const advancedMethods = ['DELETE', 'OPTIONS', 'PATCH', 'PROPFIND', 'PROPPATCH', 'MKCOL', 'COPY', 'MOVE', 'LOCK', 'UNLOCK'];
        if (advancedMethods.includes(method) && window.__ngAntiCorsPreflightEnabled) {
            return true;
        }

        if (window.__ngAntiCorsEnabled && url) {
            try {
                const currentOrigin = location.origin;
                const requestUrl = typeof url === 'string' ? url : url.url;
                const requestOrigin = new URL(requestUrl, location.href).origin;

                if (requestOrigin !== currentOrigin && init && (init.credentials === 'include' || init.credentials === 'same-origin')) {
                    return window.__ngAntiCorsPreflightEnabled;
                }
            } catch (e) {
                console.error('Error parsing URL:', e);
            }
        }

        return false;
    }

    window.fetch = function (input, init = {}) {
        const method = init?.method || 'GET';

        if (!shouldInterceptRequest(method, input)) {
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
                        resolve(new Response(event.data.text, responseInit));
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
        if (!this._ngAntiCorsUrl ||
            !this._ngAntiCorsUrl.includes('://') ||
            this._ngAntiCorsUrl.startsWith(window.location.origin) ||
            !shouldInterceptRequest(this._ngAntiCorsMethod, this._ngAntiCorsUrl)) {
            return originalXhrSend.apply(this, arguments);
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