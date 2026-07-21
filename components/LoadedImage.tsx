'use client'

import { useEffect, useState } from 'react'
import { isImagePrimed, markImageLoaded, primeImage } from '@/lib/image-cache'
import { optimizeCloudinaryUrl, IMAGE_SIZES } from '@/lib/cloudinary'

type LoadedImageProps = {
  src: string
  alt: string
  className?: string
  wrapperClassName?: string
  placeholderClassName?: string
  priority?: boolean
  width?: number
}

export default function LoadedImage({
  src,
  alt,
  className = '',
  wrapperClassName = '',
  placeholderClassName = 'bg-surface',
  priority = false,
  width = IMAGE_SIZES.card,
}: LoadedImageProps) {
  const optimizedSrc = optimizeCloudinaryUrl(src, { width })
  const [loaded, setLoaded] = useState(() => isImagePrimed(optimizedSrc))

  useEffect(() => {
    setLoaded(isImagePrimed(optimizedSrc))
    if (priority) primeImage(optimizedSrc, { width })
  }, [optimizedSrc, priority, width])

  return (
    <div className={`relative overflow-hidden ${wrapperClassName}`}>
      {!loaded && <div className={`absolute inset-0 animate-pulse ${placeholderClassName}`} />}
      <img
        src={optimizedSrc}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        fetchPriority={priority ? 'high' : 'auto'}
        onLoad={() => { setLoaded(true); markImageLoaded(optimizedSrc) }}
        onError={() => { setLoaded(true); markImageLoaded(optimizedSrc) }}
        className={`h-full w-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'} ${className}`}
      />
    </div>
  )
}
