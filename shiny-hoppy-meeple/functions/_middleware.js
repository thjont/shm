export async function onRequest(context) {
    const password = context.env.BASIC_AUTH_PASSWORD;
    if (!password) return context.next();

    const auth = context.request.headers.get("Authorization");
    if (auth && auth.startsWith("Basic ")) {
        const decoded = atob(auth.slice(6));
        const colon = decoded.indexOf(":");
        if (colon !== -1 && decoded.slice(colon + 1) === password) {
            return context.next();
        }
    }

    return new Response("Unauthorized", {
        status: 401,
        headers: { "WWW-Authenticate": 'Basic realm="Preview"' },
    });
}
