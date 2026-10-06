import { getPosts, postUrl } from '../lib/posts';
import { escapeXml, siteTitle, siteUrl } from '../config/site';

export async function GET() {
  const posts = await getPosts();
  const items = posts.map(post => {
    const url = escapeXml(new URL(postUrl(post), siteUrl).href);
    return `<item><title>${escapeXml(post.data.title)}</title><link>${url}</link><guid isPermaLink="true">${url}</guid><pubDate>${post.data.date.toUTCString()}</pubDate><description>${escapeXml(post.data.description)}</description></item>`;
  }).join('');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${escapeXml(siteTitle)}</title><link>${siteUrl}</link><description>记录个人随笔与技术实践</description><language>zh-CN</language>${items}</channel></rss>`, {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' }
  });
}
