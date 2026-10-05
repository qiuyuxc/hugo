/* 页脚 CDN 徽章 —— 浏览器端同源 HEAD 读取响应头 Server，匹配对应 CDN 徽章。
   匹配不到时回退显示原始 Server 值；探测失败则整行隐藏。
   新增 CDN：往 CDN_BADGES 里加一条即可（icon 放 static/cdn/ 下）。 */
const CDN_BADGES = [
  { match: ['cloudflare'], icon: '/cdn/cf.svg', name: 'Cloudflare' },
  { match: ['edgeone'], icon: '/cdn/eo.svg', name: 'EdgeOne' },
  { match: ['tengine', 'aliyun', 'alibabacloud'], icon: '/cdn/aliyun-cdn.svg', name: 'Alibaba Cloud' },
  { match: ['esa'], icon: '/cdn/esa.svg', name: 'Alibaba ESA' },
  { match: ['tencent'], icon: '/cdn/tencent-cdn.svg', name: 'Tencent Cloud' },
  { match: ['vercel'], icon: '/cdn/vercel.svg', name: 'Vercel' },
  { match: ['netlify'], icon: '/cdn/netlify.svg', name: 'Netlify' },
]

let serverHeaderPromise = null

function matchBadge(server) {
  if (!server) return null
  const value = server.toLowerCase()
  return CDN_BADGES.find((entry) => entry.match.some((key) => value.includes(key))) || null
}

function fetchServerHeader() {
  if (!serverHeaderPromise) {
    serverHeaderPromise = fetch(window.location.href, { method: 'HEAD' })
      .then((res) => res.headers.get('server'))
      .catch(() => null)
  }
  return serverHeaderPromise
}

/* 本地预览开关：访问 ?cdn=aliyun 强制显示指定徽章并记住；?cdn=off 关闭。
   仅用于本地看效果，线上正常走 Server 头。 */
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

  const valueEl = container.querySelector('[data-server-value]')
  const iconEl = container.querySelector('[data-server-icon]')

  const override = readServerOverride()
  const serverPromise = override ? Promise.resolve(override) : fetchServerHeader()

  serverPromise.then((server) => {
    const badge = matchBadge(server)
    if (badge) {
      iconEl.src = badge.icon
      iconEl.alt = `Hosted: ${badge.name}`
      iconEl.hidden = false
      valueEl.hidden = true
    } else if (server) {
      valueEl.textContent = server
    } else {
      container.hidden = true
      return
    }
    container.hidden = false
    container.dataset.ready = '1'
  })
}
