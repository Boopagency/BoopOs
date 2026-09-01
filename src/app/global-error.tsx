'use client'

/**
 * Ultima linha de defesa: erro no proprio root layout. Substitui `<html>`
 * inteiro, entao nao pode depender de nada do layout — nem de CSS de token.
 * Estilo inline aqui e intencional, e a unica excecao do projeto.
 */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="pt-BR">
      <body
        style={{
          fontFamily: 'system-ui, sans-serif',
          display: 'flex',
          minHeight: '100dvh',
          alignItems: 'center',
          justifyContent: 'center',
          margin: 0,
          padding: '1.5rem',
        }}
      >
        <div style={{ maxWidth: '32rem' }}>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>Algo deu errado</h1>
          <p style={{ marginTop: '0.75rem', color: '#555' }}>
            Nao conseguimos carregar a aplicacao. Tente novamente em instantes.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: '1.5rem',
              minHeight: '44px',
              padding: '0 1rem',
              cursor: 'pointer',
              borderRadius: '0.5rem',
              border: '1px solid #ccc',
              background: '#fff',
            }}
          >
            Tentar novamente
          </button>
        </div>
      </body>
    </html>
  )
}
