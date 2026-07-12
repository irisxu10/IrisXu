// Shared portfolio project metadata.
//
// This file stores content metadata only — titles, years, descriptions,
// links, and existing preview media. It intentionally contains no canvas
// coordinates, bubble radii, physics values, animation timing, or CSS
// classes. Those belong to whatever rendering layer eventually consumes
// this data (canvas ecosystem, HTML archive, or mobile/reduced-motion
// fallback), not to the data itself.

window.PORTFOLIO_PROJECTS = Object.freeze([
  {
    order: 1,
    id: "coffee-cup",
    title: "What’s in Your Coffee Cup?",
    shortTitle: "Coffee Cup",
    year: "2025",
    section: "mdp",
    lenses: ["systems", "interfaces", "materials"],
    keywords: ["data visualization", "memory", "emotion", "habit", "coffee rituals"],
    tools: ["p5.js", "HTML"],
    description: "Coffee moments—volume, flavor, time, and mood—translated into generative visual patterns and printed onto acrylic and coffee-stained canvas.",
    preview: {
      type: "image",
      src: "assets/C.jpg",
      alt: "Coffee Project Preview"
    },
    destination: {
      href: "mdp/coffee.html",
      external: false
    },
    secondaryLinks: [
      {
        label: "Live Demo",
        href: "https://irisxu10.github.io/XXU_Artcenter/Dev4_Coffee/index.html",
        external: true
      }
    ],
    accent: "coffee",
    status: "complete",
    featured: true
  },
  {
    order: 2,
    id: "cono",
    title: "CONO",
    shortTitle: "CONO",
    year: "2025",
    section: "mdp",
    lenses: ["systems", "interfaces"],
    keywords: ["UI/UX", "coffee community", "journaling", "reflection"],
    tools: [],
    description: "A journaling app that gives coffee lovers and professionals a quiet space to log brews, reflect, and connect with a like-minded community.",
    preview: {
      type: "image",
      src: "assets/CONO.png",
      alt: "CONO coffee journaling app case study poster with phone mockup screens"
    },
    destination: {
      href: "mdp/cono.html",
      external: false
    },
    secondaryLinks: [],
    accent: "cono",
    status: "complete",
    featured: true
  },
  {
    order: 3,
    id: "artquest-getty",
    title: "ArtQuest at Getty",
    shortTitle: "ArtQuest",
    year: "2024",
    section: "mdp",
    lenses: ["systems", "interfaces", "materials", "playful-tools"],
    keywords: ["museum wayfinding", "game design", "exploration", "tangible design"],
    tools: [],
    description: "A playful, card-based wayfinding system that turns a Getty Museum visit into spontaneous exploration and discovery.",
    preview: {
      type: "image",
      src: "assets/G1.jpg",
      alt: "ArtQuest at Getty task and artwork cards arranged for gameplay on a table"
    },
    destination: {
      href: "mdp/artquest.html",
      external: false
    },
    secondaryLinks: [],
    accent: "getty",
    status: "complete",
    featured: true
  },
  {
    order: 4,
    id: "sofa-and-i",
    title: "The Sofa and I",
    shortTitle: "The Sofa and I",
    year: "2025",
    section: "mdp",
    lenses: ["materials"],
    keywords: ["long exposure", "memory", "embodiment", "time", "self-portraiture"],
    tools: [],
    description: "A long-exposure self-portrait series alternating motion and stillness to let multiple versions of the self appear in one frame.",
    preview: {
      type: "image",
      src: "assets/S0.jpg",
      alt: "Long exposure self-portrait"
    },
    destination: {
      href: "mdp/exposure.html",
      external: false
    },
    secondaryLinks: [],
    accent: "exposure",
    status: "complete",
    featured: true
  },
  {
    order: 5,
    id: "letter-from-your-cat",
    title: "A Letter from Your Cat",
    shortTitle: "Letter from Your Cat",
    year: "2024",
    section: "mdp",
    lenses: ["speculative-worlds", "playful-tools", "nonhuman-perspectives"],
    keywords: ["fictional language", "typography", "cats", "worldbuilding"],
    tools: [],
    description: "A fictional writing system based on cat claw marks, imagined as a language feline elders created to reconnect with humans.",
    preview: {
      type: "image",
      src: "assets/Cat.png",
      alt: "A Letter from Your Cat"
    },
    destination: {
      href: "mdp.html#catletter",
      external: false
    },
    secondaryLinks: [],
    accent: "catstar",
    status: "summary-only",
    featured: true
  },
  {
    order: 6,
    id: "creative-tech-playground",
    title: "Creative Technology Playground",
    shortTitle: "Tech Playground",
    year: "2024–2025",
    section: "mdp",
    lenses: ["systems", "interfaces", "materials", "playful-tools"],
    keywords: ["creative technology", "experimentation", "multi-tool practice"],
    tools: ["HTML/CSS", "p5.js", "Arduino", "Blender", "Unity", "TouchDesigner"],
    description: "A growing archive of creative-technology experiments spanning HTML/CSS, p5.js, Arduino, Blender, Unity, and TouchDesigner.",
    preview: {
      type: "video",
      src: "assets/handpose.mp4",
      alt: "Video demo of a hand-pose creative-technology experiment from the playground archive"
    },
    destination: {
      href: "https://irisxu10.github.io/XXU_Artcenter/CT2/index.html",
      external: true
    },
    secondaryLinks: [],
    accent: "tech",
    status: "external-only",
    featured: true
  }
]);
