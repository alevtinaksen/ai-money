import { useEffect, useState } from 'react';

export function useVisibleViewport() {
  const [viewport, setViewport] = useState<{ height: number; top: number } | null>(null);
  useEffect(() => {
    const visible = window.visualViewport;
    if (!visible) return;
    // iOS keyboard reduces the visible viewport without shrinking 100dvh.
    const sync = () => setViewport({ height: visible.height, top: visible.offsetTop });
    sync(); visible.addEventListener('resize', sync); visible.addEventListener('scroll', sync);
    return () => { visible.removeEventListener('resize', sync); visible.removeEventListener('scroll', sync); };
  }, []);
  return viewport;
}
