"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createBlogCategory, updateBlogCategory, deleteBlogCategory } from "@/app/admin/blog/actions";
import type { BlogCategory } from "@/lib/domain";
import { Edit, Trash2, Plus } from "lucide-react";

export function CategoryManager({ initialCategories }: { initialCategories: BlogCategory[] }) {
  const [categories, setCategories] = useState(initialCategories);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsPending(true);
    setError(null);
    
    const formData = new FormData(e.currentTarget);
    const id = formData.get("id")?.toString();

    try {
      if (id) {
        const res = await updateBlogCategory(id, formData);
        if (res.error) throw new Error(res.error);
        setCategories(categories.map(c => c.id === id ? { ...c, name: formData.get("name") as string, slug: formData.get("slug") as string } : c));
        setEditingId(null);
      } else {
        const res = await createBlogCategory(formData);
        if (res.error) throw new Error(res.error);
        // Optimistic refresh would be better, but for now we just reload
        window.location.reload();
      }
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setIsPending(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete category? This might leave some articles uncategorized.")) return;
    setIsPending(true);
    const res = await deleteBlogCategory(id);
    if (res.error) setError(res.error);
    else setCategories(categories.filter(c => c.id !== id));
    setIsPending(false);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      <div className="md:col-span-2">
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 text-muted-foreground border-b border-border">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Slug</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {categories.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3 text-foreground font-medium">{c.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.slug}</td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" onClick={() => setEditingId(c.id)}>
                      <Edit className="size-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(c.id)} className="text-danger hover:text-danger hover:bg-danger/10">
                      <Trash2 className="size-4" />
                    </Button>
                  </td>
                </tr>
              ))}
              {categories.length === 0 && (
                <tr><td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">No categories yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <form onSubmit={handleSubmit} className="p-6 bg-card border border-border rounded-xl space-y-4">
          <h3 className="font-semibold text-lg">{editingId ? "Edit Category" : "New Category"}</h3>
          {error && <div className="p-3 bg-danger/10 text-danger rounded-lg text-sm">{error}</div>}
          
          <input type="hidden" name="id" value={editingId || ""} />
          
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" required defaultValue={editingId ? categories.find(c => c.id === editingId)?.name : ""} />
          </div>
          
          <div className="space-y-1.5">
            <Label htmlFor="slug">Slug</Label>
            <Input id="slug" name="slug" defaultValue={editingId ? categories.find(c => c.id === editingId)?.slug : ""} placeholder="Auto-generated" />
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={isPending} className="flex-1">
              {isPending ? "Saving..." : editingId ? "Save Changes" : "Create"}
            </Button>
            {editingId && (
              <Button type="button" variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
