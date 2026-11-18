/* ==========================================================================
   ADAPTIVE SURFACES — CONTENT
   --------------------------------------------------------------------------
   All presentation text, artwork file paths and feature positions live here.
   Edit this file to change wording or to point a placeholder at real artwork.
   Nothing else needs to change when you drop your PNGs into /assets.
   ========================================================================== */

window.AS = window.AS || {};

/* --------------------------------------------------------------------------
   PRESENTATION SETTINGS
   -------------------------------------------------------------------------- */
AS.config = {
  scrollSpeed: 1,      // how far one wheel / trackpad movement travels. 0.7 = slower, 1.3 = faster
  glide: 0.075,        // camera easing per frame (0.05 = slower and softer, 0.12 = quicker)
  snapRange: 0.22,     // when scrolling stops within this distance of a stop (in screen
                       // widths), the camera settles onto it. 0 = never settle.
  featured: 'snake',   // which note the security demo opens with: turtle | thorny | chameleon | gecko | snake
};

/* --------------------------------------------------------------------------
   THE WORLD — one continuous horizontal surface.
   All positions are in screen widths (1 = one full viewport width).
   -------------------------------------------------------------------------- */
AS.WORLD = {
  // Where each zone sits along the surface. w = its width.
  frames: {
    opening:   { x: 0,     w: 1 },
    concept:   { x: 1.05,  w: 1.5 },
    columns:   { x: 2.75,  w: 1 },
    respond:   { x: 8.05,  w: 1 },
    translate: { x: 9.4,   w: 1 },
    closing:   { x: 10.7,  w: 1 },
  },

  // The five-column zone is held in place for `length` while the camera keeps
  // travelling. That travel drives the animal → banknote → family sequence.
  pin: { frame: 'columns', start: 2.75, length: 4.0 },
  transform: { start: 0.3, every: 0.5, span: 0.4 },   // strip i transforms over [start + i·every, + span]
  release:   { start: 3.0, span: 0.9 },               // the five columns open into the family

  // Presentation stops: → / ← move between these. Scrolling glides freely and
  // settles on the nearest one when close (snapRange).
  stops: [
    0,        // opening
    1.05,     // concept
    1.8,      // "What if a banknote could behave the same way?"
    2.75,     // five animals — pause
    3.5,      // turtle → banknote
    4.0,      // thorny devil → banknote
    4.5,      // chameleon → banknote
    5.0,      // gecko → banknote
    5.5,      // snake → banknote (family complete)
    6.75,     // family composition
    8.05,     // interactive security
    9.4,      // biology → security
    10.7,     // closing
  ],

  // Chapter label shown above the progress line, from this position onward
  chapters: [
    [0,    'origin'],
    [2.3,  'adaptation'],
    [3.2,  'surface'],
    [5.9,  'family'],
    [7.5,  'security'],
    [10.2, 'family'],
  ],

  // Recurring security-thread motif: camera positions at which a thin thread
  // crosses the centre of the screen (placed between zones, never over text at a stop)
  // A number, or [position, opacity] for a fainter one (default opacity 0.38).
  threads: [0.5, 2.15, 7.4, [8.75, 0.16], [10.05, 0.16]],
};

/* --------------------------------------------------------------------------
   CHAPTERS — small label above the progress line
   -------------------------------------------------------------------------- */
AS.chapters = {
  origin: 'Origin',
  adaptation: 'Adaptation',
  surface: 'Surface',
  family: 'Family',
  security: 'Security',
};

/* --------------------------------------------------------------------------
   THE FIVE NOTES
   ARTWORK: replace front / back paths here (or keep the names and drop the
   files into /assets). Missing files automatically show a labelled placeholder.
   -------------------------------------------------------------------------- */
AS.notes = [
  {
    id: 'turtle', value: '1', code: '01',
    species: 'Turtle', strategy: 'Protection', verb: 'Protect',
    response: 'Layered / concealed information',
    accent: '#0F5560',                       // deep teal
    front: 'assets/turtle-front.png',
    back:  'assets/turtle-back.png',
    // Five-column zone: animal photography and its short line
    photo: 'assets/turtle-photo.jpg',
    line: 'Carry your own protected space.',
    idea: 'The shell creates a portable boundary between the body and its environment.',   // not shown at the moment (kept for later use)
    focus: '58% 46%',      // point the photo zooms into as it becomes the banknote
  },
  {
    id: 'thorny', value: '5', code: '05',
    species: 'Thorny Devil', strategy: 'Collection', verb: 'Collect',
    response: 'Information gathered through interaction',
    accent: '#A88A4E',                       // metallic gold
    front: 'assets/thorny-front.png',
    back:  'assets/thorny-back.png',
    // Five-column zone: animal photography and its short line
    photo: 'assets/thorny-devil-photo.jpg',
    line: 'The surface collects and guides resources.',
    idea: 'Microscopic channels across the skin help collect and transport water.',   // not shown at the moment (kept for later use)
    focus: '46% 52%',      // point the photo zooms into as it becomes the banknote
  },
  {
    id: 'chameleon', value: '10', code: '10',
    species: 'Chameleon', strategy: 'Camouflage', verb: 'Camouflage',
    response: 'Color and optical change',
    accent: '#3B98A8',                       // cyan
    front: 'assets/chameleon-front.png',
    back:  'assets/chameleon-back.png',
    // Five-column zone: animal photography and its short line
    photo: 'assets/chameleon-photo.jpg',
    line: 'Change in response to the environment.',
    idea: 'Color, vision, and surface become tools for adapting to changing conditions.',   // not shown at the moment (kept for later use)
    focus: '62% 48%',      // point the photo zooms into as it becomes the banknote
  },
  {
    id: 'gecko', value: '20', code: '20',
    species: 'Gecko', strategy: 'Grip', verb: 'Grip',
    response: 'Tactile surface',
    accent: '#5D4E8C',                       // violet
    front: 'assets/gecko-front.png',
    back:  'assets/gecko-back.png',
    // Five-column zone: animal photography and its short line
    photo: 'assets/gecko-photo.jpg',
    line: 'Find support and hold on.',
    idea: 'Microscopic structures on the feet allow the gecko to attach to surfaces.',   // not shown at the moment (kept for later use)
    focus: '52% 58%',      // point the photo zooms into as it becomes the banknote
  },
  {
    id: 'snake', value: '100', code: '100',
    species: 'Snake', strategy: 'Transformation', verb: 'Transform',
    response: 'Motion and shifting security',
    accent: '#132840',                       // navy
    front: 'assets/snake-front.png',
    back:  'assets/snake-back.png',
    // Five-column zone: animal photography and its short line
    photo: 'assets/snake-photo.jpg',
    line: 'Change through shedding and movement.',
    idea: 'The body contracts, expands, sheds, and continuously transforms.',   // not shown at the moment (kept for later use)
    focus: '44% 40%',      // point the photo zooms into as it becomes the banknote
  },
];

