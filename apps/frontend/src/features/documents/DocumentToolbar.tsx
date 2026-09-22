import type { ComponentType, SVGProps } from "react";
import { useEditorState, type Editor } from "@tiptap/react";
import {
  ArrowUturnLeftIcon,
  ArrowUturnRightIcon,
  BoldIcon,
  ItalicIcon,
  StrikethroughIcon,
  ListBulletIcon,
  NumberedListIcon,
} from "@heroicons/react/24/outline";

/** Formatting is presentation; this toolbar shares the mounted editor and its selection. */
export function DocumentToolbar({
  editor,
  disabled,
  historyDisabled,
}: {
  editor: Editor | null;
  disabled: boolean;
  historyDisabled: boolean;
}) {
  const state = useEditorState({
    editor,
    selector: ({ editor }) =>
      editor
        ? {
            block: editor.isActive("heading", { level: 1 })
              ? "1"
              : editor.isActive("heading", { level: 2 })
                ? "2"
                : editor.isActive("heading", { level: 3 })
                  ? "3"
                  : editor.isActive("paragraph")
                    ? "paragraph"
                    : "other",
            bold: editor.isActive("bold"),
            italic: editor.isActive("italic"),
            strike: editor.isActive("strike"),
            bulletList: editor.isActive("bulletList"),
            orderedList: editor.isActive("orderedList"),
            canUndo: editor.can().undo(),
            canRedo: editor.can().redo(),
            canBold: editor.can().toggleBold(),
            canItalic: editor.can().toggleItalic(),
            canStrike: editor.can().toggleStrike(),
            canBulletList: editor.can().toggleBulletList(),
            canOrderedList: editor.can().toggleOrderedList(),
            canParagraph: editor.can().setParagraph(),
            canH1: editor.can().setHeading({ level: 1 }),
            canH2: editor.can().setHeading({ level: 2 }),
            canH3: editor.can().setHeading({ level: 3 }),
          }
        : null,
  });
  const locked = disabled || !editor || !state;
  const run = (command: (editor: Editor) => void) => {
    if (!locked && editor && !editor.isDestroyed && editor.isEditable)
      command(editor);
  };
  return (
    <div
      className="document-formatting-toolbar"
      role="toolbar"
      aria-label="Document formatting"
      onKeyDown={(event) => {
        if (
          !(event.target instanceof HTMLButtonElement) ||
          !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
        )
          return;
        const controls = Array.from(
          event.currentTarget.querySelectorAll<
            HTMLButtonElement | HTMLSelectElement
          >("button:not(:disabled), select:not(:disabled)"),
        );
        const index = controls.indexOf(event.target);
        if (index < 0 || !controls.length) return;
        event.preventDefault();
        const next =
          event.key === "Home"
            ? 0
            : event.key === "End"
              ? controls.length - 1
              : (index +
                  (event.key === "ArrowRight" ? 1 : -1) +
                  controls.length) %
                controls.length;
        controls[next]?.focus();
      }}
    >
      <div role="group" aria-label="History" className="document-format-group">
        <ToolButton
          label="Undo"
          icon={ArrowUturnLeftIcon}
          disabled={locked || historyDisabled || !state?.canUndo}
          onClick={() =>
            run((editor) => {
              editor.chain().focus().undo().run();
            })
          }
        />
        <ToolButton
          label="Redo"
          icon={ArrowUturnRightIcon}
          disabled={locked || historyDisabled || !state?.canRedo}
          onClick={() =>
            run((editor) => {
              editor.chain().focus().redo().run();
            })
          }
        />
      </div>
      <div
        role="group"
        aria-label="Text style"
        className="document-format-group"
      >
        <select
          aria-label="Paragraph style"
          title="Paragraph style"
          className="document-format-select"
          disabled={locked}
          value={state?.block ?? "paragraph"}
          onChange={(event) => {
            const value = event.target.value;
            run((editor) => {
              if (value === "paragraph")
                editor.chain().focus().setParagraph().run();
              else if (value === "1" || value === "2" || value === "3")
                editor
                  .chain()
                  .focus()
                  .setHeading({ level: Number(value) as 1 | 2 | 3 })
                  .run();
            });
          }}
        >
          <option value="other" disabled>
            Text style
          </option>
          <option value="paragraph" disabled={!state?.canParagraph}>
            Paragraph
          </option>
          <option value="1" disabled={!state?.canH1}>
            Heading 1
          </option>
          <option value="2" disabled={!state?.canH2}>
            Heading 2
          </option>
          <option value="3" disabled={!state?.canH3}>
            Heading 3
          </option>
        </select>
      </div>
      <div role="group" aria-label="Lists" className="document-format-group">
        <ToolButton
          label="Bullet list"
          icon={ListBulletIcon}
          pressed={state?.bulletList ?? false}
          disabled={locked || !state?.canBulletList}
          onClick={() =>
            run((editor) => {
              editor.chain().focus().toggleBulletList().run();
            })
          }
        />
        <ToolButton
          label="Numbered list"
          icon={NumberedListIcon}
          pressed={state?.orderedList ?? false}
          disabled={locked || !state?.canOrderedList}
          onClick={() =>
            run((editor) => {
              editor.chain().focus().toggleOrderedList().run();
            })
          }
        />
      </div>
      <div
        role="group"
        aria-label="Inline formatting"
        className="document-format-group"
      >
        <ToolButton
          label="Bold"
          icon={BoldIcon}
          pressed={state?.bold ?? false}
          disabled={locked || !state?.canBold}
          onClick={() =>
            run((editor) => {
              editor.chain().focus().toggleBold().run();
            })
          }
        />
        <ToolButton
          label="Italic"
          icon={ItalicIcon}
          pressed={state?.italic ?? false}
          disabled={locked || !state?.canItalic}
          onClick={() =>
            run((editor) => {
              editor.chain().focus().toggleItalic().run();
            })
          }
        />
        <ToolButton
          label="Strikethrough"
          icon={StrikethroughIcon}
          pressed={state?.strike ?? false}
          disabled={locked || !state?.canStrike}
          onClick={() =>
            run((editor) => {
              editor.chain().focus().toggleStrike().run();
            })
          }
        />
      </div>
    </div>
  );
}
function ToolButton({
  label,
  icon: Icon,
  disabled,
  pressed,
  onClick,
}: {
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  disabled: boolean;
  pressed?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="document-format-button"
      title={label}
      aria-label={label}
      aria-pressed={pressed}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      <Icon aria-hidden="true" />
    </button>
  );
}
