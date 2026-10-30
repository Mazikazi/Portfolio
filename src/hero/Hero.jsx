import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { HeroEngine } from './engine.js';
import { scrollToId } from '../lib/nav.js';

/**
 * The intro. React renders the markup; HeroEngine (a plain class) animates it
 * every frame by writing styles straight to these elements. React never
 * re-renders per frame, which keeps the animation smooth.
 */
export default function Hero({ config, getNav }) {
  const heroRef = useRef(null);
  const els = useRef({ gl: [] });
  const engineRef = useRef(null);
  // `v` makes every call create fresh letters, so old inline styles never leak across words.
  const [title, setTitle] = useState({ text: config.intro, v: 0 });
  const [photoLabel, setPhotoLabel] = useState('Use your photo');
  const fileRef = useRef(null);

  const set = (name) => (el) => {
    els.current[name] = el;
  };

  useEffect(() => {
    const e = els.current;
    let v = 0;
    const engine = new HeroEngine({
      els: { ...e, hero: heroRef.current },
      config,
      setTitleText: (text) => flushSync(() => setTitle({ text, v: ++v })),
      getNav,
      onPhotoLabel: setPhotoLabel,
    });
    engineRef.current = engine;
    engine.init();
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const go = (id) => (ev) => {
    ev.preventDefault();
    scrollToId(id);
  };

  return (
    <section id="home" aria-label="Home" ref={heroRef}>
      <h1 className="sr">
        {config.name}, {config.role.join(' ')}
      </h1>
      <div id="glowBg" />
      <div id="stage">
        <div id="pivotG" ref={set('pivotG')}>
          <div id="title" ref={set('title')} aria-hidden="true">
            {Array.from(title.text).map((ch, i) => (
              <span className="c" key={`${title.v}:${i}`}>
                {ch}
              </span>
            ))}
            <span className="bl" />
          </div>
        </div>
        <div id="pivotS" ref={set('pivotS')}>
          {[0, 1, 2, 3].map((i) => (
            <div className="glow" id={`gl${i}`} key={i} ref={(el) => (els.current.gl[i] = el)} />
          ))}
          <div id="dot" ref={set('dot')} />
          <div id="stemRot" ref={set('stemRot')}>
            <div id="stem" ref={set('stem')} />
          </div>
        </div>
      </div>
      <div id="sub" ref={set('sub')}>
        <b>{config.role[0]}</b> <i>{config.role[1]}</i>
      </div>
      <div id="cta" ref={set('cta')}>
        <a className="pill round" id="down" href="#about" onClick={go('about')} aria-label="Scroll to About" ref={set('down')}>
          <svg width="40%" height="40%" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 4 4 12M4 6v6h6" />
          </svg>
        </a>
        <a className="pill" id="contactPill" href="#contact" onClick={go('contact')} ref={set('pill')}>
          Contact
        </a>
      </div>
      <canvas id="cv" aria-hidden="true" ref={set('cv')} />
      <button id="skip" type="button" ref={set('skipBtn')} onClick={() => engineRef.current && engineRef.current.skip()}>
        Skip intro
      </button>
      <label
        id="photoBtn"
        htmlFor="photoIn"
        tabIndex={0}
        ref={set('photoBtn')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            fileRef.current && fileRef.current.click();
          }
        }}
      >
        {photoLabel}
      </label>
      <input
        id="photoIn"
        type="file"
        accept="image/*"
        hidden
        ref={fileRef}
        onChange={(e) => {
          const f = e.target.files && e.target.files[0];
          if (f && engineRef.current) engineRef.current.loadFile(f);
          e.target.value = '';
        }}
      />
    </section>
  );
}
