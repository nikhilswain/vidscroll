const BASE_CSS = `
:where([data-vidscroll]) { position: relative; }
:where([data-vidscroll-stage]) { position: sticky; top: 0; height: 100vh; height: 100svh; overflow: hidden; }
:where([data-vidscroll-media]) { display: block; width: 100%; height: 100%; object-fit: cover; }
:where([data-vidscroll-media][data-fit="contain"]) { object-fit: contain; }
:where([data-vidscroll-overlay]) { position: absolute; inset: 0; pointer-events: none; }
:where([data-vidscroll-section]) { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; opacity: 0; visibility: hidden; transition: opacity 0.4s ease, visibility 0s linear 0.4s; }
:where([data-vidscroll-section][data-active]) { opacity: 1; visibility: visible; pointer-events: auto; transition: opacity 0.4s ease; }
:where([data-vidscroll-loader]) { position: absolute; inset: 0; z-index: 1; display: grid; place-items: center; background: #000; color: #fff; font-family: system-ui, sans-serif; }
`;

export function BaseStyles() {
  return <style>{BASE_CSS}</style>;
}
