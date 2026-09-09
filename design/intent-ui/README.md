# Intent UI design kit

[Open the Components page in Figma](https://www.figma.com/design/GKcLMKxdpBxMcSGL8iAdxV?node-id=5-33).

This custom project kit follows the installed Intent UI source. It is an
unpublished draft, not an official Intent UI Figma release.

All components are on one **Components** page, grouped into Actions, Forms,
Content, Navigation, Color, Feedback, Data, and Overlays. The cover, usage guide,
and foundation guides remain separate. A Light/Dark reference panel contains
instances of representative components.

## Coverage

The kit contains 94 component sets and 303 desktop specimens, including shared
Heroicons. All 89 installed UI source files are represented. `Chart.tsx`,
`Dropdown.tsx`, and `ColorThumb.tsx` appear within their parent components.

These are representative visual states, not every possible combination of
responsive layout, hover, focus, validation, loading, and interaction states.
Keyboard handling, focus management, screen-reader semantics, animation, and
application behavior remain in the React components.

Use the Figma Assets panel to insert instances. Variant and text properties are
editable; square Button variants also expose icon swap and visibility properties.
Set the Color variable collection to Light or Dark on a parent frame.

`library-index.json` records source files, Figma IDs, direct component links,
counts, and validation findings. Code Connect is not enabled: the current file
is an unpublished Pro draft, while Code Connect requires a published library
on an Organization or Enterprise plan.

## Local reference gallery

Run `npm run dev:frontend`, then open:

```
http://127.0.0.1:5173/design/intent-ui/index.html?family=Button%2Fprimary
```

The gallery renders the actual installed React components. `Specimens.jsx`
defines examples, and `Capture.js` measures rendered geometry and colors in
both themes. It is a separate Vite development entry; the production app does
not import it. These design tools do not add a product route.

`FigmaBuild.js` and `FigmaLayout.js` are Figma Plugin API helpers, not standalone
Node commands. The layout helper preserves existing family contents and returns
their previous positions. Reconcile the index with the live file before another
import; generation is not automatic synchronization.

## Validation notes

Every family was checked with Figma metadata and a screenshot. The final audit
found no duplicate component-set names, broken variable aliases, unbound solid
paints, or unbound gradient stops on the Components page. All six pages were
captured in the final review, and representative Light/Dark instances were
visually checked.

The source palette has two text-contrast limitations in both themes: white on
solid success is 3.67:1, and danger foreground on solid danger is 4.36:1. Both
are below a 4.5:1 target for normal-size text. The kit preserves the installed
palette and records this finding in its usage guide.

No library publication, Code Connect publication, application deployment,
Git commit, or push was performed.
