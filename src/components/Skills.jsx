import Reveal from './Reveal.jsx';

export default function Skills({ items }) {
  return (
    <section className="sec" id="skills" aria-label="Skills">
      <div className="wrap">
        <div className="head">
          <Reveal className="label">Skills</Reveal>
          <Reveal as="h2" className="mega">
            What I use
          </Reveal>
        </div>
        <div className="cards skills">
          {items.map((g) => (
            <Reveal as="article" className="glass" key={g.title}>
              <div className="core">
                <span className="tag">{g.title}</span>
                <p>{g.items.join(' · ')}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
