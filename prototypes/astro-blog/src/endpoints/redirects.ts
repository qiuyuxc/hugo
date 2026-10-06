import { getPosts, postUrl } from '../lib/posts';

const slug = (value: string) => encodeURIComponent(value.toLowerCase().replace(/\s+/g, '-'));

export async function GET() {
  const posts = await getPosts();
  const redirects = new Map<string, string>([
    ['/posts/', '/archives/'], ['/tags/', '/search/'],
    ['/page/:page/', '/archives/'], ['/posts/page/:page/', '/archives/']
  ]);
  for (const post of posts) {
    for (const alias of post.data.aliases) {
      if (!alias.startsWith('/') || alias.startsWith('//') || /[\s?#]/.test(alias)) throw new Error(`Invalid post alias: ${alias}`);
      if (alias !== postUrl(post)) redirects.set(alias, postUrl(post));
    }
    for (const category of post.data.categories) redirects.set(`/categories/${slug(category)}/`, `/?category=${encodeURIComponent(category)}#notes`);
    for (const tag of post.data.tags) redirects.set(`/tags/${slug(tag)}/`, `/search/?q=${encodeURIComponent(tag)}`);
  }
  const body = [...redirects].map(([from, to]) => `${from} ${to} 301`).join('\n') + '\n';
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
