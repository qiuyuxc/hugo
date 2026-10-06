import { getCollection, type CollectionEntry } from 'astro:content';

export type Post = CollectionEntry<'posts'>;

export async function getPosts() {
  return (await getCollection('posts', ({ data }) => !data.draft))
    .sort((first, second) => second.data.date.getTime() - first.data.date.getTime());
}

export const postUrl = (post: Post) => `/posts/${post.id}/`;
export const dateLabel = (date: Date) => new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Shanghai'
}).format(date).replaceAll('/', '.');
export const readTime = (post: Post) => Math.max(1, Math.ceil((post.body?.length ?? 0) / 600));
