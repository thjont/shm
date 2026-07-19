export async function onRequest(context) {
    const password = context.env.BASIC_AUTH_PASSWORD;
    if (!password) return context.next();

    // Play-counting routes (/p/, /lets-play/, /learn-to-play/) and API endpoints
    // must be reachable without credentials so QR code scans work on dev/stage.
    // /scan-slugs.json is also exempt because the play functions fetch it as an
    // internal subrequest and there are no browser credentials to forward.
    const { pathname } = new URL(context.request.url);
    if (
        pathname === "/scan-slugs.json" ||
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
        if (colon !== -1 && decoded.slice(colon + 1) === password) {
            return context.next();
        }
    }

    return new Response("Unauthorized", {
        status: 401,
        headers: { "WWW-Authenticate": 'Basic realm="Preview"' },
    });
}
