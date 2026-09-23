const PORT = Number(process.env.PORT ?? 4173);
const root = new URL('./public/', import.meta.url);

const server = Bun.serve({
    port: PORT,
    async fetch(request) {
        const url = new URL(request.url);
        const pathname = url.pathname === '/' ? '/index.html' : url.pathname;
        const file = Bun.file(new URL(`.${pathname}`, root));
        if (await file.exists()) {
            return new Response(file);
        }
        return new Response('Not Found', { status: 404 });
    },
});

console.log(`E2E host listening on http://127.0.0.1:${server.port}`);
