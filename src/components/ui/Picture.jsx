/**
 * Renders a vite-imagetools `as=picture` object as a real <picture> element:
 * AVIF first, WebP as the fallback, and always with intrinsic width/height so
 * the image reserves its box before it loads (CLS → 0).
 *
 * Import images like:
 *   import cover from '../assets/projects/x.webp?w=640;1280&format=avif;webp&as=picture'
 */
export default function Picture({
  picture,
  alt = '',
  className = '',
  sizes = '(max-width: 768px) 100vw, 50vw',
  priority = false,
  style,
  ...rest
}) {
  if (!picture?.img) return null
  const { sources = {}, img } = picture

  // React 18 does not recognise the camelCase `fetchPriority` prop (that
  // landed in 19) and warns if you pass it, so the lowercase HTML attribute
  // is spread in instead. Only set when it actually means something.
  const priorityAttrs = priority ? { fetchpriority: 'high' } : {}

  return (
    <picture>
      {Object.entries(sources).map(([format, srcset]) => (
        <source key={format} type={`image/${format}`} srcSet={srcset} sizes={sizes} />
      ))}
      <img
        src={img.src}
        width={img.w}
        height={img.h}
        alt={alt}
        className={className}
        style={style}
        // The LCP image must not be lazy and should be fetched early;
        // everything else stays out of the way of the critical path.
        loading={priority ? 'eager' : 'lazy'}
        decoding={priority ? 'sync' : 'async'}
        {...priorityAttrs}
        {...rest}
      />
    </picture>
  )
}
