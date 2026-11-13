import React, { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TextStyleKit } from "@tiptap/extension-text-style";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import { TableKit } from "@tiptap/extension-table";
import { richTextPlain } from "../../lib/richText";

export default function RichTextEditor({ document, onChange, onInsertImage }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3, 4] }, link: { openOnClick: false } }),
      TextStyleKit,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TableKit.configure({ table: { resizable: false } }),
    ],
    content: document,
    editorProps: { attributes: { "aria-label": "Rich article content", role: "textbox", "aria-multiline": "true" } },
    onUpdate: ({ editor: current }) => onChange(current.getJSON()),
  });
  useEffect(() => {
    if (editor && JSON.stringify(editor.getJSON()) !== JSON.stringify(document)) editor.commands.setContent(document, { emitUpdate: false });
  }, [document, editor]);
  if (!editor) return <p role="status">Preparing publishing editor...</p>;

  const toggle = (label, run, active = null, shortcut = "") => (
    <button
      key={label}
      type="button"
      aria-label={label}
      {...(active === null ? {} : { "aria-pressed": active })}
      aria-keyshortcuts={shortcut || undefined}
      title={shortcut ? `${label} (${shortcut})` : label}
      onClick={run}
    >{label}</button>
  );
  const setLink = () => {
    const href = window.prompt("HTTPS, HTTP or email URL", editor.getAttributes("link").href || "https://");
    if (href === null) return;
    if (!href) { editor.chain().focus().unsetLink().run(); return; }
    try {
      const url = new URL(href);
      if (!["https:", "http:", "mailto:"].includes(url.protocol)) throw new Error("Unsupported protocol");
      editor.chain().focus().setLink({ href: url.href }).run();
    } catch {
      window.alert("Enter a valid HTTP, HTTPS or email link.");
    }
  };

  return <div className="op-rich-editor" data-editor-scroll-boundary>
    <div className="op-rich-toolbar" role="toolbar" aria-label="Article formatting">
      {toggle("Bold", () => editor.chain().focus().toggleBold().run(), editor.isActive("bold"), "Control+B")}
      {toggle("Italic", () => editor.chain().focus().toggleItalic().run(), editor.isActive("italic"), "Control+I")}
      {toggle("Underline", () => editor.chain().focus().toggleUnderline().run(), editor.isActive("underline"), "Control+U")}
      {toggle("Strikethrough", () => editor.chain().focus().toggleStrike().run(), editor.isActive("strike"), "Control+Shift+X")}
      <label title="Choose paragraph or a semantic article heading">Structure
        <select aria-label="Text structure" value={editor.isActive("heading") ? editor.getAttributes("heading").level : "paragraph"} onChange={event => event.target.value === "paragraph" ? editor.chain().focus().setParagraph().run() : editor.chain().focus().setHeading({ level: Number(event.target.value) }).run()}>
          <option value="paragraph">Paragraph</option>
          {[1, 2, 3, 4].map(level => <option key={level} value={level}>{level === 4 ? "Heading 4 (legacy)" : `Heading ${level}`}</option>)}
        </select>
      </label>
      <label title="Choose an available article font">Font family
        <select aria-label="Font family" defaultValue="Arial" onChange={event => editor.chain().focus().setFontFamily(event.target.value).run()}>
          {["Arial", "Georgia", "Verdana"].map(font => <option key={font}>{font}</option>)}
        </select>
      </label>
      <label title="Choose a text size">Font size
        <select aria-label="Font size" defaultValue="16px" onChange={event => editor.chain().focus().setFontSize(event.target.value).run()}>
          {[12, 14, 16, 18, 20, 24, 28, 32].map(size => <option key={size}>{size}px</option>)}
        </select>
      </label>
      <label title="Choose text colour">Text colour
        <input type="color" aria-label="Text colour" defaultValue="#14283f" onChange={event => editor.chain().focus().setColor(event.target.value).run()} />
      </label>
      <label title="Choose highlight colour">Highlight colour
        <input type="color" aria-label="Highlight colour" defaultValue="#fff2b0" onChange={event => editor.chain().focus().setHighlight({ color: event.target.value }).run()} />
      </label>
      {["left", "center", "right", "justify"].map(align => toggle(`Align ${align}`, () => editor.chain().focus().setTextAlign(align).run(), editor.isActive({ textAlign: align })))}
      {toggle("Bulleted list", () => editor.chain().focus().toggleBulletList().run(), editor.isActive("bulletList"))}
      {toggle("Numbered list", () => editor.chain().focus().toggleOrderedList().run(), editor.isActive("orderedList"))}
      {toggle("Quote", () => editor.chain().focus().toggleBlockquote().run(), editor.isActive("blockquote"))}
      {toggle("Divider", () => editor.chain().focus().setHorizontalRule().run())}
      {toggle("Table", () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run())}
      {editor.isActive("table") && <>
        {toggle("Add row", () => editor.chain().focus().addRowAfter().run())}
        {toggle("Add column", () => editor.chain().focus().addColumnAfter().run())}
        {toggle("Delete table", () => editor.chain().focus().deleteTable().run())}
      </>}
      {toggle("Link", setLink, editor.isActive("link"))}
      {toggle("Insert image", () => onInsertImage?.())}
      {toggle("Remove formatting", () => editor.chain().focus().unsetAllMarks().clearNodes().unsetTextAlign().run())}
      {toggle("Undo", () => editor.chain().focus().undo().run(), null, "Control+Z")}
      {toggle("Redo", () => editor.chain().focus().redo().run(), null, "Control+Shift+Z")}
    </div>
    <EditorContent editor={editor} />
    <p className="op-blog-muted">{richTextPlain(editor.getJSON()).split(/\s+/).filter(Boolean).length} words. Images are inserted as structured article blocks with required alt text.</p>
  </div>;
}
