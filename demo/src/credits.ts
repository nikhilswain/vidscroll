export interface Credit {
  work: string;
  author: string;
  href: string;
  license?: { name: string; href: string };
  host?: { name: string; href: string };
  note?: string;
}

export const TRAIN_CREDIT: Credit = {
  work: "30 second animation assignment",
  author: "roenais",
  href: "https://www.youtube.com/watch?v=_Td7JjCTfyc",
};

export const SPRING_CREDIT: Credit = {
  work: "Spring",
  author: "Blender Foundation | studio.blender.org",
  href: "https://studio.blender.org/films/spring/",
  license: { name: "CC BY 4.0", href: "https://creativecommons.org/licenses/by/4.0/" },
  host: { name: "jsDelivr", href: "https://www.jsdelivr.com" },
  note: "Excerpt (5:42 to 6:34), re-encoded without audio",
};

export const SINTEL_CREDIT: Credit = {
  work: "Sintel",
  author: "Blender Foundation | durian.blender.org",
  href: "https://durian.blender.org",
  license: { name: "CC BY 3.0", href: "https://creativecommons.org/licenses/by/3.0/" },
  host: { name: "test-videos.co.uk", href: "https://test-videos.co.uk" },
};
