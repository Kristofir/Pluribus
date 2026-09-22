import { useRef, useState } from "react";
import { useEditorState, type Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import {
  BoldIcon,
  ItalicIcon,
  ChevronDownIcon,
} from "@heroicons/react/24/outline";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "../../components/ui/Select";

const textPresets = [
  { id: "paragraph", label: "Text" },
  { id: "1", label: "Heading 1" },
  { id: "2", label: "Heading 2" },
  { id: "3", label: "Heading 3" },
];

/** A single selection menu serves cards and the full document editor. */
export function SelectionFormattingMenu({
  editor,
  documentId,
  disabled,
}: {
  editor: Editor;
  documentId: string;
  disabled: boolean;
}) {
  const [presetsOpen, setPresetsOpen] = useState(false);
  const presetsOpenRef = useRef(false);
  const state = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: editor.isActive("bold"),
      italic: editor.isActive("italic"),
      block: editor.isActive("heading", { level: 1 })
        ? "1"
        : editor.isActive("heading", { level: 2 })
          ? "2"
          : editor.isActive("heading", { level: 3 })
            ? "3"
            : "paragraph",
    }),
  });
  const canFormat = !disabled && editor.isEditable && !editor.isDestroyed;
  return (
    <BubbleMenu
      editor={editor}
      className="selection-formatting-menu nodrag nopan"
      role="toolbar"
      aria-label="Selected text formatting"
      updateDelay={0}
      data-document-formatting-for={documentId}
      appendTo={() => document.body}
      options={{
        strategy: "fixed",
        placement: "top",
        offset: 10,
        flip: true,
        shift: { padding: 8 },
      }}
      shouldShow={({ editor, from, to }) =>
        canFormat && from !== to && (editor.isFocused || presetsOpenRef.current)
      }
      onMouseDown={(event) => event.stopPropagation()}
      onPointerDownCapture={(event) => {
        if (
          event.target instanceof Element &&
          event.target.closest(".selection-text-preset-trigger")
        )
          presetsOpenRef.current = true;
      }}
      onPointerDown={(event) => {
        if (event.target instanceof Element && event.target.closest("button"))
          event.preventDefault();
        event.stopPropagation();
      }}
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        aria-label="Bold"
        title="Bold"
        aria-pressed={state.bold}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <BoldIcon aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-label="Italic"
        title="Italic"
        aria-pressed={state.italic}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <ItalicIcon aria-hidden="true" />
      </button>
      <Select
        aria-label="Text style"
        selectedKey={state.block}
        isOpen={presetsOpen}
        isDisabled={!canFormat}
        onOpenChange={(open) => {
          presetsOpenRef.current = open;
          setPresetsOpen(open);
        }}
        onSelectionChange={(key) => {
          if (!canFormat) return;
          if (key === "paragraph") editor.chain().focus().setParagraph().run();
          else if (key === "1" || key === "2" || key === "3")
            editor
              .chain()
              .focus()
              .setHeading({ level: Number(key) as 1 | 2 | 3 })
              .run();
        }}
      >
        <SelectTrigger className="selection-text-preset-trigger">
          <span>
            {textPresets.find((preset) => preset.id === state.block)?.label}
          </span>
          <ChevronDownIcon aria-hidden="true" />
        </SelectTrigger>
        <SelectContent
          items={textPresets}
          popover={{
            className: "selection-text-presets",
            ...{ "data-document-formatting-for": documentId },
          }}
        >
          {(preset) => (
            <SelectItem id={preset.id} textValue={preset.label}>
              {preset.label}
            </SelectItem>
          )}
        </SelectContent>
      </Select>
    </BubbleMenu>
  );
}
