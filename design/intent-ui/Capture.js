// Read-only DOM extraction for the editable Figma kit. Run in the specimen page.
export function captureSpecimens(requestedFamily) {
  const color = (value) => {
    if (!value || value === "none") return null;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = value;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    return {
      css: value,
      rgba: { r: r / 255, g: g / 255, b: b / 255, a: a / 255 },
    };
  };
  const shadows = (value) => {
    let depth = 0,
      start = 0,
      parts = [];
    for (let i = 0; i < value.length; i++) {
      if (value[i] === "(") depth++;
      if (value[i] === ")") depth--;
      if (value[i] === "," && !depth) {
        parts.push(value.slice(start, i));
        start = i + 1;
      }
    }
    parts.push(value.slice(start));
    return parts.flatMap((part) => {
      const c = part.match(/(?:rgba?|oklch|oklab|color)\([^)]*\)/)?.[0];
      const dims = part
        .replace(c ?? "", "")
        .match(/-?\d*\.?\d+px/g)
        ?.map(parseFloat);
      if (!c || !dims || !color(c).rgba.a) return [];
      return [
        {
          color: color(c),
          x: dims[0],
          y: dims[1],
          blur: dims[2] ?? 0,
          spread: dims[3] ?? 0,
          inset: part.includes("inset"),
        },
      ];
    });
  };
  const splitTop = (value) => {
    let depth = 0,
      start = 0,
      out = [];
    for (let i = 0; i < value.length; i++) {
      if (value[i] === "(") depth++;
      if (value[i] === ")") depth--;
      if (value[i] === "," && !depth) {
        out.push(value.slice(start, i).trim());
        start = i + 1;
      }
    }
    out.push(value.slice(start).trim());
    return out;
  };
  const gradients = (value) =>
    splitTop(value).flatMap((g) => {
      const m = g.match(/^(linear|conic)-gradient\((.*)\)$/);
      if (!m) return [];
      const parts = splitTop(m[2]),
        direction = /^(to |from |[\d.-]+deg)/.test(parts[0])
          ? parts.shift()
          : m[1] === "linear"
            ? "to bottom"
            : "from 0deg";
      const stops = parts
        .map((part, i) => {
          const c = part.match(
            /(?:rgba?|oklch|oklab|color)\([^)]*\)|#[a-fA-F0-9]+/,
          )?.[0];
          if (!c) return null;
          const pc = part.slice(part.indexOf(c) + c.length).match(/([\d.]+)%/);
          return {
            position: pc ? Number(pc[1]) / 100 : i / (parts.length - 1),
            color: color(c).rgba,
          };
        })
        .filter(Boolean);
      return stops.length ? [{ type: m[1], direction, stops }] : [];
    });
  const style = (s) => ({
    bg: color(s.backgroundColor),
    fg: color(s.color),
    border: color(s.borderTopColor),
    outline: color(s.outlineColor),
    outlineWidth:
      s.outlineStyle === "none" ? 0 : parseFloat(s.outlineWidth) || 0,
    outlineOffset: parseFloat(s.outlineOffset) || 0,
    borders: ["Top", "Right", "Bottom", "Left"].map(
      (k) => parseFloat(s["border" + k + "Width"]) || 0,
    ),
    margin: ["Top", "Right", "Bottom", "Left"].map(
      (k) => parseFloat(s["margin" + k]) || 0,
    ),
    padding: ["Top", "Right", "Bottom", "Left"].map(
      (k) => parseFloat(s["padding" + k]) || 0,
    ),
    radius: ["TopLeft", "TopRight", "BottomRight", "BottomLeft"].map(
      (k) => parseFloat(s["border" + k + "Radius"]) || 0,
    ),
    opacity: parseFloat(s.opacity),
    font: s.fontFamily,
    weight: s.fontWeight,
    size: parseFloat(s.fontSize),
    line: parseFloat(s.lineHeight) || parseFloat(s.fontSize) * 1.2,
    letter: parseFloat(s.letterSpacing) || 0,
    textAlign: s.textAlign,
    display: s.display,
    direction: s.flexDirection,
    align: s.alignItems,
    justify: s.justifyContent,
    gap: parseFloat(s.gap) || 0,
    position: s.position,
    transformed: s.transform !== "none" || s.translate !== "none",
    clip: ["hidden", "auto", "scroll", "clip"].includes(s.overflow),
    shadow: s.boxShadow,
    effects: shadows(s.boxShadow),
    gradient: s.backgroundImage,
    gradients: gradients(s.backgroundImage),
    clipPath: s.clipPath,
    borderStyle: s.borderTopStyle,
  });
  const rect = (r) => ({ x: r.x, y: r.y, w: r.width, h: r.height });
  function svg(el) {
    const clone = el.cloneNode(true),
      a = [el, ...el.querySelectorAll("*")],
      b = [clone, ...clone.querySelectorAll("*")];
    for (let i = 0; i < a.length; i++) {
      const s = getComputedStyle(a[i]);
      for (const k of [
        "fill",
        "stroke",
        "stop-color",
        "stop-opacity",
        "stroke-width",
        "stroke-linecap",
        "stroke-linejoin",
        "fill-rule",
        "font-family",
        "font-size",
        "font-weight",
        "opacity",
      ]) {
        let v = s.getPropertyValue(k);
        if (
          ["fill", "stroke", "stop-color"].includes(k) &&
          v !== "none" &&
          !v.startsWith("url(")
        ) {
          const c = color(v).rgba;
          v = `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${c.a})`;
        }
        b[i].setAttribute(k, v);
      }
      b[i].removeAttribute("class");
      b[i].removeAttribute("style");
    }
    const cs = getComputedStyle(el),
      rotate = cs.rotate !== "none" ? parseFloat(cs.rotate) : 0;
    if (rotate) {
      const group = document.createElementNS("http://www.w3.org/2000/svg", "g"),
        vb = el.viewBox.baseVal;
      group.setAttribute(
        "transform",
        `rotate(${rotate} ${vb.x + vb.width / 2} ${vb.y + vb.height / 2})`,
      );
      while (clone.firstChild) group.appendChild(clone.firstChild);
      clone.appendChild(group);
    }
    clone.setAttribute("width", el.getBoundingClientRect().width);
    clone.setAttribute("height", el.getBoundingClientRect().height);
    for (const n of clone.querySelectorAll("animate,animateTransform,style"))
      n.remove();
    return clone.outerHTML;
  }
  function walk(el, path) {
    const s = getComputedStyle(el);
    let r = el.getBoundingClientRect();
    if (
      r.width > 0 &&
      r.height === 0 &&
      (s.flexGrow !== "0" ||
        getComputedStyle(el.parentElement).display.includes("flex"))
    )
      r = {
        x: r.x,
        y: r.y,
        width: r.width,
        height: 0.1,
        right: r.right,
        bottom: r.bottom,
      };
    if (
      (r.width < 0.1 || r.height < 0.1) &&
      el.children.length &&
      s.overflow !== "hidden" &&
      s.display !== "none"
    ) {
      const range = document.createRange();
      range.selectNodeContents(el);
      const content = range.getBoundingClientRect();
      if (content.width && content.height) r = content;
    }
    if (s.display === "contents") {
      const range = document.createRange();
      range.selectNodeContents(el);
      r = range.getBoundingClientRect();
    }
    if (
      s.display === "none" ||
      r.width < 0.1 ||
      r.height < 0.1 ||
      ["STYLE", "SCRIPT", "OPTION", "TEMPLATE"].includes(el.tagName) ||
      el.classList.contains("sr-only") ||
      s.clipPath === "inset(50%)" ||
      (r.width <= 1 && r.height <= 1 && s.overflow === "hidden") ||
      el.dataset.testid === "hidden-select-container"
    )
      return null;
    const n = {
      path,
      name:
        el.dataset.slot || el.getAttribute("role") || el.tagName.toLowerCase(),
      tag: el.tagName.toLowerCase(),
      rect: rect(r),
      style: style(s),
      children: [],
    };
    if (s.visibility === "hidden" || s.opacity === "0") {
      n.style.opacity = 0;
      n.style.bg = null;
      return n;
    }
    n.style.radius = ["TopLeft", "TopRight", "BottomRight", "BottomLeft"].map(
      (k) => {
        const v = s["border" + k + "Radius"];
        return v.includes("%")
          ? (parseFloat(v) * Math.min(r.width, r.height)) / 100
          : parseFloat(v) || 0;
      },
    );
    if (n.tag === "svg") {
      const textEl = el.querySelector("text");
      if (textEl && !el.querySelector("path,circle,rect")) {
        const st = style(getComputedStyle(textEl)),
          size =
            (st.size * (r.width - n.style.padding[1] - n.style.padding[3])) /
            (el.viewBox.baseVal.width || r.width);
        n.style.display = "flex";
        n.style.align = "center";
        n.style.justify = "center";
        n.children = [
          {
            path: path + "/initials",
            name: "Initials",
            text: textEl.textContent,
            style: { ...st, size, line: size * 1.2 },
            rect: rect(textEl.getBoundingClientRect()),
          },
        ];
        return n;
      }
      n.svg = svg(el);
      return n;
    }
    if (["input", "textarea", "select"].includes(n.tag)) {
      const value =
        n.tag === "select"
          ? el.selectedOptions[0]?.textContent
          : el.value || el.placeholder;
      if (value) {
        const tstyle = { ...n.style, position: "absolute" };
        if (!el.value && el.placeholder)
          tstyle.fg = color(getComputedStyle(el, "::placeholder").color);
        n.children.push({
          path: path + "/value",
          name: "value",
          text: value,
          style: tstyle,
          rect: {
            x: r.x + n.style.padding[3] + n.style.borders[3],
            y: r.y + n.style.padding[0] + n.style.borders[0],
            w: r.width - n.style.padding[1] - n.style.padding[3] - 2,
            h: n.style.line,
          },
        });
      }
      return n;
    }
    let i = 0;
    for (const child of el.childNodes) {
      if (child.nodeType === 1) {
        const c = walk(child, path + "/" + i);
        if (c) n.children.push(c);
      } else if (child.nodeType === 3 && child.textContent.trim()) {
        const range = document.createRange();
        range.selectNodeContents(child);
        const tr = range.getBoundingClientRect();
        if (tr.width) {
          const st = style(s);
          n.children.push({
            path: path + "/" + i,
            name: "label",
            text: child.textContent.replace(/\s+/g, " "),
            style: st,
            rect: {
              x: tr.x,
              y: tr.y - (st.line - tr.height) / 2,
              w: tr.width,
              h: Math.max(st.line, tr.height),
            },
          });
        }
      }
      i++;
    }
    n.children = n.children.reduce((out, c) => {
      const prev = out[out.length - 1];
      if (c.text !== undefined && prev?.text !== undefined) {
        prev.text += c.text;
        const right = Math.max(prev.rect.x + prev.rect.w, c.rect.x + c.rect.w);
        prev.rect.w = right - prev.rect.x;
      } else out.push(c);
      return out;
    }, []);
    for (const pseudo of ["::before", "::after"]) {
      const ps = getComputedStyle(el, pseudo);
      if (
        ps.content === "none" ||
        ps.content === "normal" ||
        ps.display === "none"
      )
        continue;
      const st = style(ps);
      let w = parseFloat(ps.width),
        h = parseFloat(ps.height);
      if (!w || !h || !st.bg?.rgba.a) continue;
      let x = r.x + (r.width - w) / 2,
        y = r.y + (r.height - h) / 2;
      if (ps.bottom !== "auto") y = r.bottom - parseFloat(ps.bottom) - h;
      if (ps.top !== "auto") y = r.top + parseFloat(ps.top);
      n.children.push({
        path: path + "/" + pseudo,
        name: pseudo,
        tag: "span",
        rect: { x, y, w, h },
        style: st,
        children: [],
      });
    }
    return n;
  }
  const section = requestedFamily
    ? [...document.querySelectorAll("[data-family]")].find(
        (e) => e.dataset.family === requestedFamily,
      )
    : document.querySelector("[data-family]");
  const family = section?.dataset.family;
  function specimenRoot(e) {
    if (family === "Toast") {
      const intent =
        window.intentFixtures[family][Number(e.dataset.specimen)].props.Intent;
      return document.querySelector(
        intent === "normal"
          ? "[data-sonner-toast]:not([data-type])"
          : '[data-sonner-toast][data-type="' + intent + '"]',
      );
    }
    const selectors = {
      Modal: '[data-slot="modal-content"]',
      Tooltip: '[role="tooltip"]',
      Menu: '[data-slot="menu-content"]',
      "Context Menu": '[data-slot="menu-content"]',
    };
    if (selectors[family]) {
      const n = document.querySelector(selectors[family]);
      if (n)
        return ["Menu", "Context Menu"].includes(family)
          ? n.closest("[data-placement]") || n
          : n;
    }
    if (["Sheet", "Drawer", "Command Menu"].includes(family))
      return document.querySelector('[role="dialog"]')?.parentElement;
    if (["Popover", "Preview"].includes(family))
      return (
        document.querySelector('[data-slot="popover-inner"]')?.parentElement ||
        document.querySelector("[data-placement]")
      );
    return [...e.children].find((c) => walk(c, "root"));
  }
  const rootStyles = getComputedStyle(document.documentElement);
  const vars = {};
  for (const k of [...rootStyles])
    if (k.startsWith("--") && !k.startsWith("--tw-")) {
      const v = rootStyles.getPropertyValue(k).trim();
      if (/^(oklch|oklab|rgb|#)/.test(v)) vars[k] = color(v);
    }
  return {
    family,
    vars,
    errors: [...section.querySelectorAll("[data-error]")].map(
      (e) => e.textContent,
    ),
    specimens: [...section.querySelectorAll("[data-specimen]")].map((e, i) => ({
      props: window.intentFixtures[family][i].props,
      tree: specimenRoot(e) ? walk(specimenRoot(e), "root") : null,
    })),
  };
}
