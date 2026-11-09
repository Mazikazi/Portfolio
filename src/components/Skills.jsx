import { useEffect, useRef } from 'react';
import Reveal from './Reveal.jsx';
import { LOGOS } from '../assets/logos.js';
import { CLOUD } from '../fx/cloud.js';
import { sketchCascade } from '../fx/cascade.js';

const MIN = 26; // tiles in one loop of a lane, so that a short list still crosses the whole screen (up to 2560 px wide)

// a near-black brand colour (GitHub, SQLite) would vanish on the dark tiles: those get light grey
function tint(hex) {
  const n = parseInt(hex, 16);
  const l = 0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
  return l < 60 ? '#e6e9f1' : '#' + hex;
}

/** One lane of the cascade: logo tiles stacked along a diagonal, sliding along it forever (`rev`: the other way). */
function Lane({ items, k, rev }) {
  const seq = [];
  while (seq.length < MIN) seq.push(...items);
  const tiles = [...seq, ...seq]; // two copies, so the loop never shows its seam
  return (
    <div className={`track${rev ? ' rev' : ''}`} style={{ '--n': seq.length, '--k': k }}>
      {tiles.map((name, i) => {
        const logo = LOGOS[name];
        return (
          <span className="tile" key={i} style={{ '--i': i, '--c': logo ? tint(logo[0]) : '#e6e9f1', zIndex: tiles.length - i }}>
            <b>{name}</b>
            {logo ? (
              <svg viewBox="0 0 24 24">
                <path d={logo[1]} />
              </svg>
            ) : (
              <i>{'{ }'}</i>
            )}
          </span>
        );
      })}
    </div>
  );
}

export default function Skills({ items }) {
  const casc = useRef(null);
  useEffect(() => (CLOUD ? sketchCascade(casc.current) : undefined), []); // the particles draw it, tile by tile
  return (
    <section className="sec" id="skills" aria-label="Skills">
      <div className="wrap">
        <div className="head">
          <Reveal className="label">Skills</Reveal>
          <Reveal as="h2" className="mega">
            What I use
          </Reveal>
        </div>
      </div>
      {/* one isometric cascade, a lane per group of skills, laid over one another */}
      <div
        ref={casc}
        className={`casc${CLOUD ? ' hold' : ''}`}
        role="img"
        aria-label={items.map((g) => `${g.title}: ${g.items.join(', ')}`).join('. ')}
        style={{ '--lanes': items.length }}
      >
        {items.map((g, k) => (
          <Lane key={g.title} items={g.items} k={k} rev={k % 2 === 1} />
        ))}
      </div>
    </section>
  );
}
