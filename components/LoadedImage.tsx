'use client'

import { useEffect, useState } from 'react'

type LoadedImageProps = {
  src: string
  alt: string
  className?: string
  wrapperClassName?: string
  placeholderClassName?: string
}

export default function LoadedImage({
  src,
  alt,
  className = '',
  wrapperClassName = '',
  placeholderClassName = 'bg-gray-100 dark:bg-[#141821]',
}: LoadedImageProps) {
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setLoaded(false)
  }, [src])

  return (
    <div className={`relative overflow-hidden ${wrapperClassName}`}>
      {!loaded && <div className={`absolute inset-0 animate-pulse ${placeholderClassName}`} />}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(true)}
        className={`h-full w-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'} ${className}`}
      />
    </div>
  )
}
