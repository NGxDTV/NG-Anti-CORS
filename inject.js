if (typeof window.__ngAntiCorsInjected === 'undefined') {
    window.__ngAntiCorsInjected = true;

    const originalFetch = window.fetch;
}

window.fetch = function (input, init = {}) {
    const id = Math.random().toString(36).substr(2);
    const message = { type: 'FETCH_REQUEST', id, url: input, options: init };
    return new Promise((resolve, reject) => {
        function handleResponse(event) {
            if (event.data?.type === 'FETCH_RESPONSE' && event.data.id === id) {
                window.removeEventListener('message', handleResponse);
                if (event.data.ok) {
                    resolve(new Response(event.data.text, { status: event.data.status, statusText: event.data.statusText }));
                } else {
                    reject(new Error(event.data.error || 'Fetch proxy failed'));
                }
            }
        }
        window.addEventListener('message', handleResponse);
        window.postMessage(message, '*');
    });
};