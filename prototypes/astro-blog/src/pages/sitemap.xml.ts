import { getPosts, postUrl } from '../lib/posts';
import { escapeXml, indexPages, siteUrl } from '../config/site';

export async function GET() {
  const posts = await getPosts();
  const pages = [...indexPages.map(path => ({ path, date: undefined as Date | undefined })),
    ...posts.map(post => ({ path: postUrl(post), date: post.data.date }))];
  const entries = pages.map(({ path, date }) => `<url><loc>${escapeXml(new URL(path, siteUrl).href)}</loc>${date ? `<lastmod>${date.toISOString()}</lastmod>` : ''}</url>`).join('');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}</urlset>`, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' }
  });
}
