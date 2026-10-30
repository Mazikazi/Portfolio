import Reveal from './Reveal.jsx';

export default function Projects({ items }) {
  return (
    <section className="sec" id="project" aria-label="Project">
      <div className="wrap">
        <div className="head">
          <Reveal className="label">Project</Reveal>
          <Reveal as="h2" className="mega">
            Selected work
          </Reveal>
        </div>
        <div className="rows" id="rows">
          {items.map((p) => (
            <Reveal
              as={p.href ? 'a' : 'div'}
              className={p.href ? 'row link' : 'row'}
              key={p.name}
              {...(p.href && { href: p.href, target: '_blank', rel: 'noopener noreferrer', 'aria-label': `${p.name} on GitHub (opens in a new tab)` })}
            >
              <div>
                <h3>{p.name}</h3>
                <p>{p.desc}</p>
                {p.result && <p className="result">{p.result}</p>}
                {p.stack && <p className="stack">{p.stack.join(' · ')}</p>}
              </div>
              <div className="meta">
                <span>{p.tag}</span>
                {p.href && (
                  <span className="arrow" aria-hidden="true">
                    <svg width="40%" height="40%" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 8h10M9 4l4 4-4 4" />
                    </svg>
                  </span>
                )}
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
