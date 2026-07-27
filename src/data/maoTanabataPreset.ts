import type {
  FireworkDesignV2,
  PatternGroup,
  PatternPoint,
  PatternStarLayer,
  VirtualStarPreset,
} from "./firework";

/*
 * This palette map was sampled once from mao_tanabata.jpg during development.
 * The browser receives only these fixed color indices; it never loads the
 * source image or invokes the app's image-placement/segmentation pipeline.
 */
const MAO_TANABATA_PALETTE = [
  { color: 0xfff7f0, name: "月白" },
  { color: 0xffdfdf, name: "薄桜" },
  { color: 0xffb8cd, name: "桜" },
  { color: 0xf184a6, name: "桃" },
  { color: 0xe94f8a, name: "撫子" },
  { color: 0xbd3265, name: "紅梅" },
  { color: 0xf52d54, name: "紅" },
  { color: 0xf3a13c, name: "琥珀" },
  { color: 0xffdd69, name: "星金" },
  { color: 0x9edfff, name: "水色" },
  { color: 0x4fc4f3, name: "天色" },
  { color: 0x3187d5, name: "縹" },
  { color: 0x1557a6, name: "瑠璃" },
  { color: 0x173b73, name: "紺" },
  { color: 0x5c946c, name: "竹青" },
  { color: 0x6d385e, name: "紫紺" },
] as const;

const MAO_TANABATA_GRID = [
  "....................C....................",
  "..............DDBB92BBBBCCB..............",
  "............DB100012000019BBB............",
  "..........D9000110211211001ABA9..........",
  "........DB0001222222222221001A990........",
  ".......D90112222222222222210019A99.......",
  "......D912211222222221210121001BA99......",
  ".....911232212222222202212221109BB99.....",
  "....2773233222221222222322222210ABAA9....",
  "....27765621222222222223222222210BBBA....",
  "...1235666322222222222222222222211BBAA...",
  "...35335133321122222222122222223219BBA...",
  "..233237763112232222222112221223221BBAB..",
  "..2322377732221222222220012212222211CBB..",
  ".233222F7532221222222220021221212222BDCB.",
  ".232122F5353322322222210021221212221BDDB.",
  ".221122553422222222222123211111132219CDC.",
  ".222222555322212322222FFFF10000FF2329CCC.",
  ".22222255332222332223F2F520000132532ABCB.",
  ".3222225533322233232F205650000053332BBCC.",
  "23222235532322223220220333100002234FBBCBB",
  ".3222235533233232220110121100000133FBBCB.",
  ".33222355332343421211111111100000233CBCC.",
  ".33222556532232221211112211100000133BBCD.",
  ".23223555543222211221111111000000033BBCD.",
  ".2332F545333311210121111111000000033BDCB.",
  ".2332CF33333321220021110000000010133FBDB.",
  "..333BBF3333332211111010000000000233DBC..",
  "..25FBBBC333333435211100000000000D32BFB..",
  "...25BBBBCF333344521110000000000AB32BD...",
  "...23BBBBBBBBCDFF521111000000011BC32FD...",
  "....22BDBBBBBBBBBF11111111199AAABF32F....",
  "....222DBAABAAABDB1111101AAAAABADD32D....",
  ".....232229BBF33321111119AA99BDBDD21.....",
  "......22AAB33243299211112A9AA999F22......",
  ".......2BDB22243399012013121100013.......",
  "........2DB2233311910111311200011........",
  "..........BB2333220810122202101..........",
  "............53222218000222122............",
  "..............1011218000222..............",
  "....................1....................",
] as const;

const GRID_CENTER = (MAO_TANABATA_GRID.length - 1) / 2;
const PORTRAIT_RADIUS = 0.82;
const FRAME_RADIUS = 0.93;
const FRAME_POINT_COUNT = 96;
const PALETTE_KEYS = "0123456789ABCDEF";
const AFTERGLOW_FRAME_KEYS = new Set(["7", "8", "A", "E"]);
const EDGE_COLOR_DISTANCE = 100;
const HAIR_EDGE_COLOR_DISTANCE = 30;
const HAIR_PALETTE_KEYS = new Set(["2", "3", "4", "5", "6", "F"]);
const EDGE_NEIGHBORS = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
] as const;

function paletteStarId(index: number): string {
  return `star-mao-tanabata-${PALETTE_KEYS[index].toLowerCase()}`;
}

