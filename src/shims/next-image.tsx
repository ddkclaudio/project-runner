import type { CSSProperties, ImgHTMLAttributes } from 'react';

type ImageSrc = string | { src: string };

type ImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  src: ImageSrc;
  width?: number | string;
  height?: number | string;
  fill?: boolean;
  priority?: boolean;
  style?: CSSProperties;
};

/** Minimal stand-in for `next/image`. */
export default function Image({
  src,
  alt,
  width,
  height,
  className,
  style,
  fill,
  ...rest
}: ImageProps) {
  const resolved = typeof src === 'string' ? src : src.src;
  const mergedStyle: CSSProperties = fill
    ? {
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        ...style,
      }
    : (style ?? {});

  return (
    <img
      src={resolved}
      alt={alt ?? ''}
      width={width}
      height={height}
      className={className}
      style={mergedStyle}
      loading={rest.priority ? 'eager' : 'lazy'}
      {...rest}
    />
  );
}
