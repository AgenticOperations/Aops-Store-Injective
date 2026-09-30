import Image from 'next/image'
import './site-brand.css'

/** Navbar brand lockup — icon for recognition, wordmark for name. Wrapped by Shell's home link. */
export function SiteBrand() {
  return (
    <span className="site-brand">
      <Image
        src="/aops-tab-icon.png"
        alt=""
        width={32}
        height={32}
        priority
        className="site-brand__icon"
      />
      <Image
        src="/aops-wordmark.png"
        alt="Aops"
        width={96}
        height={28}
        priority
        className="site-brand__wordmark"
      />
    </span>
  )
}
