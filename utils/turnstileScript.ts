declare global {
    interface Window {
        turnstile?: {
            render: (container: HTMLElement, options: Record<string, unknown>) => string;
            remove: (widgetId: string) => void;
        };
    }
}

const TURNSTILE_SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let turnstileScriptPromise: Promise<void> | null = null;

/** Carga el script de Turnstile una sola vez. Si falla, la siguiente llamada lo reintenta. */
export const loadTurnstileScript = (): Promise<void> => {
    if (window.turnstile) {
        return Promise.resolve();
    }
    if (!turnstileScriptPromise) {
        turnstileScriptPromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            const fail = () => {
                turnstileScriptPromise = null;
                script.remove();
                reject(new Error('Could not load Turnstile.'));
            };
            script.src = TURNSTILE_SCRIPT_URL;
            script.async = true;
            script.onload = () => (window.turnstile ? resolve() : fail());
            script.onerror = fail;
            document.head.appendChild(script);
        });
    }
    return turnstileScriptPromise;
};
