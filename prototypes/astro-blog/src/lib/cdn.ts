const providers = [
  { match: ['cloudflare'], name: 'Cloudflare' },
  { match: ['edgeone'], name: 'EdgeOne' },
  { match: ['esa'], name: 'Alibaba ESA' },
  { match: ['tengine', 'alibaba', 'aliyun'], name: 'Alibaba Cloud' },
  { match: ['tencent'], name: 'Tencent Cloud' },
  { match: ['vercel'], name: 'Vercel' },
  { match: ['netlify'], name: 'Netlify' }
];

export function providerName(server: string) {
  return providers.find(provider => provider.match.some(value => server.toLowerCase().includes(value)))?.name || server.slice(0, 64);
}
