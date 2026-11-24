export default function BrandMark({ small = false, className = '' }) {
  return <span className={`brand-mark${small ? ' is-small' : ''}${className ? ` ${className}` : ''}`}>
    <img src={small ? '/logoicon.svg' : '/logotipo.svg'} alt={small ? 'Sistema Senso' : 'Sistema Senso'} />
  </span>
}