function createPaletteStar(
  index: number,
  color: number,
  colorName: string,
): VirtualStarPreset {
  const red = (color >> 16) & 0xff;
  const green = (color >> 8) & 0xff;
  const blue = color & 0xff;
  const luminance = (red * 0.2126 + green * 0.7152 + blue * 0.0722) / 255;
  return {
    brightness: 1.34 + (1 - luminance) * 0.38,
    burnDuration: 3.45,
    colorStages: [
      {
        color,
        intensity: 1.14,
        normalizedTime: 0,
        trailColor: color,
      },
      {
        color,
        intensity: 0.98,
        normalizedTime: 0.82,
        trailColor: color,
      },
      {
        color,
        intensity: 0,
        normalizedTime: 1,
        trailColor: color,
      },
    ],
    displayName: `七夕まお・${colorName}`,
    drag: 0.82,
    emissionKind: "point",
    flicker: 0.02,
    gravityScale: 0.08,
    id: paletteStarId(index),
    smokeAmount: 0.02,
    soundTag: "soft",
    trailLifetime: 0.04,
    trailWidth: 0.72,
  };
}

function portraitPoints(): PatternPoint[] {
  return MAO_TANABATA_GRID.flatMap((row, rowIndex) =>
    [...row].flatMap((paletteKey, columnIndex) => {
      if (paletteKey === ".") return [];
      return [
        {
          groupId: paletteKey,
          x: ((columnIndex - GRID_CENTER) / GRID_CENTER) * PORTRAIT_RADIUS,
          y: ((GRID_CENTER - rowIndex) / GRID_CENTER) * PORTRAIT_RADIUS,
        },
      ];
    }),
  );
}

function paletteColor(paletteKey: string): number {
  return MAO_TANABATA_PALETTE[PALETTE_KEYS.indexOf(paletteKey)]?.color ?? 0;
}

function perceptualColorDistance(left: number, right: number): number {
  const red = ((left >> 16) & 0xff) - ((right >> 16) & 0xff);
  const green = ((left >> 8) & 0xff) - ((right >> 8) & 0xff);
  const blue = (left & 0xff) - (right & 0xff);
  return Math.sqrt(red * red * 0.3 + green * green * 0.59 + blue * blue * 0.11);
}

function paletteLuminance(color: number): number {
  const red = (color >> 16) & 0xff;
  const green = (color >> 8) & 0xff;
  const blue = color & 0xff;
  return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}

function isHairCoordinate(rowIndex: number, columnIndex: number): boolean {
  return rowIndex <= 31 && (rowIndex <= 16 || columnIndex <= 24);
}

function isHairInteriorEdge(
  paletteKey: string,
  neighbor: string,
  rowIndex: number,
  columnIndex: number,
  neighborRowIndex: number,
  neighborColumnIndex: number,
): boolean {
  if (
    paletteKey === neighbor ||
    !HAIR_PALETTE_KEYS.has(paletteKey) ||
    !HAIR_PALETTE_KEYS.has(neighbor) ||
    !isHairCoordinate(rowIndex, columnIndex) ||
    !isHairCoordinate(neighborRowIndex, neighborColumnIndex)
  ) {
    return false;
  }

  const color = paletteColor(paletteKey);
  const neighborColor = paletteColor(neighbor);
  return (
    perceptualColorDistance(color, neighborColor) >= HAIR_EDGE_COLOR_DISTANCE &&
    paletteLuminance(color) < paletteLuminance(neighborColor)
  );
}

function edgePoints(): PatternPoint[] {
  return MAO_TANABATA_GRID.flatMap((row, rowIndex) =>
    [...row].flatMap((paletteKey, columnIndex) => {
      if (paletteKey === ".") return [];
      const isEdge = EDGE_NEIGHBORS.some(([columnOffset, rowOffset]) => {
        const neighborRowIndex = rowIndex + rowOffset;
        const neighborColumnIndex = columnIndex + columnOffset;
        const neighbor =
          MAO_TANABATA_GRID[neighborRowIndex]?.[neighborColumnIndex] ?? ".";
        return (
          neighbor === "." ||
          perceptualColorDistance(
            paletteColor(paletteKey),
            paletteColor(neighbor),
          ) >= EDGE_COLOR_DISTANCE ||
          isHairInteriorEdge(
            paletteKey,
            neighbor,
            rowIndex,
            columnIndex,
            neighborRowIndex,
            neighborColumnIndex,
          )
        );
      });
      if (!isEdge) return [];
      return [
        {
          groupId: paletteKey,
          x: ((columnIndex - GRID_CENTER) / GRID_CENTER) * PORTRAIT_RADIUS,
          y: ((GRID_CENTER - rowIndex) / GRID_CENTER) * PORTRAIT_RADIUS,
        },
      ];
    }),
  );
}

