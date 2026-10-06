export const siteUrl = 'https://www.kukie.cn/';
export const siteTitle = 'Kukie 的个人笔记';
export const isPublished = import.meta.env.PUBLIC_SITE_RELEASE === '1';
export const indexPages = ['/', '/archives/', '/categories/', '/links/', '/about/'];

export function escapeXml(value: string) {
  return value.replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'
  })[character]!);
}
