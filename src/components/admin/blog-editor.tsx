"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import Color from "@tiptap/extension-color";
import { TextStyle } from "@tiptap/extension-text-style";
import Underline from "@tiptap/extension-underline";
import Strike from "@tiptap/extension-strike";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import HorizontalRule from "@tiptap/extension-horizontal-rule";
import Blockquote from "@tiptap/extension-blockquote";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { common, createLowlight } from "lowlight";
import {
  Bold, Italic, Strikethrough, List, ListOrdered, Quote,
  Minus, Undo, Redo, Link as LinkIcon, Image as ImageIcon, Heading2, Heading3
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const lowlight = createLowlight(common);

const BLOG_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};
const BLOG_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

export function BlogEditor({
  content,
  onChange,
  placeholder = "Write your article here...",
}: {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
}) {
  const [isUploading, setIsUploading] = useState(false);
  const supabase = createClient();

  const editor = useEditor({
    extensions: [
      // StarterKit v3 bundles link/underline/strike; they are registered
      // below with their own config, so disable the bundled copies (TipTap
      // warns on duplicate extension names).
      StarterKit.configure({
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
        link: false,
        underline: false,
        strike: false,
      }),
      Placeholder.configure({ placeholder }),
      Image.configure({
        HTMLAttributes: {
          class: "rounded-lg max-w-full my-6",
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-primary underline underline-offset-4",
        },
      }),
      CharacterCount,
      CodeBlockLowlight.configure({ lowlight }),
      TextStyle,
      Color,
      Underline,
      Strike,
      Subscript,
      Superscript,
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      HorizontalRule,
      Blockquote,
      TaskList,
      TaskItem.configure({ nested: true }),
    ],
    content,
    editorProps: {
      attributes: {
        // The wrapper shows the focus ring (focus-within), so the surface itself needn't.
        class: "prose prose-sm sm:prose-base dark:prose-invert max-w-none focus:outline-none min-h-[400px] py-4",
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": "Article body",
      },
    },
    // Sanitised on the server when saved (admin/blog/actions.ts); the
    // browser is not a trust boundary, so no per-keystroke cleaning here.
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  const uploadImage = async (file: File): Promise<string | null> => {
    // The original filename never reaches storage: the key is random and the
    // extension comes from an allowlist of raster types (the `media` bucket
    // enforces the same MIME list server-side; SVG is excluded on purpose).
    const ext = BLOG_IMAGE_TYPES[file.type];
    if (!ext) {
      window.alert("Please choose a JPEG, PNG, WebP or AVIF image.");
      return null;
    }
    if (file.size > BLOG_IMAGE_MAX_BYTES) {
      window.alert("Images must be 10 MB or smaller.");
      return null;
    }
    setIsUploading(true);
    try {
      const filePath = `blog/${crypto.randomUUID()}.${ext}`;

      const { data, error } = await supabase.storage
        .from("media")
        .upload(filePath, file, { contentType: file.type, upsert: false });

      if (error) {
        console.error("Upload error", error);
        return null;
      }

      const { data: urlData } = supabase.storage.from("media").getPublicUrl(data.path);
      return urlData.publicUrl;
    } finally {
      setIsUploading(false);
    }
  };

  const addImage = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/jpeg,image/png,image/webp,image/avif";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const url = await uploadImage(file);
      if (url && editor) {
        editor.chain().focus().setImage({ src: url }).run();
      }
    };
    input.click();
  };

  const addLink = () => {
    const previousUrl = editor?.getAttributes("link").href;
    const url = window.prompt("URL", previousUrl);
    
    if (url === null) return; // cancelled
    if (url === "") {
      editor?.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    
    editor?.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  if (!editor) return null;

  // `active` is set only for toggles, so they expose aria-pressed; one-shot
  // commands (image, divider, undo) stay plain buttons.
  type ToolbarItem = { label: string; icon: typeof Bold; run: () => void; active?: boolean; disabled?: boolean };
  const toolbarGroups: ToolbarItem[][] = [
    [
      { label: "Bold", icon: Bold, run: () => editor.chain().focus().toggleBold().run(), active: editor.isActive("bold") },
      { label: "Italic", icon: Italic, run: () => editor.chain().focus().toggleItalic().run(), active: editor.isActive("italic") },
      { label: "Strikethrough", icon: Strikethrough, run: () => editor.chain().focus().toggleStrike().run(), active: editor.isActive("strike") },
    ],
    [
      { label: "Heading 2", icon: Heading2, run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), active: editor.isActive("heading", { level: 2 }) },
      { label: "Heading 3", icon: Heading3, run: () => editor.chain().focus().toggleHeading({ level: 3 }).run(), active: editor.isActive("heading", { level: 3 }) },
    ],
    [
      { label: "Bulleted list", icon: List, run: () => editor.chain().focus().toggleBulletList().run(), active: editor.isActive("bulletList") },
      { label: "Numbered list", icon: ListOrdered, run: () => editor.chain().focus().toggleOrderedList().run(), active: editor.isActive("orderedList") },
      { label: "Quote", icon: Quote, run: () => editor.chain().focus().toggleBlockquote().run(), active: editor.isActive("blockquote") },
    ],
    [
      { label: "Link", icon: LinkIcon, run: addLink, active: editor.isActive("link") },
      { label: "Insert image", icon: ImageIcon, run: addImage, disabled: isUploading },
    ],
    [{ label: "Divider", icon: Minus, run: () => editor.chain().focus().setHorizontalRule().run() }],
    [
      { label: "Undo", icon: Undo, run: () => editor.chain().focus().undo().run(), disabled: !editor.can().chain().focus().undo().run() },
      { label: "Redo", icon: Redo, run: () => editor.chain().focus().redo().run(), disabled: !editor.can().chain().focus().redo().run() },
    ],
  ];

  return (
    <div className="border border-input rounded-xl bg-card overflow-hidden flex flex-col focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring">
      <div
        role="toolbar"
        aria-label="Formatting"
        className="flex flex-wrap items-center gap-1 border-b border-border p-2 bg-muted/40 text-foreground"
      >
        {toolbarGroups.map((group, gi) => (
          <div key={gi} className="flex items-center gap-1">
            {gi > 0 ? <div className="w-px h-6 bg-border mx-1" aria-hidden="true" /> : null}
            {group.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={item.run}
                disabled={item.disabled}
                aria-label={item.label}
                aria-pressed={item.active === undefined ? undefined : item.active}
                title={item.label}
                className={cn(
                  "p-2 rounded hover:bg-muted transition-colors disabled:opacity-50",
                  item.active && "bg-muted text-primary",
                )}
              >
                <item.icon className="size-4" aria-hidden="true" />
              </button>
            ))}
          </div>
        ))}
      </div>

      <div className="flex-1 px-4 sm:px-6 relative text-foreground">
        <EditorContent editor={editor} />
        {isUploading && (
          <div className="absolute inset-0 bg-background/50 flex flex-col items-center justify-center backdrop-blur-sm z-10">
            <div className="size-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-2" />
            <p className="text-sm font-medium">Uploading image...</p>
          </div>
        )}
      </div>

      <div className="border-t border-border p-2 px-4 bg-muted/40 text-xs text-muted-foreground flex justify-between items-center">
        <span>{editor.storage.characterCount.words()} words</span>
        <span>{editor.storage.characterCount.characters()} characters</span>
      </div>
    </div>
  );
}
