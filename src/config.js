import portrait from './assets/portrait.jpg';

/*
 * Edit this file to make the site yours.
 * Everything you see on the page comes from here, except the layout.
 */
export const CONFIG = {
  name: 'Mazin Kazi',
  // Shown next to the email in Contact.
  links: [
    { label: 'GitHub', href: 'https://github.com/Mazikazi' },
    { label: 'LinkedIn', href: 'https://www.linkedin.com/in/mazin-kazi' },
  ],
  // Letters that fly in during the intro. Works best with an "I" in it.
  intro: 'MAZIN',
  // Shown in the Contact section. Replace the placeholder with your real address.
  email: 'mazinkazi01@gmail.com',
  // Your portrait (transparent or dark background works best). Replace src/assets/portrait.jpg.
  photo: portrait,
  role: ['React Native', 'Developer'],
  // **double stars** make a word bold.
  about:
    "Hey, I'm **Mazin**. A React Native developer building mobile apps with Expo: offline-first retail and point of sale tools, and inventory software that a car dealership uses every day. I also interned at Udupi Web Solutions, working on the React frontend and FastAPI backend of a recruiting tool.",
  // `href` makes the whole row a link. Rows without one stay plain text.
  projects: [
    {
      name: 'RetailScan Pro',
      desc: 'Offline-first point of sale and inventory app with barcode scanning and UPI QR payments.',
      stack: ['React Native', 'Expo', 'SQLite'],
      result: '17-table schema with a four-tier price hierarchy and multi-location stock.',
      tag: 'Mobile',
      href: 'https://github.com/Mazikazi/RetailScanPro',
    },
    {
      name: 'Lot Manager',
      desc: 'Offline-first inventory app for car dealerships, with profit analytics, custom fields and biometric lock.',
      stack: ['React Native', 'Expo', 'SQLite'],
      result: 'Built solo. Used daily by a car dealership and in closed testing on Google Play.',
      tag: 'Mobile',
      href: 'https://github.com/Mazikazi/LotManager',
    },
    {
      name: 'Keepix',
      desc: 'Android gallery cleanup app: swipe to keep or delete, with a recycle bin. Works fully offline.',
      stack: ['Kotlin', 'Jetpack Compose', 'Room'],
      result: 'Native Android, MVVM, background cleanup with WorkManager.',
      tag: 'Android',
      href: 'https://github.com/Mazikazi/keepix-native',
    },
    { name: 'Velocita', desc: 'Neomorphism style website for a company in Dubai.', tag: 'Web' },
  ],
  services: [
    { tag: 'Mobile', title: 'Mobile apps', text: 'React Native and Expo apps for Android and iOS, from the first screen to the store release.' },
    { tag: 'Business', title: 'Business tools', text: 'Inventory, point of sale and scanning apps that staff can pick up and use without training.' },
    { tag: 'Web', title: 'Websites and UI', text: 'Fast, clean sites with a strong visual style, like the one you are looking at.' },
  ],
  skills: [
    { title: 'Languages', items: ['TypeScript', 'JavaScript', 'Python', 'Kotlin', 'C', 'HTML', 'CSS'] },
    { title: 'Frontend', items: ['React', 'React Native', 'Tailwind CSS'] },
    { title: 'Backend', items: ['FastAPI', 'REST API design', 'Firebase'] },
    { title: 'Databases', items: ['SQLite', 'PostgreSQL', 'MongoDB'] },
    { title: 'Tools', items: ['Git', 'GitHub', 'Razorpay API', 'Google Maps API'] },
  ],
};

export const SECTIONS = [
  ['home', 'Home'],
  ['about', 'About'],
  ['service', 'Service'],
  ['project', 'Project'],
  ['skills', 'Skills'],
  ['contact', 'Contact'],
];
