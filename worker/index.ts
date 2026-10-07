const SITE = "https://nikhilswain.github.io/vidscroll";

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname === "/" || url.pathname === "/index.html" ? "/demos/" : url.pathname === "/element.html" ? "/demos/element.html" : url.pathname;
    return Response.redirect(`${SITE}${path}${url.search}`, 301);
  },
};
