import type { NextConfig } from 'next'

/**
 * Baseline de seguranca HTTP.
 *
 * CSP fica deliberadamente de fora nesta fase: uma politica util no App Router
 * exige nonce por request (middleware), e a superficie de assets e integracoes
 * ainda vai mudar bastante ate a FASE 17. Uma CSP com `unsafe-inline` agora
 * daria falsa sensacao de protecao. Entra na FASE 19 — ver docs/security.md.
 */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
  },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
]

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Nao expor a versao do framework.
  poweredByHeader: false,

  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
      {
        // Nada do produto autenticado pode ser cacheado por intermediario.
        source: '/:path(portal|admin)/:rest*',
        headers: [{ key: 'Cache-Control', value: 'private, no-store' }],
      },
    ]
  },

  async redirects() {
    return [
      /*
       * `/app` e o nome usado no briefing da FASE 1; `/portal` e a rota
       * canonica documentada na FASE 0 (docs/product.md). O alias mantem os
       * dois validos sem duplicar pagina. Remover daqui e a unica mudanca
       * necessaria se a rota canonica for revista.
       */
      { source: '/app', destination: '/portal', permanent: false },
      { source: '/app/:path*', destination: '/portal/:path*', permanent: false },
    ]
  },
}

export default nextConfig
