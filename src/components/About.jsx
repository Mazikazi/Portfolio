import { useMemo } from 'react';
import Reveal from './Reveal.jsx';
import { useReveal } from '../hooks/useReveal.js';
import { useWordReveal } from '../hooks/useWordReveal.js';

/** Splits "Hey, I'm **Mazin**." into words and marks the starred ones as bold. */
function parseWords(text) {
  return text.split(' ').map((w) => {
    const m = /^(.*?)\*\*(.+?)\*\*(.*)$/.exec(w);
    return m ? { text: m[1] + m[2] + m[3], bold: true } : { text: w, bold: false };
  });
}

export default function About({ text }) {
  const words = useMemo(() => parseWords(text), [text]);
  const [cardRef, shown] = useReveal();
  const lit = useWordReveal(cardRef, words.length);

  return (
    <section className="sec" id="about" aria-label="About me">
      <div className="wrap">
        <div className="grid">
          <Reveal className="label">About me</Reveal>
          <Reveal as="h2" className="mega">
            Intro
          </Reveal>
          <div className={`card glass rv${shown ? ' in' : ''}`} ref={cardRef}>
            <div className="core">
              <p id="aboutText">
                {words.map((w, i) => (
                  <span key={i}>
                    <span className={`w${w.bold ? ' b' : ''}${i < lit ? ' on' : ''}`}>{w.text}</span>
                    {i < words.length - 1 ? ' ' : ''}
                  </span>
                ))}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