function framePoints(): PatternPoint[] {
  const framePalette = ["7", "8", "A", "E"] as const;
  return Array.from({ length: FRAME_POINT_COUNT }, (_, index) => {
    const angle = (index / FRAME_POINT_COUNT) * Math.PI * 2;
    return {
      groupId: framePalette[index % framePalette.length],
      x: Math.cos(angle) * FRAME_RADIUS,
      y: Math.sin(angle) * FRAME_RADIUS,
    };
  });
}

function paletteGroups(): PatternGroup[] {
  return MAO_TANABATA_PALETTE.map((_, index) => ({
    id: PALETTE_KEYS[index],
    name: `画像色 ${PALETTE_KEYS[index]}`,
    starId: paletteStarId(index),
  }));
}

function patternLayer(
  id: string,
  name: string,
  points: PatternPoint[],
  depth: number,
): PatternStarLayer {
  return {
    allowedAngle: 12,
    defaultStarId: paletteStarId(0),
    depth,
    facingPolicy: "audience",
    groups: paletteGroups(),
    id,
    ignitionOffset: 0,
    kind: "pattern",
    locked: false,
    name,
    orientationDegrees: 0,
    points,
    radialSpeedScale: 1,
    rotationJitter: 0,
    template: "custom",
    visible: true,
  };
}

export function buildMaoTanabataPreset(
  base: FireworkDesignV2,
): FireworkDesignV2 {
  const design = structuredClone(base);
  const portrait = portraitPoints();
  const frame = framePoints();

  MAO_TANABATA_PALETTE.forEach(({ color, name }, index) => {
    const definition = createPaletteStar(index, color, name);
    design.starDefinitions[definition.id] = definition;
  });

  design.id = "preset-mao-tanabata";
  design.name = "七夕のまお";
  design.description =
    "桃色の髪、紅い瞳、花柄の浴衣、青い七夕の夜空を、固定配置した16色の星で円形に描くモザイク型物。";
  design.family = "warimono";
  design.pattern = "kaleidoscope";
  design.sizeClass = "large";
  design.ascentEffect = "gold";
  design.particleDensity = portrait.length + frame.length;
  design.layers = [
    patternLayer(
      "layer-mao-tanabata-portrait",
      "まお七夕モザイク（静的配置）",
      portrait,
      0.025,
    ),
    patternLayer("layer-mao-tanabata-frame", "七夕の星飾り", frame, 0.018),
  ];
  design.themeColors = MAO_TANABATA_PALETTE.map(({ color }) => color);
  design.launchVariation = {
    ignition: 0,
    lifetime: 0,
    placement: 0,
    velocity: 0,
  };
  design.realism = {
    ignitionJitter: 0,
    lifetimeJitter: 0,
    missingRate: 0,
    placementJitter: 0,
    velocityJitter: 0,
  };
  design.soundProfile = { volume: 0.78, lowEnd: 0.72, crackle: 0.2 };
  design.smokeProfile = { amount: 0.12, lifetime: 5.5 };
  return design;
}

function softenPortraitStar(definition: VirtualStarPreset): void {
  const color = definition.colorStages[0].color;
  definition.brightness *= 0.84;
  definition.burnDuration = 4.45;
  definition.drag = 0.56;
  definition.flicker = 0.035;
  definition.gravityScale = 0.18;
  definition.trailLifetime = 0.18;
  definition.trailWidth = 0.76;
  definition.colorStages = [
    { color, intensity: 1.04, normalizedTime: 0, trailColor: color },
    { color, intensity: 0.94, normalizedTime: 0.34, trailColor: color },
    { color, intensity: 0.62, normalizedTime: 0.68, trailColor: color },
    { color, intensity: 0.2, normalizedTime: 0.9, trailColor: color },
    { color, intensity: 0, normalizedTime: 1, trailColor: color },
  ];
}

function createAfterglowStar(
  source: VirtualStarPreset,
  paletteKey: string,
): VirtualStarPreset {
  const color = source.colorStages[0].color;
  return {
    ...structuredClone(source),
    brightness: source.brightness * 0.78,
    burnDuration: 5.8,
    colorStages: [
      {
        color: 0xfff8e8,
        intensity: 1.06,
        normalizedTime: 0,
        trailColor: color,
      },
      {
        color,
        intensity: 0.72,
        normalizedTime: 0.42,
        trailColor: color,
      },
      {
        color,
        intensity: 0.3,
        normalizedTime: 0.82,
        trailColor: color,
      },
      {
        color,
        intensity: 0,
        normalizedTime: 1,
        trailColor: color,
      },
    ],
    displayName: `${source.displayName}・余光`,
    drag: 0.74,
    effectProfile: {
      color: { mode: "smooth", playback: "once" },
      light: {
        mode: "continuous",
        terminal: {
          duration: 0.16,
          mode: "kouro",
          sparkleCount: 1,
          strength: 0.78,
        },
      },
      trail: { mode: "continuous" },
    },
    flicker: 0.06,
    gravityScale: 0.12,
    id: `star-mao-tanabata-afterglow-${paletteKey.toLowerCase()}`,
    smokeAmount: 0.03,
    trailLifetime: 0.72,
    trailWidth: 0.94,
  };
}

