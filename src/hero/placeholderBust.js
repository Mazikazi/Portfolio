import { rng } from '../lib/math.js';

/** Draws a generic head-and-shoulders bust. Only used when no photo is set. */
export function drawBust(g) {
  const r = rng(11);
  let gr;
  g.fillStyle = '#000';
  g.fillRect(0, 0, 800, 1000);

  gr = g.createLinearGradient(0, 640, 0, 1000);
  gr.addColorStop(0, '#3a4256');
  gr.addColorStop(1, '#161a22');
  g.fillStyle = gr;
  g.beginPath();
  g.moveTo(30, 1000);
  g.bezierCurveTo(50, 820, 140, 720, 290, 664);
  g.lineTo(510, 664);
  g.bezierCurveTo(660, 720, 750, 820, 770, 1000);
  g.closePath();
  g.fill();

  g.fillStyle = '#4b556b';
  g.beginPath();
  g.moveTo(290, 664);
  g.lineTo(392, 880);
  g.lineTo(300, 1000);
  g.lineTo(170, 1000);
  g.closePath();
  g.fill();
  g.beginPath();
  g.moveTo(510, 664);
  g.lineTo(408, 880);
  g.lineTo(500, 1000);
  g.lineTo(630, 1000);
  g.closePath();
  g.fill();

  g.fillStyle = '#e4e9f1';
  g.beginPath();
  g.moveTo(322, 650);
  g.lineTo(478, 650);
  g.lineTo(400, 890);
  g.closePath();
  g.fill();

  g.fillStyle = '#9aa6bf';
  g.beginPath();
  g.moveTo(384, 690);
  g.lineTo(416, 690);
  g.lineTo(430, 820);
  g.lineTo(400, 940);
  g.lineTo(370, 820);
  g.closePath();
  g.fill();

  gr = g.createLinearGradient(0, 470, 0, 660);
  gr.addColorStop(0, '#59627a');
  gr.addColorStop(1, '#8c96ab');
  g.fillStyle = gr;
  g.fillRect(335, 470, 130, 190);

  g.fillStyle = '#6a7388';
  g.beginPath();
  g.ellipse(268, 370, 18, 40, 0, 0, 7);
  g.fill();
  g.beginPath();
  g.ellipse(532, 370, 18, 40, 0, 0, 7);
  g.fill();

  gr = g.createRadialGradient(350, 300, 20, 400, 340, 230);
  gr.addColorStop(0, '#f1f4fa');
  gr.addColorStop(0.55, '#a7b0c3');
  gr.addColorStop(1, '#444c60');
  g.fillStyle = gr;
  g.beginPath();
  g.ellipse(400, 350, 132, 172, 0, 0, 7);
  g.fill();

  g.fillStyle = '#1b1f29';
  g.beginPath();
  g.ellipse(400, 235, 148, 120, 0, Math.PI, 0);
  g.lineTo(520, 262);
  g.quadraticCurveTo(400, 214, 280, 262);
  g.closePath();
  g.fill();

  for (let i = 0; i < 2600; i++) {
    g.fillStyle = 'rgba(255,255,255,' + r() * 0.09 + ')';
    g.fillRect(r() * 800, r() * 1000, 3, 3);
  }
}
