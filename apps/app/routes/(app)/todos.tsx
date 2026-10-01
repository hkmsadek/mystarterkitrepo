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
} from "@repo/ui";
import { createFileRoute } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { useId, useState, type FormEvent } from "react";

import {
  useCreateTodo,
  useRemoveTodo,
  useSetTodoCompleted,
  useTodosQuery,
} from "#lib/queries/todo";

export const Route = createFileRoute("/(app)/todos")({
  component: Todos,
});

function Todos() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Todos</h2>
        <p className="text-muted-foreground">
          Your personal list. Only you can see it.
        </p>
      </div>

      <NewTodoForm />
      <TodoList />
    </div>
  );
}

function NewTodoForm() {
  const inputId = useId();
  const [title, setTitle] = useState("");
  const create = useCreateTodo();

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    create.mutate(trimmed, { onSuccess: () => setTitle("") });
  }

  return (
    <form onSubmit={onSubmit} className="flex items-end gap-2">
      <div className="flex-1 space-y-2">
        <Label htmlFor={inputId}>New todo</Label>
        <Input
          id={inputId}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="What needs doing?"
          maxLength={500}
          autoComplete="off"
        />
      </div>
      <Button type="submit" disabled={create.isPending || !title.trim()}>
        Add
      </Button>
      {create.error && (
        <p className="text-sm text-destructive">{create.error.message}</p>
      )}
    </form>
  );
}

function TodoList() {
  const { data, isPending, error } = useTodosQuery();
  const setCompleted = useSetTodoCompleted();
  const remove = useRemoveTodo();

  if (isPending) {
    return <p className="text-sm text-muted-foreground">Loading todos...</p>;
  }

  if (error) {
    return (
      <p className="text-sm text-destructive">
        Could not load todos: {error.message}
      </p>
    );
  }

  const remaining = data.filter((todo) => !todo.completed).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>List</CardTitle>
        <CardDescription>
          {data.length === 0
            ? "Nothing here yet."
            : `${remaining} of ${data.length} remaining`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {data.map((todo) => (
            <li key={todo.id} className="flex items-center gap-3 py-3">
              <Checkbox
                id={todo.id}
                checked={todo.completed}
                onCheckedChange={(checked) =>
                  setCompleted.mutate({
                    id: todo.id,
                    completed: checked === true,
                  })
                }
              />
              <Label
                htmlFor={todo.id}
                className={
                  todo.completed
                    ? "flex-1 line-through text-muted-foreground"
                    : "flex-1"
                }
              >
                {todo.title}
              </Label>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Delete ${todo.title}`}
                onClick={() => remove.mutate(todo.id)}
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