export function buildMaoTanabataAfterglowPreset(
  base: FireworkDesignV2,
): FireworkDesignV2 {
  const design = buildMaoTanabataPreset(base);

  MAO_TANABATA_PALETTE.forEach((_, index) => {
    softenPortraitStar(design.starDefinitions[paletteStarId(index)]);
  });

  design.id = "preset-mao-tanabata-afterglow";
  design.name = "七夕のまお・淡光";
  design.description =
    "まおの姿が大きくほどけながら段階的に淡く消え、その後も七夕色の光環と光露が静かに残る余韻仕立て。";
  design.layers.forEach((layer) => {
    if (layer.kind !== "pattern") return;
    if (layer.id === "layer-mao-tanabata-portrait") {
      layer.id = "layer-mao-tanabata-afterglow-portrait";
      layer.name = "ふわりとほどけるまお";
      layer.radialSpeedScale = 1.08;
      return;
    }

    layer.id = "layer-mao-tanabata-afterglow-frame";
    layer.name = "遅れて残る七夕光環";
    layer.ignitionOffset = 0.12;
    layer.radialSpeedScale = 0.78;
    layer.groups = layer.groups.map((group) => {
      if (!AFTERGLOW_FRAME_KEYS.has(group.id)) return group;
      const afterglowId = `star-mao-tanabata-afterglow-${group.id.toLowerCase()}`;
      design.starDefinitions[afterglowId] = createAfterglowStar(
        design.starDefinitions[group.starId],
        group.id,
      );
      return { ...group, starId: afterglowId };
    });
  });
  design.burnDuration = 4.45;
  design.trailStyle = { length: 0.18, sparkle: 0.08, width: 0.82 };
  design.smokeProfile = { amount: 0.16, lifetime: 6.2 };
  return design;
}

function tuneEdgeStar(definition: VirtualStarPreset): void {
  const color = definition.colorStages[0].color;
  definition.brightness *= 0.92;
  definition.burnDuration = 3.85;
  definition.drag = 0.64;
  definition.flicker = 0.05;
  definition.gravityScale = 0.14;
  definition.trailLifetime = 0.22;
  definition.trailWidth = 0.68;
  definition.colorStages = [
    {
      color: 0xfff8ee,
      intensity: 1.18,
      normalizedTime: 0,
      trailColor: color,
    },
    { color, intensity: 1.02, normalizedTime: 0.14, trailColor: color },
    { color, intensity: 0.58, normalizedTime: 0.72, trailColor: color },
    { color, intensity: 0, normalizedTime: 1, trailColor: color },
  ];
}

export function buildMaoTanabataEdgePreset(
  base: FireworkDesignV2,
): FireworkDesignV2 {
  const design = buildMaoTanabataPreset(base);
  const edges = edgePoints();

  MAO_TANABATA_PALETTE.forEach((_, index) => {
    tuneEdgeStar(design.starDefinitions[paletteStarId(index)]);
  });

  design.id = "preset-mao-tanabata-edge";
  design.name = "七夕のまお・光輪郭";
  design.description =
    "塗りつぶしを除き、髪、瞳、浴衣、外形の色境界だけを細い光跡で描く線画仕立ての七夕花火。";
  design.layers.forEach((layer) => {
    if (layer.kind !== "pattern") return;
    if (layer.id === "layer-mao-tanabata-portrait") {
      layer.id = "layer-mao-tanabata-edge-portrait";
      layer.name = "まおの光輪郭";
      layer.points = edges;
      layer.radialSpeedScale = 1.04;
      return;
    }

    layer.id = "layer-mao-tanabata-edge-frame";
    layer.name = "七夕の細光環";
    layer.ignitionOffset = 0.08;
    layer.radialSpeedScale = 0.86;
  });
  design.particleDensity = edges.length + FRAME_POINT_COUNT;
  design.burnDuration = 3.85;
  design.trailStyle = { length: 0.22, sparkle: 0.06, width: 0.68 };
  design.smokeProfile = { amount: 0.08, lifetime: 4.8 };
  return design;
}
