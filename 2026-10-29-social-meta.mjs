export function siteOrigin(env = process.env) {
  const value = env.SITE_URL || env.VERCEL_PROJECT_PRODUCTION_URL || env.VERCEL_URL;
  if (!value) {
    if (env.VERCEL === '1') throw new Error('Enable Vercel System Environment Variables or set SITE_URL to your public HTTPS domain.');
    return '';
  }
  const url = new URL(value.includes('://') ? value : `https://${value}`);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('SITE_URL must be a public HTTPS origin, for example https://your-domain.com');
  }
  return url.origin;
}
export function socialMetadata(env = process.env) {
  const origin = siteOrigin(env);
  return {
    name: 'musicstep-social-metadata',
    transformIndexHtml(html) {
      html = html.replaceAll('content="/og-image.png"', `content="${origin}/og-image.png"`);
      if (!origin) return html;
      return html.replace('</head>', ` <meta property="og:url" content="${origin}/">\n <link rel="canonical" href="${origin}/">\n</head>`);
    }
  };
}
