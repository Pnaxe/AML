import React from 'react'
import logoSrc from '../images/AS logo.png'

type LogoProps = {
  size?: 'default' | 'small'
}

export const Logo: React.FC<LogoProps> = ({ size = 'default' }) => {
  const height = size === 'small' ? 40 : 56
  return (
    <img
      src={logoSrc}
      alt="AS Logo"
      className="logo-img"
      style={{ height, width: 'auto' }}
    />
  )
}
