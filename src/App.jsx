import { useCallback, useRef } from 'react';
import { CONFIG } from './config.js';
import Hero from './hero/Hero.jsx';
import Nav from './components/Nav.jsx';
import About from './components/About.jsx';
import Services from './components/Services.jsx';
import Projects from './components/Projects.jsx';
import Skills from './components/Skills.jsx';
import Contact from './components/Contact.jsx';

export default function App() {
  const navRef = useRef(null);
  const getNav = useCallback(() => navRef.current, []);
  return (
    <>
      <Nav ref={navRef} name={CONFIG.name} />
      <main>
        <Hero config={CONFIG} getNav={getNav} />
        <About text={CONFIG.about} />
        <Services items={CONFIG.services} />
        <Projects items={CONFIG.projects} />
        <Skills items={CONFIG.skills} />
        <Contact email={CONFIG.email} links={CONFIG.links} />
      </main>
      <footer>
        <span>
          © {new Date().getFullYear()} {CONFIG.name}
        </span>
        <span>Built with React and Vite.</span>
      </footer>
    </>
  );
}
