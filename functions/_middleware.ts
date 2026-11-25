interface PagesMiddlewareContext {
  request: Request;
  next: () => Promise<Response>;
}

const PRIMARY_HOST = 'hvac-second-opinion.com';
const REDIRECT_HOSTS = new Set([
  'hvac-second-opinion.pages.dev',
  'www.hvac-second-opinion.com',
]);

export async function onRequest(context: PagesMiddlewareContext): Promise<Response> {
  const url = new URL(context.request.url);
  const host = url.hostname.toLowerCase();

  if (REDIRECT_HOSTS.has(host)) {
    const destination = `https://${PRIMARY_HOST}${url.pathname}${url.search}`;
    return Response.redirect(destination, 301);
  }

  const response = await context.next();

  if (host.endsWith('.hvac-second-opinion.pages.dev')) {
    const headers = new Headers(response.headers);
    headers.set('X-Robots-Tag', 'noindex, nofollow');
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  return response;
}
