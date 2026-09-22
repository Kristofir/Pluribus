# Landing page QA

- Reference: `/var/folders/gx/_qxslb157bbcx88tkv6hgnbc0000gn/T/codex-clipboard-0a826c44-d2e1-4586-93ff-46b78e786c5f.png`.
- State: anonymous guest on the local development backend.

The centered headline, white Google CTA, dark background and canvas framing
follow the reference. The actual `CanvasPage` renders the Carol Document at left,
an Image sample above right, and a Web Page below right. Its document editor,
card menu, History and workspace presence use the normal application code.
The Image is a local illustration, not a persisted upload.

After reloading the local landing page, the live Web Page card displayed the
captured Gatorade Thirst Quencher Fruit Punch product title, exact requested URL,
page text and screenshot. Right-click created a real Document card; Undo removed
it. The narrow 617px view shows all three cards without the minimap obscuring
them. Guest workspaces are isolated by anonymous owner on backend requests and
persist beyond a tab session. A browser edit inserted `TEST RESET` into the Carol
note; reload restored the exact seed text and kept the captured Gatorade page.
Visitors cannot upload images or request another
page capture from the demo.

Validation: 65 test files passed (370 tests, one skipped), and the production
build passed. The first full check found formatting in two frontend files; those
files were formatted and the check rerun.
