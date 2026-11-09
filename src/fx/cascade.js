import { active, SKETCH_SHOW } from './cloud.js';

/*
 * The particle cloud draws the skills cascade (Skills.jsx), a tile at a time. Its lanes stand still and its tiles are
 * hidden (the `hold` class, see styles.css). Lane by lane from the top, once a lane is on screen, a group of particles
 * flies out to each of its tiles in turn, from the top right one down to the bottom left one, and draws its outline and
 * logo; the tile fades in where they land. When the whole lane is drawn it starts sliding (`go`), and the next lane
 * waits for its turn. Without a running cloud everything is simply shown.
 */

const STEP = 0.4; // seconds between two tiles
const SKEW = Math.tan(Math.PI / 6); // the tiles are skewed 30°

/** Points (page px) on a tile as it stands now: about two fifths on its rounded outline, the rest on its logo. */
function inkOfTile(tile) {
  const t = tile.offsetWidth;
  const r = tile.getBoundingClientRect();
  const cx = (r.left + r.right) / 2;
  const cy = (r.top + r.bottom) / 2;
  // a point of the unskewed tile (0..t) to the page: the skew (about the middle) moves it down by its x times tan 30°
  const page = (u, v) => [cx + u - t / 2 + window.scrollX, cy + v - t / 2 + (u - t / 2) * SKEW + window.scrollY];
  // where a child sits in the unskewed tile, worked back from its (skewed) bounding box
  const box = (el) => {
    const b = el.getBoundingClientRect();
    const x = b.left - (cx - t / 2);
    return [x, b.top - cy + t / 2 - (x - t / 2) * SKEW, b.width];
  };

  const cv = document.createElement('canvas');
  cv.width = cv.height = Math.ceil(t);
  const g = cv.getContext('2d', { willReadFrequently: true });
  const sample = (n) => {
    const d = g.getImageData(0, 0, cv.width, cv.height).data;
    const all = [];
    for (let i = 3, j = 0; i < d.length; i += 4, j++) if (d[i] > 100) all.push(j);
    g.clearRect(0, 0, cv.width, cv.height);
    const out = [];
    for (let k = 0; k < n && all.length; k++) {
      const j = all[Math.floor(Math.random() * all.length)];
      out.push(...page((j % cv.width) + 0.5, Math.floor(j / cv.width) + 0.5));
    }
    return out;
  };

  g.strokeStyle = g.fillStyle = '#fff';
  g.lineWidth = 2;
  g.beginPath();
  g.roundRect(1, 1, t - 2, t - 2, parseFloat(getComputedStyle(tile).borderTopLeftRadius) || 0);
  g.stroke();
  const pts = sample(120);

  const svg = tile.querySelector('svg');
  if (svg) {
    const [x, y, w] = box(svg);
    g.translate(x, y);
    g.scale(w / 24, w / 24);
    g.fill(new Path2D(svg.querySelector('path').getAttribute('d')));
    g.setTransform(1, 0, 0, 1, 0, 0);
  } else {
    const glyph = tile.querySelector('i'); // a skill without a logo shows "{ }"
    const [x, y, w] = box(glyph);
    const cs = getComputedStyle(glyph);
    g.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(glyph.textContent, x + w / 2, y + parseFloat(cs.lineHeight) / 2);
  }
  return pts.concat(sample(180));
}

/** Runs the drawing of the cascade `el`. Returns the cleanup. */
export function sketchCascade(el) {
  const lanes = [...el.querySelectorAll('.track')];
  const timers = [];
  const later = (s, fn) => timers.push(setTimeout(fn, s * 1000));
  const show = (tile) => tile.classList.add('in');
  const go = (lane) => {
    lane.querySelectorAll('.tile').forEach(show);
    lane.classList.add('go');
  };

  const run = (k) => {
    const lane = lanes[k];
    if (!lane) return;
    if (!active) return lanes.slice(k).forEach(go); // no particles after all: show the rest
    // the tiles that can be seen (the others are outside the block or in its faded edges), top right first
    const b = el.getBoundingClientRect();
    const tiles = [...lane.children]
      .map((tile) => [tile, tile.getBoundingClientRect()])
      .filter(([, r]) => {
        const x = (r.left + r.right) / 2 - b.left;
        const y = (r.top + r.bottom) / 2;
        return x > 0.04 * b.width && x < 0.96 * b.width && y > b.top && y < b.bottom;
      })
      .sort((p, q) => q[1].left - p[1].left)
      .map(([tile, r]) => [tile, (r.top + r.bottom) / 2 - b.top]); // its middle, from the top of the block
    if (!tiles.length) {
      go(lane);
      return run(k + 1);
    }
    // wait until the lane's first tile is on screen; a lane already scrolled past is shown at once
    const wait = () => {
      const top = el.getBoundingClientRect().top;
      if (top + tiles[tiles.length - 1][1] < 0) {
        go(lane);
        return run(k + 1);
      }
      if (top + tiles[0][1] > 0.75 * window.innerHeight) return later(0.15, wait);
      tiles.forEach(([tile], j) =>
        later(j * STEP, () => {
          if (!active) return show(tile);
          active.sketch(inkOfTile(tile));
          later(SKETCH_SHOW, () => show(tile));
        })
      );
      later((tiles.length - 1) * STEP + SKETCH_SHOW + 0.2, () => {
        go(lane);
        run(k + 1);
      });
    };
    wait();
  };

  // start when the cascade comes near the screen
  const io = new IntersectionObserver((es) => {
    if (!es.some((e) => e.isIntersecting)) return;
    io.disconnect();
    run(0);
  });
  io.observe(el);
  return () => {
    io.disconnect();
    timers.forEach(clearTimeout);
  };
}
