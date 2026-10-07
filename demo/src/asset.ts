export const ASSET_BASE: string = import.meta.env.VITE_ASSET_BASE;

export const ON_SITE = ASSET_BASE !== import.meta.env.BASE_URL;

export const asset = (path: string) => `${ASSET_BASE.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
