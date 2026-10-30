import Reveal from './Reveal.jsx';

export default function Services({ items }) {
  return (
    <section className="sec" id="service" aria-label="Service">
      <div className="wrap">
        <div className="head">
          <Reveal className="label">Service</Reveal>
          <Reveal as="h2" className="mega">
            What I build
          </Reveal>
        </div>
        <div className="cards">
          {items.map((s) => (
            <Reveal as="article" className="glass" key={s.title}>
              <div className="core">
                <span className="tag">{s.tag}</span>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
