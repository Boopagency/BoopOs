import { cn } from '@/lib/cn'

export interface BoopEyesProps {
  /**
   * Para onde os olhos olham. `down` e o gesto de atencao: usado apenas
   * quando alguma coisa depende do cliente.
   */
  gaze?: 'default' | 'down' | 'right'
  /** Piscada lenta. Reservada para momentos de espera e de celebracao. */
  blink?: boolean
  className?: string
  /** Descricao para leitor de tela. Vazio = decorativo. */
  label?: string
}

/*
 * Mascote oficial da Boop — os "olhinhos" que sao os dois O de "boop".
 *
 * A geometria e IDENTICA a de reference/brand/mascot-eye.svg: os mesmos
 * paths, as mesmas elipses, as mesmas cores. Nada foi redesenhado
 * (reference/brand/README.md proibe).
 *
 * O que foi acrescentado: as pupilas e os brilhos ficam em um <g> proprio,
 * para que o olhar possa se deslocar alguns pixels. E a unica liberdade
 * tomada, e ela existe porque a promessa do produto — "eu sei exatamente o
 * que esta acontecendo" — e literalmente o simbolo da marca: atencao.
 */
const GAZE = {
  default: 'translate(0, 0)',
  down: 'translate(-4, 10)',
  right: 'translate(7, -3)',
} as const

export function BoopEyes({ gaze = 'default', blink = false, className, label }: BoopEyesProps) {
  const decorative = !label

  return (
    <svg
      viewBox="0 0 268 187"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('h-auto', className)}
      role={decorative ? 'presentation' : 'img'}
      aria-hidden={decorative || undefined}
      aria-label={label}
    >
      {label ? <title>{label}</title> : null}

      {/* topete */}
      <path
        d="M76.735 27.7407L71.0085 48.5463C71.0085 48.5463 85.8974 47.3904 101.932 55.4815C117.966 63.5725 132.855 84.3781 132.855 84.3781C132.855 84.3781 147.744 64.7284 154.615 60.1049C161.487 55.4815 185.538 48.5463 185.538 48.5463V32.3642L168.359 42.767L177.521 19.6497L160.342 32.3642V19.6497L146.598 32.3642L142.017 0L111.094 38.1435L101.932 10.4028L87.0427 38.1435L76.735 27.7407Z"
        fill="#FFFDF5"
      />

      {/* olho esquerdo — navy */}
      <path
        d="M144.308 114.024C144.308 154.328 112.003 187 72.1538 187C32.3044 187 0 154.328 0 114.024C0 73.7211 32.3044 41.0488 72.1538 41.0488C112.003 41.0488 144.308 73.7211 144.308 114.024ZM38.9631 114.024C38.9631 132.564 53.8231 147.593 72.1538 147.593C90.4846 147.593 105.345 132.564 105.345 114.024C105.345 95.4849 90.4846 80.4556 72.1538 80.4556C53.8231 80.4556 38.9631 95.4849 38.9631 114.024Z"
        fill="#0B1B2C"
      />
      <g
        className={cn(blink && 'origin-[72px_114px] animate-[boop-blink_7s_ease-in-out_infinite]')}
      >
        <ellipse cx="72.1538" cy="114.024" rx="27.4872" ry="27.3659" fill="#FFFDF5" />
        <g
          transform={GAZE[gaze]}
          style={{ transition: 'transform var(--motion-emphasized) var(--ease-out)' }}
        >
          <ellipse cx="79.0256" cy="111.744" rx="16.0342" ry="15.9634" fill="#1A1A1A" />
          <ellipse cx="73.2991" cy="106.043" rx="5.7265" ry="5.70122" fill="#FFFDF5" />
        </g>
      </g>

      {/* olho direito — sky */}
      <path
        d="M268 114.024C268 154.328 236.208 187 196.991 187C157.775 187 125.983 154.328 125.983 114.024C125.983 73.7211 157.775 41.0488 196.991 41.0488C236.208 41.0488 268 73.7211 268 114.024ZM164.328 114.024C164.328 132.564 178.952 147.593 196.991 147.593C215.031 147.593 229.655 132.564 229.655 114.024C229.655 95.4849 215.031 80.4556 196.991 80.4556C178.952 80.4556 164.328 95.4849 164.328 114.024Z"
        fill="#7AD7F4"
      />
      <g
        className={cn(blink && 'origin-[197px_114px] animate-[boop-blink_7s_ease-in-out_infinite]')}
      >
        <ellipse cx="196.991" cy="114.024" rx="27.4872" ry="27.3659" fill="#FFFDF5" />
        <g
          transform={GAZE[gaze]}
          style={{ transition: 'transform var(--motion-emphasized) var(--ease-out)' }}
        >
          <ellipse cx="203.863" cy="111.744" rx="16.0342" ry="15.9634" fill="#1A1A1A" />
          <ellipse cx="198.137" cy="106.043" rx="5.7265" ry="5.70122" fill="#FFFDF5" />
        </g>
      </g>

      {/* chifrinho, com o gradiente original */}
      <path
        d="M196.991 56.2953C209.733 67.2608 217.776 69.7502 233.641 67.8187L232.808 54.8549L231.975 41.8911L231.142 28.9273L230.309 15.9634L221.98 26.0464L213.65 36.1294L205.321 46.2124L196.991 56.2953Z"
        fill="url(#boop-eyes-horn)"
      />
      <defs>
        <linearGradient
          id="boop-eyes-horn"
          x1="215.316"
          y1="15.9634"
          x2="215.316"
          y2="67.8187"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#00C2FF" />
          <stop offset="1" stopColor="#1B171F" />
        </linearGradient>
      </defs>
    </svg>
  )
}
