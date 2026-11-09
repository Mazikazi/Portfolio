import { useEffect, useState } from 'react';

/**
 * Tracks scroll position for the nav: whether the page has scrolled, which
 * section is current, and how far down the page we are (0 to 100).
 */
export function useScrollSpy(ids, progressRef) {
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const els = ids.map((id) => document.getElementById(id));
    const onScroll = () => {
      const y = window.scrollY || 0;
      const H = document.documentElement.scrollHeight - window.innerHeight;
      const probe = y + window.innerHeight * 0.4;
      let cur = 0;
      els.forEach((s, i) => {
        if (s && s.offsetTop <= probe) cur = i;
      });
      // a transform, not the width: a width change makes the browser lay out the page again on every scroll
      if (progressRef.current) progressRef.current.style.transform = `scaleX(${H > 0 ? y / H : 0})`;
      setScrolled(y > 40);
      setActive(cur);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [ids, progressRef]);

  return { scrolled, active };
}