/* --------------------------------------------------------------------------
   SECURITY-FEATURE ARTWORK (security demo)
   ARTWORK: thread frames should be transparent PNGs, tall and narrow.
   -------------------------------------------------------------------------- */
AS.assets = {
  thread: [
    'assets/thread-frame-01.png',
    'assets/thread-frame-02.png',
    'assets/thread-frame-03.png',
    'assets/thread-frame-04.png',
    'assets/thread-frame-05.png',
  ],
  watermark:     'assets/watermark.png',
  registerFront: 'assets/register-front.png',  // left / front half of the see-through register
  registerBack:  'assets/register-back.png',   // right / back half
};

/* --------------------------------------------------------------------------
   FEATURE POSITIONS ON THE FEATURED NOTE (security demo)
   All values are percentages of the note's width (x, w) and height (y, h).
   Adjust these to line up with your final artwork.
   -------------------------------------------------------------------------- */
AS.featureLayout = {
  thread:    { x: 64, w: 4.2 },
  watermark: { x: 5,  y: 16, w: 19, h: 68 },
  register:  { x: 80, y: 12, w: 9,  h: 19 },
  touchZones: [
    { x: 4,  y: 8,  w: 17, h: 30, label: 'Raised numeral' },
    { x: 30, y: 62, w: 30, h: 13, label: 'Intaglio text' },
    { x: 70, y: 52, w: 25, h: 38, label: 'Raised species motif' },
    { x: 1.2, y: 60, w: 2.4, h: 32, label: 'Edge marks' },
  ],
};

/* --------------------------------------------------------------------------
   TEXT — every line on screen. HTML (<br>, <em>) is allowed.
   -------------------------------------------------------------------------- */
AS.copy = {
  mark: 'Adaptive Surfaces',

  opening: {
    title: 'Adaptive Surfaces',
    subtitle: 'Reptiles, Protection, and Transformation',
    line: '“We all adapt to the world in different ways.”',
    begin: 'Begin',
  },

  idea: {
    kicker: 'The Idea',
    statement: 'A surface is never passive.',
    sentence: 'Reptiles survive through surfaces that sense, protect, change, grip, and respond to their environments.',
    question: 'What if a banknote could behave the same way?',
  },

  columns: {
    kicker: 'Five Animal Strategies',
    kickerNotes: 'Animal → Banknote',
    captionAnimals: 'Five species. Five strategies of adaptation.',
    captionNotes: 'Each banknote grows out of a biological strategy.',
    flip: 'Flip',
    close: 'Close',
  },

  family: {
    kicker: 'The Banknote Family',
  },

  respond: {
    kicker: 'The Banknote Responds',
    featuredLabel: 'Featured note',
    idle: {
      title: 'Four ways to read the surface',
      sub: 'Touch · Tilt · Light · Flip',
      text: 'Just as reptiles respond to their environment, the banknote responds to how it is handled.',
    },
    modes: {
      touch: {
        label: 'Touch',
        title: 'Intaglio',
        sub: 'Tactile identification',
        text: 'Information can be read through touch as well as sight.',
      },
      tilt: {
        label: 'Tilt',
        title: 'Anima Motion Thread',
        sub: 'Move across the note',
        text: 'Movement reveals transformation.',
      },
      light: {
        label: 'Light',
        title: 'Hold to Light',
        sub: 'Watermark · See-through register',
        text: 'Hidden structures align and become visible.',
      },
      flip: {
        label: 'Flip',
        title: 'Front / Back',
        sub: 'Click the note to turn it',
        text: 'Each note tells its story across two sides.',
      },
    },
    flipSides: {
      front: { name: 'Front', desc: 'Close-up / sensing' },
      back:  { name: 'Back',  desc: 'Behavior / adaptation' },
    },
    lightLabel: 'Light',
    lightHint: 'Press and hold the note, or drag',
    frameLabel: 'Frame',
  },

  translate: {
    kicker: 'From Biology to Security',
    left: 'Biological strategy',
    right: 'Banknote response',
    statement: 'The security feature is not added to the story.<br><em>It becomes part of the story.</em>',
  },

  final: {
    title: 'Adaptive Surfaces',
    lines: 'Five species.<span class="sep"></span>Five strategies.<span class="sep"></span>One connected banknote family.',
    quote: '“Adaptation is not about becoming the same —<br>it is about finding your own way to belong.”',
  },
};
