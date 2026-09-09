// Figma layout helper. Preserves every existing family section and its contents.
async function layoutIntentLibrary(records) {
  const page = await figma.getNodeByIdAsync("5:33");
  await figma.setCurrentPageAsync(page);
  const groups = {
    "01 · Actions": [],
    "02 · Forms": [],
    "03 · Content": [],
    "04 · Navigation": [],
    "05 · Color": [],
    "06 · Feedback": [],
    "07 · Data": [],
    "08 · Overlays": [],
  };
  const names = {
    "02 · Forms": [
      "Field",
      "Input",
      "Text Field",
      "Textarea",
      "Search Field",
      "Number Field",
      "Date Field",
      "Time Field",
      "Date Picker",
      "Date Range Picker",
      "Native Select",
      "Select",
      "Combo Box",
      "Multiple Select",
      "Input OTP",
      "Tag Field",
      "Tag Group",
      "Checkbox",
      "Radio",
      "Switch",
      "Slider",
    ],
    "04 · Navigation": [
      "Navbar",
      "Sidebar",
      "Breadcrumbs",
      "Tabs",
      "Pagination",
      "Tree",
      "List Box",
      "Grid List",
      "Choice Box",
      "Carousel",
      "Scroll Area",
      "Container",
    ],
    "06 · Feedback": [
      "Note",
      "Loader",
      "Meter",
      "Progress Bar",
      "Progress Circle",
      "Tracker",
      "Toast",
    ],
    "07 · Data": [
      "Table",
      "Bar List",
      "Leaderboard",
      "Bar Chart",
      "Area Chart",
      "Line Chart",
      "Pie Chart",
      "Snippet",
    ],
    "08 · Overlays": [
      "Dialog",
      "Modal",
      "Sheet",
      "Drawer",
      "Popover",
      "Tooltip",
      "Preview",
      "Menu",
      "Context Menu",
      "Command Menu",
    ],
  };
  for (const [family, r] of Object.entries(records)) {
    let group = family.startsWith("Color")
      ? "05 · Color"
      : family.startsWith("Button") ||
          family.startsWith("Toggle") ||
          ["Toolbar", "File Trigger", "Link", "Show More"].includes(family)
        ? "01 · Actions"
        : "03 · Content";
    for (const [key, list] of Object.entries(names))
      if (list.includes(family)) group = key;
    groups[group].push([family, r]);
  }
  const result = [],
    previous = [];
  let y = 0;
  for (const [name, items] of Object.entries(groups)) {
    const category = figma.createSection();
    category.name = name;
    page.appendChild(category);
    const heights = [56, 56, 56, 56, 56, 56],
      step = 912;
    for (const [family, r] of items) {
      const section = await figma.getNodeByIdAsync(r.sectionId);
      previous.push({
        id: section.id,
        parentId: section.parent.id,
        x: section.x,
        y: section.y,
      });
      const span = Math.min(6, Math.ceil((section.width + 56) / step));
      let column = 0,
        top = Infinity;
      for (let c = 0; c <= 6 - span; c++) {
        const next = Math.max(...heights.slice(c, c + span));
        if (next < top) {
          column = c;
          top = next;
        }
      }
      category.appendChild(section);
      section.x = 56 + column * step;
      section.y = top;
      for (let c = column; c < column + span; c++)
        heights[c] = top + section.height + 72;
    }
    category.resizeWithoutConstraints(5528, Math.max(...heights));
    category.x = 0;
    category.y = y;
    y += category.height + 160;
    result.push({
      id: category.id,
      name,
      families: items.length,
      width: category.width,
      height: category.height,
    });
  }
  return {
    categories: result,
    previousPositions: previous,
    pageId: page.id,
    families: Object.keys(records).length,
  };
}
