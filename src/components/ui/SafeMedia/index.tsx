'use client';

import {
  useEffect,
  useState,
  type ImgHTMLAttributes,
  type SyntheticEvent,
  type VideoHTMLAttributes,
} from 'react';

export const BROKEN_MEDIA_SRC = '/broken-image.webp';

export type SafeImageProps = ImgHTMLAttributes<HTMLImageElement>;

/** `<img>` that swaps to `/broken-image.webp` once on load error. */
export function SafeImage({ src, onError, alt = '', ...props }: SafeImageProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  const effectiveSrc = failed || !src ? BROKEN_MEDIA_SRC : src;

  function handleError(event: SyntheticEvent<HTMLImageElement>) {
    if (!failed && effectiveSrc !== BROKEN_MEDIA_SRC) {
      setFailed(true);
    }
    onError?.(event);
  }

  return <img {...props} alt={alt} src={effectiveSrc} onError={handleError} />;
}

export type SafeVideoProps = VideoHTMLAttributes<HTMLVideoElement>;

/** `<video>` that replaces itself with broken-image.webp on load error. */
export function SafeVideo({ src, onError, className, children, ...props }: SafeVideoProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (failed || !src) {
    return <img src={BROKEN_MEDIA_SRC} alt="" className={className} />;
  }

  function handleError(event: SyntheticEvent<HTMLVideoElement>) {
    setFailed(true);
    onError?.(event);
  }

  return (
    <video {...props} className={className} src={src} onError={handleError}>
      {children}
    </video>
  );
}
