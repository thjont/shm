// Basic-auth gate for the dev and stage previews. Inert on prod, which doesn't
// set BASIC_AUTH_PASSWORD.

const encoder = new TextEncoder();

// crypto.subtle.timingSafeEqual is a Workers extension and needs equal-length
// buffers, so a length mismatch is answered before the comparison. That does leak
// the password's length, which is not worth contorting the code over: this gate
// keeps search engines and casual visitors out of a preview, it isn't protecting
// anything secret.
function secretsMatch(given, expected) {
    const a = encoder.encode(given);
    const b = encoder.encode(expected);
    if (a.byteLength !== b.byteLength) return false;
    return crypto.subtle.timingSafeEqual(a, b);
}

export async function onRequest(context) {
    const password = context.env.BASIC_AUTH_PASSWORD;
    if (!password) return context.next();

    // Optional: when BASIC_AUTH_USER is set the username has to match too.
    // Unset (the default) means any username is accepted, as before — browsers
    // prompt for both and the value was previously ignored outright.
    const username = context.env.BASIC_AUTH_USER;

    // Play-counting routes (/p/, /lets-play/, /learn-to-play/) and API endpoints
    // must be reachable without credentials so QR code scans work on dev/stage.
    // /scan-slugs.json needs no exemption: the functions read it through
    // env.ASSETS (see _lib/slugs.js), which never passes through this middleware.
    const { pathname } = new URL(context.request.url);
    if (
        pathname.startsWith("/p/") ||
        pathname.startsWith("/lets-play/") ||
        pathname.startsWith("/learn-to-play/") ||
        pathname.startsWith("/api/")
    ) {
        return context.next();
    }

    const auth = context.request.headers.get("Authorization");
    if (auth && auth.startsWith("Basic ")) {
        let decoded = null;
        try {
            decoded = atob(auth.slice(6));
        } catch {
            // malformed base64 — treat as bad credentials, not a 500
        }
        const colon = decoded ? decoded.indexOf(":") : -1;
        if (colon !== -1) {
            const passwordOk = secretsMatch(decoded.slice(colon + 1), password);
            const userOk = !username || secretsMatch(decoded.slice(0, colon), username);
            if (passwordOk && userOk) return context.next();
        }
    }

    return new Response("Unauthorized", {
        status: 401,
        headers: { "WWW-Authenticate": 'Basic realm="Preview"' },
    });
}
