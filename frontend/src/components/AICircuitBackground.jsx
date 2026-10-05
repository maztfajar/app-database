import React, { useEffect, useRef } from 'react';

export default function AICircuitBackground() {
  const svgRef = useRef(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const buildCircuit = () => {
      // Clear existing elements
      while (svg.firstChild) {
        svg.removeChild(svg.firstChild);
      }

      const W = window.innerWidth;
      const H = window.innerHeight;
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

      const ns = 'http://www.w3.org/2000/svg';
      const purple = '#7c3aed';

      function line(x1, y1, x2, y2, delay) {
        const l = document.createElementNS(ns, 'path');
        const midx = (x1 + x2) / 2;
        const midy = (y1 + y2) / 2;
        const d = `M${x1},${y1} L${x1},${midy} L${x2},${midy} L${x2},${y2}`;
        l.setAttribute('d', d);
        l.setAttribute('stroke', purple);
        l.setAttribute('stroke-width', '1');
        l.setAttribute('fill', 'none');
        l.setAttribute('opacity', '0.14');
        l.setAttribute('stroke-linecap', 'round');
        svg.appendChild(l);

        // Traveling pulse particle along the path
        const pulse = document.createElementNS(ns, 'circle');
        pulse.setAttribute('r', '2.2');
        pulse.setAttribute('fill', purple);
        pulse.setAttribute('opacity', '0.85');

        const anim = document.createElementNS(ns, 'animateMotion');
        anim.setAttribute('dur', `${6 + Math.random() * 5}s`);
        anim.setAttribute('repeatCount', 'indefinite');
        anim.setAttribute('path', d);
        anim.setAttribute('begin', `${delay}s`);

        const fade = document.createElementNS(ns, 'animate');
        fade.setAttribute('attributeName', 'opacity');
        fade.setAttribute('values', '0;0.9;0.9;0');
        fade.setAttribute('keyTimes', '0;0.1;0.85;1');
        fade.setAttribute('dur', anim.getAttribute('dur'));
        fade.setAttribute('repeatCount', 'indefinite');
        fade.setAttribute('begin', `${delay}s`);

        pulse.appendChild(anim);
        pulse.appendChild(fade);
        svg.appendChild(pulse);
      }

      function node(x, y, delay) {
        const c = document.createElementNS(ns, 'circle');
        c.setAttribute('cx', String(x));
        c.setAttribute('cy', String(y));
        c.setAttribute('r', '3');
        c.setAttribute('fill', purple);
        c.setAttribute('opacity', '0.22');

        const anim = document.createElementNS(ns, 'animate');
        anim.setAttribute('attributeName', 'opacity');
        anim.setAttribute('values', '0.12;0.5;0.12');
        anim.setAttribute('dur', `${3 + Math.random() * 3}s`);
        anim.setAttribute('repeatCount', 'indefinite');
        anim.setAttribute('begin', `${delay}s`);

        c.appendChild(anim);
        svg.appendChild(c);
      }

      // Build a loose grid of circuit nodes/lines
      const cols = 9;
      const rows = 6;
      const points = [];
      for (let i = 0; i <= cols; i++) {
        for (let j = 0; j <= rows; j++) {
          const x = (i / cols) * W + (Math.random() * 40 - 20);
          const y = (j / rows) * H + (Math.random() * 40 - 20);
          points.push([x, y]);
        }
      }

      points.forEach((p, idx) => {
        node(p[0], p[1], Math.random() * 4);
        if (Math.random() > 0.45) {
          const target = points[(idx + 1 + Math.floor(Math.random() * 3)) % points.length];
          line(p[0], p[1], target[0], target[1], Math.random() * 6);
        }
      });
    };

    buildCircuit();
    window.addEventListener('resize', buildCircuit);
    return () => window.removeEventListener('resize', buildCircuit);
  }, []);

  return <svg id="circuit" ref={svgRef} xmlns="http://www.w3.org/2000/svg" />;
}
