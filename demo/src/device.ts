export function deviceLine() {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const ua = navigator.userAgent;
  const browser =
    /Edg\/[\d.]+/.exec(ua)?.[0] ??
    /(?:CriOS|Chrome)\/[\d.]+/.exec(ua)?.[0] ??
    /(?:FxiOS|Firefox)\/[\d.]+/.exec(ua)?.[0] ??
    /Version\/[\d.]+.*Safari/.exec(ua)?.[0].replace(/ .*/, " Safari") ??
    "unknown browser";
  const os =
    [/Android [\d.]+/, /iPhone OS [\d_]+/, /iPad/, /Windows NT [\d.]+/, /Mac OS X [\d_]+/, /Linux/]
      .map((pattern) => pattern.exec(ua)?.[0])
      .find(Boolean) ?? "unknown OS";
  return [
    `${browser}, ${os.replace(/_/g, ".")}`,
    `${navigator.hardwareConcurrency ?? "?"} cores, ${nav.deviceMemory ?? "?"} GB`,
    `${screen.width}x${screen.height}@${devicePixelRatio}`,
    `https=${isSecureContext}, webcodecs=${typeof VideoEncoder !== "undefined"}`,
  ].join(" | ");
}
