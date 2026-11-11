import React, { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TextStyleKit } from "@tiptap/extension-text-style";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import { TableKit } from "@tiptap/extension-table";
import { richTextPlain } from "../../lib/richText";

export default function RichTextEditor({ document, onChange }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3, 4] }, link: { openOnClick: false } }),
      TextStyleKit, Highlight.configure({ multicolor: true }),
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
  const toggle = (label, run, active = false) => <button key={label} type="button" aria-pressed={active} onClick={run}>{label}</button>;
  return <div className="op-rich-editor">
    <div className="op-rich-toolbar" role="toolbar" aria-label="Article formatting">
      {["bold", "italic", "underline", "strike"].map(mark => toggle(mark, () => editor.chain().focus()[`toggle${mark[0].toUpperCase()}${mark.slice(1)}`]().run(), editor.isActive(mark)))}
      <label>Structure<select aria-label="Text structure" value={editor.isActive("heading") ? editor.getAttributes("heading").level : "paragraph"} onChange={e => e.target.value === "paragraph" ? editor.chain().focus().setParagraph().run() : editor.chain().focus().setHeading({ level: Number(e.target.value) }).run()}><option value="paragraph">Paragraph</option>{[1, 2, 3, 4].map(n => <option key={n} value={n}>H{n}</option>)}</select></label>
      <label>Font<select aria-label="Font family" onChange={e => editor.chain().focus().setFontFamily(e.target.value).run()}><option>Arial</option><option>Georgia</option><option>Verdana</option></select></label>
      <label>Size<select aria-label="Font size" defaultValue="16px" onChange={e => editor.chain().focus().setFontSize(e.target.value).run()}>{[12, 14, 16, 18, 20, 24, 28, 32].map(n => <option key={n}>{n}px</option>)}</select></label>
      <label>Text colour<input type="color" aria-label="Text colour" defaultValue="#14283f" onChange={e => editor.chain().focus().setColor(e.target.value).run()} /></label>
      <label>Highlight<input type="color" aria-label="Highlight colour" defaultValue="#fff2b0" onChange={e => editor.chain().focus().setHighlight({ color: e.target.value }).run()} /></label>
      {["left", "center", "right", "justify"].map(align => toggle(align, () => editor.chain().focus().setTextAlign(align).run(), editor.isActive({ textAlign: align })))}
      {toggle("Bullets", () => editor.chain().focus().toggleBulletList().run(), editor.isActive("bulletList"))}
      {toggle("Numbered list", () => editor.chain().focus().toggleOrderedList().run(), editor.isActive("orderedList"))}
      {toggle("Quote", () => editor.chain().focus().toggleBlockquote().run(), editor.isActive("blockquote"))}
      {toggle("Divider", () => editor.chain().focus().setHorizontalRule().run())}
      {toggle("Table", () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run())}
      {editor.isActive("table") && <>{toggle("Add row", () => editor.chain().focus().addRowAfter().run())}{toggle("Add column", () => editor.chain().focus().addColumnAfter().run())}{toggle("Delete table", () => editor.chain().focus().deleteTable().run())}</>}
      {toggle("Link", () => {
        const href = window.prompt("HTTPS, HTTP or email URL", editor.getAttributes("link").href || "https://");
        if (href === null) return;
        if (!href) { editor.chain().focus().unsetLink().run(); return; }
        try {
          const u = new URL(href);
          if (!["https:", "http:", "mailto:"].includes(u.protocol)) throw new Error("Unsupported protocol");
          editor.chain().focus().setLink({ href: u.href }).run();
        } catch { window.alert("Enter a valid HTTP, HTTPS or email link."); }
      })}
      {toggle("Clear formatting", () => editor.chain().focus().unsetAllMarks().clearNodes().run())}
      {toggle("Undo", () => editor.chain().focus().undo().run())}
      {toggle("Redo", () => editor.chain().focus().redo().run())}
    </div>
    <EditorContent editor={editor} />
    <p className="op-blog-muted">{richTextPlain(editor.getJSON()).split(/\s+/).filter(Boolean).length} words. Images remain structured private media blocks outside the rich text fragment.</p>
  </div>;
}
