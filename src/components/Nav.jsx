import { forwardRef, useEffect, useRef, useState } from 'react';
import { SECTIONS } from '../config.js';
import { useScrollSpy } from '../hooks/useScrollSpy.js';
import { scrollToId } from '../lib/nav.js';

const IDS = SECTIONS.map(([id]) => id);

/** Floating pill nav. The hero engine fades it in (it writes opacity on the ref). */
const Nav = forwardRef(function Nav({ name }, ref) {
  const prog = useRef(null);
  const [open, setOpen] = useState(false);
  const { active } = useScrollSpy(IDS, prog);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const go = (id) => (e) => {
    e.preventDefault();
    setOpen(false);
    scrollToId(id);
  };

  return (
    <>
      <header id="nav" ref={ref}>
        <a className="brand" href="#home" onClick={go('home')}>
          {name}
        </a>
        <nav className="links" aria-label="Sections">
          {SECTIONS.map(([id, label], i) => (
            <a key={id} href={`#${id}`} onClick={go(id)} className={i === active ? 'on' : ''}>
              {label}
            </a>
          ))}
        </nav>
        <button id="menuBtn" type="button" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} aria-controls="sheet" onClick={() => setOpen((o) => !o)}>
          <i />
          <i />
        </button>
        <div id="prog" ref={prog} />
      </header>
      <div id="sheet" className={open ? 'open' : ''}>
        {SECTIONS.map(([id, label], i) => (
          <a key={id} href={`#${id}`} onClick={go(id)} style={{ '--i': i }}>
            {label}
          </a>
        ))}
      </div>
    </>
  );
});

export default Nav;
