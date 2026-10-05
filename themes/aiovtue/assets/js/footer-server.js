/* 页脚服务 CDN 徽章。
   优先级：手动 cdn 配置 > 响应头 Server > ASN 兜底（解析域名→查 IP 归属）。
   新增 CDN：往 CDN_BADGES 里加一条即可（icon 放 static/cdn/ 下）。 */
const CDN_BADGES = [
  { match: ['cloudflare'], icon: '/cdn/cf.svg', name: 'Cloudflare' },
  { match: ['edgeone'], icon: '/cdn/eo.svg', name: 'EdgeOne' },
  { match: ['tengine', 'alibaba', 'aliyun'], icon: '/cdn/aliyun-cdn.svg', name: 'Alibaba Cloud' },
  { match: ['esa'], icon: '/cdn/esa.svg', name: 'Alibaba ESA' },
  { match: ['tencent'], icon: '/cdn/tencent-cdn.svg', name: 'Tencent Cloud' },
  { match: ['vercel'], icon: '/cdn/vercel.svg', name: 'Vercel' },
  { match: ['netlify'], icon: '/cdn/netlify.svg', name: 'Netlify' },
]

const serverHeaderCache = new Map()
const cdnValueCache = new Map()

function matchBadge(server) {
  if (!server) return null
  const value = server.toLowerCase()
  return CDN_BADGES.find((entry) => entry.match.some((key) => value.includes(key))) || null
}

function fetchServerHeader(url) {
  if (!serverHeaderCache.has(url)) {
    serverHeaderCache.set(
      url,
      fetch(url, { method: 'HEAD' })
        .then((res) => res.headers.get('server'))
        .catch(() => null),
    )
  }
  return serverHeaderCache.get(url)
}

/* ASN 兜底：DoH 解析域名（阿里优先，dns.google 备用），再用 ipwho.is 查 IP 归属。
   返回一段可被 matchBadge 匹配的文本（org/isp/domain/asn）。 */
async function resolveHostIp(host) {
  const endpoints = [
    `https://223.5.5.5/resolve?name=${encodeURIComponent(host)}&type=A`,
    `https://dns.google/resolve?name=${encodeURIComponent(host)}&type=A`,
  ]
  for (const endpoint of endpoints) {
    try {
      const data = await fetch(endpoint, { headers: { Accept: 'application/dns-json' } }).then((r) => r.json())
      const ip = (data.Answer || []).find((a) => a.type === 1)?.data
      if (ip) return ip
    } catch {}
  }
  return null
}

async function lookupAsnInfo(ip) {
  try {
    const data = await fetch(`https://api.ipapi.is/?q=${encodeURIComponent(ip)}`).then((r) => r.json())
    const text = [data.company, data.asn, data.datacenter, data.type].filter(Boolean).join(' ')
    if (text) return text
  } catch {}
  try {
    const data = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`).then((r) => r.json())
    if (data && data.success && data.connection) {
      const c = data.connection
      return [c.org, c.isp, c.domain, c.asn].filter(Boolean).join(' ')
    }
  } catch {}
  return null
}

async function lookupCdnByAsn(host) {
  if (!host) return null
  const ip = await resolveHostIp(host)
  if (!ip) return null
  return lookupAsnInfo(ip)
}

function resolveCdnValue(url) {
  const key = url || window.location.href
  if (!cdnValueCache.has(key)) {
    cdnValueCache.set(
      key,
      (async () => {
        const server = await fetchServerHeader(key)
        if (server) return server
        let host = window.location.hostname
        if (url) {
          try { host = new URL(url).hostname } catch {}
        }
        return lookupCdnByAsn(host)
      })(),
    )
  }
  return cdnValueCache.get(key)
}

/* 本地预览开关：访问 ?cdn=aliyun 让「当前站点」行强制显示指定徽章并记住；?cdn=off 关闭。 */
function readServerOverride() {
  let params
  try { params = new URLSearchParams(window.location.search) } catch { return null }
  if (params.has('cdn')) {
    const value = params.get('cdn')
    try {
      if (!value || value === 'off') localStorage.removeItem('cdn-preview')
      else localStorage.setItem('cdn-preview', value)
    } catch {}
    return value && value !== 'off' ? value : null
  }
  try { return localStorage.getItem('cdn-preview') || null } catch { return null }
}

export function initFooterServer() {
  const container = document.getElementById('footer-server')
  if (!container || container.dataset.ready === '1') return

  const items = Array.from(container.querySelectorAll('.sakura-footer-server__item'))
  if (!items.length) return

  const override = readServerOverride()

  Promise.all(
    items.map((item) => {
      const url = item.dataset.serverUrl || ''
      const manual = (item.dataset.serverCdn || '').trim()
      let serverPromise
      if (manual) serverPromise = Promise.resolve(manual)
      else if (override && !url) serverPromise = Promise.resolve(override)
      else serverPromise = resolveCdnValue(url)
      return serverPromise.then((server) => ({ item, server }))
    }),
  ).then((results) => {
    let shown = 0
    results.forEach(({ item, server }) => {
      const badge = matchBadge(server)
      const valueEl = item.querySelector('[data-server-value]')
      const iconEl = item.querySelector('[data-server-icon]')
      if (badge) {
        iconEl.src = badge.icon
        iconEl.alt = `Hosted: ${badge.name}`
        iconEl.hidden = false
        valueEl.hidden = true
        item.hidden = false
        shown++
      } else if (server) {
        valueEl.textContent = server
        item.hidden = false
        shown++
      } else {
        item.hidden = true
      }
    })
    container.hidden = shown === 0
    container.dataset.ready = '1'
  })
}
