import type { ReactNode } from 'react';

export type IconName =
  | 'brand'
  | 'plus'
  | 'play'
  | 'pause'
  | 'next'
  | 'previous'
  | 'shuffle'
  | 'repeat'
  | 'volume'
  | 'mute'
  | 'close'
  | 'up'
  | 'down'
  | 'trash'
  | 'edit'
  | 'menu'
  | 'music'
  | 'grip'
  | 'refresh'
  | 'chevron';

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
}

export function Icon({ name, size = 20, className }: IconProps) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeWidth: 1.8,
  };

  let shape: ReactNode;
  switch (name) {
    case 'brand':
      shape = (
        <>
          <path d="M4 7h5l6 10h5" />
          <path d="M4 17h5l6-10h5" />
          <circle cx="4" cy="7" r="1.4" fill="currentColor" stroke="none" />
          <circle cx="20" cy="17" r="1.4" fill="currentColor" stroke="none" />
        </>
      );
      break;
    case 'plus':
      shape = (
        <>
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </>
      );
      break;
    case 'play':
      shape = <path d="m8 5 11 7-11 7z" fill="currentColor" stroke="none" />;
      break;
    case 'pause':
      shape = (
        <>
          <path d="M8 5v14" />
          <path d="M16 5v14" />
        </>
      );
      break;
    case 'next':
      shape = (
        <>
          <path d="m5 5 10 7-10 7z" />
          <path d="M19 5v14" />
        </>
      );
      break;
    case 'previous':
      shape = (
        <>
          <path d="m19 5-10 7 10 7z" />
          <path d="M5 5v14" />
        </>
      );
      break;
    case 'shuffle':
      shape = (
        <>
          <path d="m16 3 4 4-4 4" />
          <path d="M4 7h3c5 0 5 10 10 10h3" />
          <path d="m16 13 4 4-4 4" />
          <path d="M4 17h3c1.4 0 2.4-1 3.2-2.3" />
          <path d="M13 9.3c.9-1.3 2-2.3 4-2.3h3" />
        </>
      );
      break;
    case 'repeat':
      shape = (
        <>
          <path d="m17 2 4 4-4 4" />
          <path d="M3 11V9a3 3 0 0 1 3-3h15" />
          <path d="m7 22-4-4 4-4" />
          <path d="M21 13v2a3 3 0 0 1-3 3H3" />
        </>
      );
      break;
    case 'volume':
      shape = (
        <>
          <path d="M4 10v4h4l5 4V6l-5 4z" />
          <path d="M17 9a5 5 0 0 1 0 6" />
          <path d="M19 6a9 9 0 0 1 0 12" />
        </>
      );
      break;
    case 'mute':
      shape = (
        <>
          <path d="M4 10v4h4l5 4V6l-5 4z" />
          <path d="m17 9 5 6" />
          <path d="m22 9-5 6" />
        </>
      );
      break;
    case 'close':
      shape = (
        <>
          <path d="m6 6 12 12" />
          <path d="M18 6 6 18" />
        </>
      );
      break;
    case 'up':
      shape = (
        <>
          <path d="m6 14 6-6 6 6" />
        </>
      );
      break;
    case 'down':
      shape = (
        <>
          <path d="m6 10 6 6 6-6" />
        </>
      );
      break;
    case 'trash':
      shape = (
        <>
          <path d="M4 7h16" />
          <path d="M10 11v6M14 11v6" />
          <path d="m6 7 1 13h10l1-13" />
          <path d="M9 7V4h6v3" />
        </>
      );
      break;
    case 'edit':
      shape = (
        <>
          <path d="m4 16-.8 4.8L8 20l11-11a3 3 0 0 0-4-4z" />
          <path d="m13.5 6.5 4 4" />
        </>
      );
      break;
    case 'menu':
      shape = (
        <>
          <path d="M4 7h16" />
          <path d="M4 12h16" />
          <path d="M4 17h16" />
        </>
      );
      break;
    case 'music':
      shape = (
        <>
          <path d="M9 18V5l12-2v13" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="18" cy="16" r="3" />
        </>
      );
      break;
    case 'grip':
      shape = (
        <>
          <circle cx="9" cy="6" r="1" />
          <circle cx="15" cy="6" r="1" />
          <circle cx="9" cy="12" r="1" />
          <circle cx="15" cy="12" r="1" />
          <circle cx="9" cy="18" r="1" />
          <circle cx="15" cy="18" r="1" />
        </>
      );
      break;
    case 'refresh':
      shape = (
        <>
          <path d="M20 7v5h-5" />
          <path d="M4 17v-5h5" />
          <path d="M6 9a7 7 0 0 1 12-2l2 2" />
          <path d="M18 15a7 7 0 0 1-12 2l-2-2" />
        </>
      );
      break;
    case 'chevron':
      shape = <path d="m9 18 6-6-6-6" />;
      break;
  }

  return (
    <svg
      aria-hidden="true"
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      {...common}
    >
      {shape}
    </svg>
  );
}
