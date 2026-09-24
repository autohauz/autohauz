"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { BlogEditor } from "./blog-editor";
import { BlogImageUpload } from "./blog-image-upload";
import { createBlogArticle, updateBlogArticle, deleteBlogArticle } from "@/app/admin/blog/actions";
import type { BlogArticle, BlogCategory } from "@/lib/domain";

export function BlogForm({
  article,
  categories,
}: {
  article?: BlogArticle;
  categories: BlogCategory[];
}) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState(article?.body || "");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsPending(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    formData.set("body", body); // Add TipTap content

    try {
      if (article) {
        const res = await updateBlogArticle(article.id, formData);
        if (res.error) throw new Error(res.error);
        router.push("/admin/blog");
      } else {
        const res = await createBlogArticle(formData);
        if (res.error) throw new Error(res.error);
      }
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setIsPending(false);
    }
  };

  const handleDelete = async () => {
    if (!article || !confirm("Are you sure you want to delete this article? This cannot be undone.")) return;
    setIsPending(true);
    const res = await deleteBlogArticle(article.id);
    if (res?.error) setError(res.error);
    setIsPending(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 pb-12">
      {error && <div className="p-4 bg-danger/10 text-danger rounded-lg text-sm">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="space-y-1.5">
            <Label htmlFor="title">Title *</Label>
            <Input id="title" name="title" defaultValue={article?.title} required className="text-lg font-medium" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="slug">Slug (URL)</Label>
            <Input id="slug" name="slug" defaultValue={article?.slug} placeholder="auto-generated-if-left-blank" />
          </div>

          <div className="space-y-1.5">
            <Label>Content *</Label>
            <BlogEditor content={body} onChange={setBody} />
          </div>
          
          <div className="space-y-1.5">
            <Label htmlFor="excerpt">Excerpt (Short description)</Label>
            <Textarea id="excerpt" name="excerpt" defaultValue={article?.excerpt || ""} rows={3} />
          </div>
        </div>

        <div className="space-y-6">
          <div className="p-6 bg-card border border-border rounded-xl space-y-6">
            <h3 className="font-semibold text-foreground border-b border-border pb-2">Publishing</h3>
            
            <div className="space-y-1.5">
              <Label htmlFor="status">Status</Label>
              <Select id="status" name="status" defaultValue={article?.status || "draft"}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="scheduled">Scheduled</option>
                <option value="archived">Archived</option>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="categoryId">Category</Label>
              <Select id="categoryId" name="categoryId" defaultValue={article?.categoryId || ""}>
                <option value="">-- No Category --</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="authorName">Author Name</Label>
              <Input id="authorName" name="authorName" defaultValue={article?.authorName || ""} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="scheduledAt">Schedule Publish Time</Label>
              <Input 
                type="datetime-local" 
                id="scheduledAt" 
                name="scheduledAt" 
                defaultValue={article?.scheduledAt ? new Date(article.scheduledAt).toISOString().slice(0, 16) : ""} 
              />
              <p className="text-xs text-muted-foreground mt-1">Only applies if status is &quot;Scheduled&quot;.</p>
            </div>
          </div>

          <div className="p-6 bg-card border border-border rounded-xl space-y-6">
            <h3 className="font-semibold text-foreground border-b border-border pb-2">Media</h3>
            
            <BlogImageUpload initialUrl={article?.featuredImageUrl} name="featuredImageUrl" label="Featured Image" />
            
            <div className="space-y-1.5">
              <Label htmlFor="featuredImageAlt">Image Alt Text</Label>
              <Input id="featuredImageAlt" name="featuredImageAlt" defaultValue={article?.featuredImageAlt || ""} />
            </div>
          </div>

          <div className="p-6 bg-card border border-border rounded-xl space-y-6">
            <h3 className="font-semibold text-foreground border-b border-border pb-2">SEO</h3>
            
            <div className="space-y-1.5">
              <Label htmlFor="metaTitle">Meta Title (override)</Label>
              <Input id="metaTitle" name="metaTitle" defaultValue={article?.metaTitle || ""} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="metaDescription">Meta Description</Label>
              <Textarea id="metaDescription" name="metaDescription" defaultValue={article?.metaDescription || ""} rows={3} />
            </div>
            
            <div className="space-y-1.5">
              <Label htmlFor="canonicalUrl">Canonical URL</Label>
              <Input id="canonicalUrl" name="canonicalUrl" defaultValue={article?.canonicalUrl || ""} placeholder="https://..." />
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-6 border-t border-border">
        {article ? (
          <Button type="button" variant="ghost" className="text-danger hover:text-danger hover:bg-danger/10" onClick={handleDelete} disabled={isPending}>
            Delete Article
          </Button>
        ) : (
          <div /> // spacer
        )}
        
        <div className="flex gap-4">
          <Button type="button" variant="outline" onClick={() => router.back()} disabled={isPending}>
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving..." : article ? "Save Changes" : "Create Article"}
          </Button>
        </div>
      </div>
    </form>
  );
}
