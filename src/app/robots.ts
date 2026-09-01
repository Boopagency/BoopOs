import type { MetadataRoute } from 'next'

/**
 * O BOOP OS e um produto inteiramente autenticado. Nada aqui deve ser
 * indexado — nem hoje, nem quando o portal tiver conteudo real.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', disallow: '/' },
  }
}
