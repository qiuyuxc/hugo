export interface NavigationLink {
  label: string;
  href: string;
  external?: boolean;
  description?: string;
}

export const primaryLinks: NavigationLink[] = [
  { label: '首页', href: '/' },
  { label: '文章归档', href: '/archives/' },
  { label: '分类', href: '/categories/' },
  { label: '友链', href: '/links/' }
];

export const navigationGroups: { label: string; links: NavigationLink[] }[] = [
  { label: '关于这里', links: [{ label: '关于', href: '/about/', description: '认识一下博主' }] },
  { label: '我的其他角落', links: [
    { label: 'GitHub', href: 'https://github.com/qiuyuxc', external: true, description: '项目与代码' },
    { label: '随机图片', href: 'https://pic.kukie.cn/', external: true, description: '一些喜欢的画面' }
  ] }
];
