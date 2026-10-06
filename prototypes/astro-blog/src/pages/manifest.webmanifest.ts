export function GET() {
  return new Response(JSON.stringify({
    id: '/',
    name: 'Kukie 的个人笔记',
    short_name: 'Kukie',
    description: '记录个人随笔与技术实践，离线也能重读看过的笔记。',
    lang: 'zh-CN',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#f8f9f5',
    theme_color: '#263e35',
    icons: [
      { src: '/app-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/app-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
    ],
    shortcuts: [
      { name: '文章归档', url: '/archives/' },
      { name: '搜索笔记', url: '/search/' }
    ]
  }), { headers: { 'Content-Type': 'application/manifest+json' } });
}
