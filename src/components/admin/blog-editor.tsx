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
  Bold, Italic, Strikethrough, Code, List, ListOrdered, Quote,
  Minus, Undo, Redo, Link as LinkIcon, Image as ImageIcon, Heading1, Heading2, Heading3
} from "lucide-react";
import { cn } from "@/lib/utils";
import DOMPurify from "isomorphic-dompurify";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const lowlight = createLowlight(common);

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
      StarterKit.configure({
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
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
        class: "prose prose-sm sm:prose-base dark:prose-invert max-w-none focus:outline-none min-h-[400px] py-4",
      },
    },
    onUpdate: ({ editor }) => {
      // DOMPurify to strip any malicious payload right at the boundary
      const html = DOMPurify.sanitize(editor.getHTML(), {
        USE_PROFILES: { html: true },
        ADD_ATTR: ['target', 'class'],
      });
      onChange(html);
    },
  });

  const uploadImage = async (file: File): Promise<string | null> => {
    setIsUploading(true);
    try {
      const rand = Math.random().toString(36).substring(2, 15);
      const filePath = `blog/\${rand}_\${Date.now()}-\${file.name}`;

      const { data, error } = await supabase.storage
        .from("media")
        .upload(filePath, file, { upsert: false });

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
    input.accept = "image/*";
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

  return (
    <div className="border border-border rounded-xl bg-card overflow-hidden flex flex-col">
      <div className="flex flex-wrap items-center gap-1 border-b border-border p-2 bg-muted/40 text-foreground">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={cn("p-2 rounded hover:bg-muted transition-colors", editor.isActive("bold") && "bg-muted text-primary")}
          title="Bold"
        >
          <Bold className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={cn("p-2 rounded hover:bg-muted transition-colors", editor.isActive("italic") && "bg-muted text-primary")}
          title="Italic"
        >
          <Italic className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={cn("p-2 rounded hover:bg-muted transition-colors", editor.isActive("strike") && "bg-muted text-primary")}
          title="Strike"
        >
          <Strikethrough className="size-4" />
        </button>
        
        <div className="w-px h-6 bg-border mx-1" />
        
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={cn("p-2 rounded hover:bg-muted transition-colors", editor.isActive("heading", { level: 2 }) && "bg-muted text-primary")}
          title="Heading 2"
        >
          <Heading2 className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={cn("p-2 rounded hover:bg-muted transition-colors", editor.isActive("heading", { level: 3 }) && "bg-muted text-primary")}
          title="Heading 3"
        >
          <Heading3 className="size-4" />
        </button>

        <div className="w-px h-6 bg-border mx-1" />

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={cn("p-2 rounded hover:bg-muted transition-colors", editor.isActive("bulletList") && "bg-muted text-primary")}
          title="Bullet List"
        >
          <List className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={cn("p-2 rounded hover:bg-muted transition-colors", editor.isActive("orderedList") && "bg-muted text-primary")}
          title="Numbered List"
        >
          <ListOrdered className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={cn("p-2 rounded hover:bg-muted transition-colors", editor.isActive("blockquote") && "bg-muted text-primary")}
          title="Quote"
        >
          <Quote className="size-4" />
        </button>
        
        <div className="w-px h-6 bg-border mx-1" />
        
        <button
          type="button"
          onClick={addLink}
          className={cn("p-2 rounded hover:bg-muted transition-colors", editor.isActive("link") && "bg-muted text-primary")}
          title="Link"
        >
          <LinkIcon className="size-4" />
        </button>
        <button
          type="button"
          onClick={addImage}
          disabled={isUploading}
          className="p-2 rounded hover:bg-muted transition-colors disabled:opacity-50"
          title="Insert Image"
        >
          <ImageIcon className="size-4" />
        </button>
        
        <div className="w-px h-6 bg-border mx-1" />
        
        <button
          type="button"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          className="p-2 rounded hover:bg-muted transition-colors"
          title="Divider"
        >
          <Minus className="size-4" />
        </button>

        <div className="w-px h-6 bg-border mx-1" />

        <button
          type="button"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().chain().focus().undo().run()}
          className="p-2 rounded hover:bg-muted transition-colors disabled:opacity-50"
          title="Undo"
        >
          <Undo className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().chain().focus().redo().run()}
          className="p-2 rounded hover:bg-muted transition-colors disabled:opacity-50"
          title="Redo"
        >
          <Redo className="size-4" />
        </button>
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
