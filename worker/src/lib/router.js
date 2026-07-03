/**
 * Minimal URL router for the Cloudflare Worker.
 * Matches method + path pattern and extracts :params.
 */
export class Router {
  constructor(request, env, ctx) {
    this.request = request;
    this.env = env;
    this.ctx = ctx;
    this.url = new URL(request.url);
    this._routes = [];
    this._matched = null;
  }

  _addRoute(method, pattern, handler) {
    this._routes.push({ method, pattern, handler });
  }

  get(pattern, handler)   { this._addRoute('GET',    pattern, handler); }
  post(pattern, handler)  { this._addRoute('POST',   pattern, handler); }
  put(pattern, handler)   { this._addRoute('PUT',    pattern, handler); }
  patch(pattern, handler) { this._addRoute('PATCH',  pattern, handler); }
  delete(pattern, handler){ this._addRoute('DELETE', pattern, handler); }

  _match(pattern, pathname) {
    const patternParts = pattern.split('/');
    const pathParts    = pathname.split('/');
    if (patternParts.length !== pathParts.length) return null;
    const params = {};
    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i].startsWith(':')) {
        params[patternParts[i].slice(1)] = decodeURIComponent(pathParts[i]);
      } else if (patternParts[i] !== pathParts[i]) {
        return null;
      }
    }
    return params;
  }

  async handle() {
    const { pathname } = this.url;
    const method = this.request.method;

    for (const route of this._routes) {
      if (route.method !== method) continue;
      const params = this._match(route.pattern, pathname);
      if (params !== null) {
        return route.handler(this.request, this.env, this.ctx, params);
      }
    }

    return Response.json({ error: 'Route not found' }, { status: 404 });
  }
}