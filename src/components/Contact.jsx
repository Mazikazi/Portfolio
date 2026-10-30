import { useEffect, useRef, useState } from 'react';
import Reveal from './Reveal.jsx';

export default function Contact({ email, links = [] }) {
  const [label, setLabel] = useState('Copy email');
  const mail = useRef(null);
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);

  const flash = (text) => {
    setLabel(text);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setLabel('Copy email'), 1800);
  };
  // Clipboard can be blocked (iframes, old browsers). Fall back to selecting the text.
  const select = () => {
    try {
      const r = document.createRange();
      r.selectNodeContents(mail.current);
      const s = window.getSelection();
      s.removeAllRanges();
      s.addRange(r);
    } catch {
      /* nothing else to try */
    }
    flash('Select the address');
  };
  const copy = () => {
    try {
      navigator.clipboard.writeText(email).then(() => flash('Copied'), select);
    } catch {
      select();
    }
  };

  return (
    <section className="sec" id="contact" aria-label="Contact">
      <div className="wrap">
        <div className="head">
          <Reveal className="label">Contact</Reveal>
          <Reveal as="h2" className="mega">
            Let's build something.
          </Reveal>
        </div>
        <Reveal className="contactRow">
          <a className="pill mail" id="mail" ref={mail} href={`mailto:${email}`}>
            {email}
          </a>
          <button className="pill copy" id="copy" type="button" onClick={copy}>
            {label}
          </button>
          {links.map((l) => (
            <a className="pill copy" key={l.label} href={l.href} target="_blank" rel="noopener noreferrer">
              {l.label}
            </a>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
