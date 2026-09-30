import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  Input,
  Label,
  Textarea,
} from "@repo/ui";
import { createFileRoute } from "@tanstack/react-router";
import { ExternalLink, Trash2 } from "lucide-react";
import { useId, useState, type FormEvent } from "react";

import {
  useAllPostsQuery,
  useCreatePost,
  useRemovePost,
} from "#lib/queries/blog";

export const Route = createFileRoute("/posts")({
  component: Posts,
});

function Posts() {
  return (
    <div className="mx-auto max-w-3xl p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Blog posts</h2>
        <p className="text-muted-foreground">
          Public test page, no sign-in required. Published posts appear on the
          blog immediately. No rebuild.
        </p>
      </div>

      <NewPostForm />
      <PostList />
    </div>
  );
}

function slugify(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function NewPostForm() {
  const ids = {
    title: useId(),
    slug: useId(),
    excerpt: useId(),
    content: useId(),
    published: useId(),
  };
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [excerpt, setExcerpt] = useState("");
  const [content, setContent] = useState("");
  const [published, setPublished] = useState(true);
  const create = useCreatePost();

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    create.mutate(
      { title, slug, excerpt, content, published },
      {
        onSuccess: () => {
          setTitle("");
          setSlug("");
          setSlugEdited(false);
          setExcerpt("");
          setContent("");
        },
      },
    );
  }

  const ready = title.trim() && slug.trim() && excerpt.trim() && content.trim();

  return (
    <Card>
      <CardHeader>
        <CardTitle>New post</CardTitle>
        <CardDescription>
          Paragraphs are separated by a blank line.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={ids.title}>Title</Label>
              <Input
                id={ids.title}
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (!slugEdited) setSlug(slugify(e.target.value));
                }}
                maxLength={200}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={ids.slug}>Slug</Label>
              <Input
                id={ids.slug}
                value={slug}
                onChange={(e) => {
                  setSlugEdited(true);
                  setSlug(e.target.value);
                }}
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                maxLength={120}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor={ids.excerpt}>Excerpt</Label>
            <Input
              id={ids.excerpt}
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              maxLength={500}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={ids.content}>Content</Label>
            <Textarea
              id={ids.content}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={8}
              required
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id={ids.published}
              checked={published}
              onCheckedChange={(checked) => setPublished(checked === true)}
            />
            <Label htmlFor={ids.published}>Publish now</Label>
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={create.isPending || !ready}>
              Save post
            </Button>
            {create.error && (
              <p className="text-sm text-destructive">{create.error.message}</p>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function PostList() {
  const { data, isPending, error } = useAllPostsQuery();
  const remove = useRemovePost();

  if (isPending) {
    return <p className="text-sm text-muted-foreground">Loading posts...</p>;
  }
  if (error) {
    return (
      <p className="text-sm text-destructive">
        Could not load posts: {error.message}
      </p>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>All posts</CardTitle>
        <CardDescription>
          {data.length === 0 ? "Nothing written yet." : `${data.length} total`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {data.map((p) => (
            <li key={p.id} className="flex items-center gap-3 py-3">
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{p.title}</p>
                <p className="text-sm text-muted-foreground truncate">
                  /blog/{p.slug} · {p.published ? "published" : "draft"}
                </p>
              </div>
              {p.published && (
                <Button variant="ghost" size="icon" asChild>
                  {/* Document navigation: /blog is owned by the marketing site. */}
                  <a
                    href={`/blog/${p.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Open ${p.title}`}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Delete ${p.title}`}
                onClick={() => remove.mutate(p.id)}
                disabled={remove.isPending}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
