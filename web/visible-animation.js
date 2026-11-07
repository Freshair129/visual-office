// Keep animation clocks and scheduled frames idle while the document is hidden.
export function visibleAnimation(doc, request, cancel, draw) {
  let frame = null, last = null, elapsed = 0, disposed = false;
  const step = time => {
    frame = null;
    if (disposed || doc.hidden) return;
    const dt = last === null ? 0 : Math.min(.05, Math.max(0, (time - last) / 1000));
    last = time; elapsed += dt;
    draw(dt, elapsed);
    if (!disposed && !doc.hidden) frame = request(step);
  };
  const change = () => {
    if (doc.hidden) {
      if (frame !== null) cancel(frame);
      frame = null; last = null;
    } else if (!disposed && frame === null) frame = request(step);
  };
  doc.addEventListener('visibilitychange', change);
  change();
  return () => {
    disposed = true;
    doc.removeEventListener('visibilitychange', change);
    if (frame !== null) cancel(frame);
    frame = null;
  };
}

// Three's animation loop needs to be explicitly stopped and its clock reset.
export function visibleThreeLoop(doc, renderer, pacer, draw) {
  let disposed = false;
  const change = () => {
    if (disposed) return;
    if (doc.hidden) renderer.setAnimationLoop(null);
    else {
      pacer.setRate(pacer.rate);
      renderer.setAnimationLoop(draw);
    }
  };
  doc.addEventListener('visibilitychange', change);
  change();
  return () => {
    disposed = true;
    doc.removeEventListener('visibilitychange', change);
    renderer.setAnimationLoop(null);
  };
}

// A new reduced-motion preference stops motion; disabling it does not override
// a user's explicit pause choice.
export function pauseOnReducedMotion(preference, pause) {
  const change = () => { if (preference.matches) pause(); };
  preference.addEventListener?.('change', change);
  return () => preference.removeEventListener?.('change', change);
}
