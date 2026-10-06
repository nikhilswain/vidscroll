export const styles = `
:where([data-vidscroll]) { position: relative; }
:where([data-vidscroll-stage]) { position: sticky; top: 0; height: 100vh; height: 100svh; overflow: hidden; background: #000; }
:where([data-vidscroll-media]) { display: block; width: 100%; height: 100%; object-fit: cover; }
:where([data-vidscroll-media][data-fit="contain"]) { object-fit: contain; }
:where([data-vidscroll-preview]) { position: absolute; inset: 0; }
:where([data-vidscroll-next]) { position: absolute; inset: 0; z-index: -1; }
:where([data-vidscroll-overlay]) { position: absolute; inset: 0; pointer-events: none; }
:where([data-vidscroll-section]) { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; opacity: 0; visibility: hidden; transition: opacity 0.4s ease, visibility 0s linear 0.4s; }
:where([data-vidscroll-section][data-active]) { opacity: 1; visibility: visible; pointer-events: auto; transition: opacity 0.4s ease; }
:where([data-vidscroll-loader]) { position: absolute; inset: 0; z-index: 1; display: grid; place-items: center; background: rgb(0 0 0 / 0.55); color: #fff; font-family: system-ui, sans-serif; }
:where([data-vidscroll-loader][data-background]) { inset: auto 16px 16px auto; padding: 8px 14px; border-radius: 999px; pointer-events: none; }
`;

export function injectStyles() {
  if (typeof document === "undefined" || document.querySelector("style[data-vidscroll-styles]")) return;
  const style = document.createElement("style");
  style.setAttribute("data-vidscroll-styles", "");
  style.textContent = styles;
  document.head.prepend(style);
}
