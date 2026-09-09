// Helpers for use_figma. Adapted from the Figma library skill's component,
// variable-binding, and grid-layout helpers. Inputs are measured DOM specimens.
async function buildMeasuredVariants(data, page) {
  const variables = await figma.variables.getLocalVariablesAsync();
  const byName = Object.fromEntries(variables.map((v) => [v.name, v]));
  const colorCollection = await figma.variables.getVariableCollectionByIdAsync(
    data.colorCollectionId,
  );
  const dimensions = await figma.variables.getVariableCollectionByIdAsync(
    data.dimensionCollectionId,
  );
  const createdVariables = [];
  const close = (a, b) =>
    a &&
    b &&
    ["r", "g", "b", "a"].every(
      (k) => Math.abs((a[k] ?? 1) - (b[k] ?? 1)) < 0.009,
    );
  const paint = (l, d, scope) => {
    if (!l) return [];
    const match = Object.keys(data.light.vars).find(
      (k) =>
        k.startsWith("--") &&
        byName["color/" + k.replace(/^--(?:color-)?/, "")] &&
        close(data.light.vars[k].rgba, l.rgba) &&
        close(data.dark.vars[k]?.rgba, d?.rgba),
    );
    let v = match
      ? byName["color/" + match.replace(/^--(?:color-)?/, "")]
      : null;
    if (!v) {
      const name =
        "component/" +
        data.slug +
        "/" +
        scope +
        "/" +
        [
          l.rgba.r,
          l.rgba.g,
          l.rgba.b,
          l.rgba.a,
          d?.rgba.r,
          d?.rgba.g,
          d?.rgba.b,
          d?.rgba.a,
        ]
          .map((n) => Math.round((n ?? 0) * 255))
          .join("-");
      v = byName[name];
      if (!v) {
        v = figma.variables.createVariable(name, colorCollection, "COLOR");
        v.setValueForMode(data.lightMode, l.rgba);
        v.setValueForMode(data.darkMode, d?.rgba ?? l.rgba);
        v.scopes = [
          "FRAME_FILL",
          "SHAPE_FILL",
          "TEXT_FILL",
          "STROKE_COLOR",
          "EFFECT_COLOR",
        ];
        v.description =
          "Rendered CSS: " +
          l.css +
          " (light); " +
          (d?.css ?? l.css) +
          " (dark). " +
          data.source;
        v.setVariableCodeSyntax("WEB", l.css);
        byName[name] = v;
        createdVariables.push({ id: v.id, name });
      }
    }
    return [
      figma.variables.setBoundVariableForPaint(
        {
          type: "SOLID",
          color: { r: l.rgba.r, g: l.rgba.g, b: l.rgba.b },
          opacity: l.rgba.a,
        },
        "color",
        v,
      ),
    ];
  };
  const gradientPaints = (s) =>
    (s.gradients ?? [])
      .map((g) => {
        let transform = [
          [1, 0, 0],
          [0, 1, 0],
        ];
        if (g.type === "linear") {
          if (g.direction === "to top")
            transform = [
              [0, -1, 1],
              [1, 0, 0],
            ];
          else if (g.direction === "to bottom")
            transform = [
              [0, 1, 0],
              [-1, 0, 1],
            ];
          else if (g.direction === "to left")
            transform = [
              [-1, 0, 1],
              [0, -1, 1],
            ];
        }
        return {
          type: g.type === "conic" ? "GRADIENT_ANGULAR" : "GRADIENT_LINEAR",
          gradientTransform: transform,
          gradientStops: g.stops,
        };
      })
      .reverse();
  const dimension = (value, kind) => {
    if (kind === "radius" && value > 9999) value = 9999;
    let v = variables.find(
      (v) =>
        v.resolvedType === "FLOAT" &&
        v.name.startsWith(kind === "radius" ? "radius/" : "spacing/") &&
        Math.abs(Object.values(v.valuesByMode)[0] - value) < 0.01,
    );
    if (!v) {
      const name =
        "measured/" +
        kind +
        "/" +
        String(Math.round(value * 1000) / 1000).replace(".", "-");
      v = byName[name];
      if (!v) {
        v = figma.variables.createVariable(name, dimensions, "FLOAT");
        v.setValueForMode(dimensions.modes[0].modeId, value);
        v.scopes =
          kind === "radius"
            ? ["CORNER_RADIUS"]
            : ["GAP", "WIDTH_HEIGHT", "STROKE_FLOAT"];
        v.description = "CSS " + kind + " value measured from " + data.source;
        v.setVariableCodeSyntax("WEB", value + "px");
        byName[name] = v;
        createdVariables.push({ id: v.id, name });
      }
    }
    return v;
  };
  const weight = (w) =>
    Number(w) >= 700
      ? "Bold"
      : Number(w) >= 600
        ? "Semi Bold"
        : Number(w) >= 500
          ? "Medium"
          : "Regular";
  await Promise.all(
    ["Regular", "Medium", "Semi Bold", "Bold"].map((style) =>
      figma.loadFontAsync({ family: "Inter", style }),
    ),
  );
  await figma.loadFontAsync({ family: "Geist Mono", style: "Regular" });
  const ids = [],
    textNodes = [];
  function build(l, d, root = false) {
    const s = l.style,
      ds = d?.style ?? s;
    let n;
    if (l.text !== undefined) {
      n = figma.createText();
      const mono = s.font.includes("Mono") || s.font.includes("monospace");
      n.fontName = {
        family: mono ? "Geist Mono" : "Inter",
        style: mono ? "Regular" : weight(s.weight),
      };
      n.fontSize = s.size;
      n.lineHeight = { unit: "PIXELS", value: s.line };
      n.letterSpacing = { unit: "PIXELS", value: s.letter };
      n.characters = l.text;
      n.fills = paint(s.fg, ds.fg, "text");
      n.textAutoResize = "WIDTH_AND_HEIGHT";
      n.name = l.name;
      textNodes.push(n.id);
      return n;
    }
    if (l.svg) {
      n = figma.createNodeFromSvg(l.svg);
      n.name = l.name;
      n.resize(Math.max(0.1, l.rect.w), Math.max(0.1, l.rect.h));
      for (const v of n.findAll((x) => x.type === "VECTOR")) {
        for (const key of ["fills", "strokes"]) {
          v[key] = v[key].map((p) =>
            p.type === "SOLID" &&
            close({ ...p.color, a: p.opacity ?? 1 }, s.fg.rgba)
              ? { ...paint(s.fg, ds.fg, "icon")[0], opacity: p.opacity }
              : p,
          );
        }
      }
      return n;
    }
    n = root ? figma.createComponent() : figma.createFrame();
    n.name = l.name;
    n.layoutMode = "VERTICAL";
    n.resize(Math.max(0.1, l.rect.w), Math.max(0.1, l.rect.h));
    n.primaryAxisSizingMode = "FIXED";
    n.counterAxisSizingMode = "FIXED";
    n.fills = s.bg?.rgba.a ? paint(s.bg, ds.bg, "background") : [];
    n.opacity = s.opacity;
    n.clipsContent = s.clip;
    if (s.gradients?.length) n.fills = gradientPaints(s);
    n.strokes = s.borders.some((v) => v > 0)
      ? paint(s.border, ds.border, "border")
      : [];
    n.strokeAlign = "INSIDE";
    n.strokeTopWeight = s.borders[0];
    n.strokeRightWeight = s.borders[1];
    n.strokeBottomWeight = s.borders[2];
    n.strokeLeftWeight = s.borders[3];
    if (s.borderStyle === "dashed") n.dashPattern = [4, 4];
    if (
      s.outlineWidth > 0 &&
      s.outline?.rgba.a &&
      !s.borders.some((v) => v > 0)
    ) {
      n.strokes = paint(s.outline, ds.outline, "outline");
      n.strokeWeight = s.outlineWidth;
      n.strokeAlign = s.outlineOffset < 0 ? "INSIDE" : "OUTSIDE";
    }
    n.effects = (s.effects ?? []).flatMap((e, i) => {
      const p = paint(e.color, ds.effects?.[i]?.color ?? e.color, "effect")[0];
      if (!e.blur && !e.x && !e.y && e.spread > 0) {
        if (s.borders.some((v) => v > 0)) {
          const ring =
            s.radius[0] >= l.rect.w / 2
              ? figma.createEllipse()
              : figma.createFrame();
          n.appendChild(ring);
          ring.layoutPositioning = "ABSOLUTE";
          const inset = e.inset ? Math.max(...s.borders) : 0;
          ring.x = inset;
          ring.y = inset;
          ring.resize(
            Math.max(1, l.rect.w - 2 * inset),
            Math.max(1, l.rect.h - 2 * inset),
          );
          ring.fills = [];
          ring.strokes = [p];
          ring.strokeWeight = e.spread;
          ring.strokeAlign = e.inset ? "INSIDE" : "OUTSIDE";
          ring.name = e.inset ? "Inner ring" : "Outer ring";
          return [];
        }
        n.strokes = [p];
        n.strokeWeight = e.spread;
        n.strokeAlign = e.inset ? "INSIDE" : "OUTSIDE";
        return [];
      }
      const effect = {
        type: e.inset ? "INNER_SHADOW" : "DROP_SHADOW",
        color: e.color.rgba,
        offset: { x: e.x, y: e.y },
        radius: e.blur,
        spread: e.spread,
        visible: true,
        blendMode: "NORMAL",
      };
      return [
        p.boundVariables?.color
          ? figma.variables.setBoundVariableForEffect(
              effect,
              "color",
              byName[
                Object.keys(byName).find(
                  (k) => byName[k].id === p.boundVariables.color.id,
                )
              ],
            )
          : effect,
      ];
    });
    for (const [i, k] of [
      "topLeftRadius",
      "topRightRadius",
      "bottomRightRadius",
      "bottomLeftRadius",
    ].entries())
      n.setBoundVariable(k, dimension(s.radius[i], "radius"));
    const lc = l.children ?? [],
      dc = d?.children ?? [];
    const children = lc.map((c, i) => ({
      node: build(c, dc.find((x) => x.path === c.path) ?? dc[i]),
      source: c,
    }));
    const inFlow = children.filter(
      (c) =>
        !["absolute", "fixed"].includes(c.source.style.position) &&
        !c.source.style.transformed &&
        !c.source.name.startsWith("::"),
    );
    const horizontal =
      (s.display.includes("flex") && !s.direction.startsWith("column")) ||
      (inFlow.length > 1 &&
        inFlow.every(
          (c) => Math.abs(c.source.rect.y - inFlow[0].source.rect.y) < 2,
        ));
    const vertical =
      inFlow.length < 2 ||
      inFlow.every(
        (c, i) =>
          i === 0 ||
          c.source.rect.y >=
            inFlow[i - 1].source.rect.y + inFlow[i - 1].source.rect.h - 2,
      );
    const flow =
      !s.display.includes("grid") &&
      !lc.some((c) => c.style.margin?.some((v) => Math.abs(v) > 0.1)) &&
      (horizontal || vertical);
    n.layoutMode = horizontal ? "HORIZONTAL" : "VERTICAL";
    const pads = [...s.padding];
    for (let i = 0; i < 4; i++) pads[i] += s.borders[i];
    for (const [i, k] of [
      "paddingTop",
      "paddingRight",
      "paddingBottom",
      "paddingLeft",
    ].entries())
      n.setBoundVariable(k, dimension(pads[i], "spacing"));
    let gap = 0;
    if (inFlow.length > 1) {
      const a = inFlow[0].source.rect,
        b = inFlow[1].source.rect;
      gap = horizontal ? b.x - a.x - a.w : b.y - a.y - a.h;
    }
    n.setBoundVariable("itemSpacing", dimension(Math.max(0, gap), "spacing"));
    n.counterAxisAlignItems =
      s.align === "center" || (!horizontal && s.textAlign === "center")
        ? "CENTER"
        : s.align === "flex-end"
          ? "MAX"
          : "MIN";
    n.primaryAxisAlignItems =
      s.justify === "center"
        ? "CENTER"
        : s.justify === "space-between"
          ? "SPACE_BETWEEN"
          : s.justify === "flex-end"
            ? "MAX"
            : "MIN";
    for (const { node, source } of children) {
      n.appendChild(node);
      if (!flow || !inFlow.some((c) => c.node === node)) {
        node.layoutPositioning = "ABSOLUTE";
        node.x = source.rect.x - l.rect.x;
        node.y = source.rect.y - l.rect.y;
      } else {
        node.layoutSizingHorizontal = "FIXED";
        node.layoutSizingVertical = "FIXED";
        if (node.type === "TEXT") {
          node.layoutSizingHorizontal = "HUG";
          node.layoutSizingVertical = "HUG";
        }
      }
    }
    if (
      s.gradients?.some((g) => g.type === "conic") &&
      s.clipPath?.startsWith("path")
    ) {
      const e = figma.createEllipse();
      n.appendChild(e);
      e.layoutPositioning = "ABSOLUTE";
      e.x = 0;
      e.y = 0;
      e.resize(l.rect.w, l.rect.h);
      e.arcData = {
        startingAngle: 0,
        endingAngle: Math.PI * 2,
        innerRadius: 0.74,
      };
      e.fills = n.fills;
      n.fills = [];
      e.name = "Hue ring";
    }
    if (
      root &&
      s.display.includes("flex") &&
      children.every((c) => c.source.text !== undefined)
    ) {
      n.primaryAxisSizingMode = "AUTO";
      n.counterAxisSizingMode = "AUTO";
    }
    return n;
  }
  for (let i = 0; i < data.light.specimens.length; i++) {
    const l = data.light.specimens[i],
      d = data.dark.specimens[i];
    const variantName = Object.entries(l.props)
      .map(([k, v]) => k + "=" + v)
      .join(", ");
    const existing = page.children.find(
      (n) => n.type === "COMPONENT" && n.name === variantName,
    );
    if (existing) {
      ids.push(existing.id);
      continue;
    }
    const wrap = (t) =>
      t.svg || t.text !== undefined
        ? {
            name: "container",
            tag: "div",
            rect: t.rect,
            style: {
              ...t.style,
              bg: null,
              borders: [0, 0, 0, 0],
              padding: [0, 0, 0, 0],
              radius: [0, 0, 0, 0],
              display: "flex",
            },
            children: [t],
          }
        : t;
    let n;
    if (data.cloneIds) {
      n = (await figma.getNodeByIdAsync(data.cloneIds[i])).clone();
      const s = l.tree.style,
        ds = d.tree.style;
      n.fills = s.bg?.rgba.a ? paint(s.bg, ds.bg, "background") : [];
      n.strokes = s.borders.some((v) => v > 0)
        ? paint(s.border, ds.border, "border")
        : [];
      for (const t of n.findAll((v) => v.type === "TEXT"))
        t.fills = paint(s.fg, ds.fg, "text");
      const ls = l.tree.children.find((v) => v.svg || v.tag === "svg"),
        dd = d.tree.children.find((v) => v.svg || v.tag === "svg");
      if (ls)
        for (const v of n.findAll((v) => v.type === "VECTOR"))
          for (const k of ["fills", "strokes"])
            if (v[k].length) v[k] = paint(ls.style.fg, dd.style.fg, "icon");
    } else n = build(wrap(l.tree), d?.tree ? wrap(d.tree) : null, true);
    if (n.type !== "COMPONENT")
      throw new Error("Root must be a component: " + data.family);
    n.name = variantName;
    n.description = "Source: " + data.source;
    page.appendChild(n);
    ids.push(n.id);
  }
  return { variantIds: ids, textNodeIds: textNodes, createdVariables };
}
