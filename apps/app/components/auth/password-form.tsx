import { Button, Input, Label } from "@repo/ui";
import { ArrowLeft } from "lucide-react";
import { useId, useState, type SubmitEvent } from "react";

import { auth } from "#lib/auth";
import { authConfig } from "#lib/auth-config";

interface PasswordFormProps {
  mode: "login" | "signup";
  isDisabled: boolean;
  onSuccess: () => void;
  onError: (error: string | null) => void;
  onLoadingChange: (loading: boolean) => void;
  onBack: () => void;
  /** Switch to the emailed one-time code instead. */
  onUseCode: () => void;
}

/**
 * Email and password sign-in or sign-up.
 *
 * Better Auth resolves with `{ error }` rather than throwing, so the result is
 * checked explicitly. Sign-up needs no verification step: the account is
 * usable as soon as it is created (`requireEmailVerification` is off).
 */
export function PasswordForm({
  mode,
  isDisabled,
  onSuccess,
  onError,
  onLoadingChange,
  onBack,
  onUseCode,
}: PasswordFormProps) {
  const ids = { name: useId(), email: useId(), password: useId() };
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const isSignup = mode === "signup";

  async function onSubmit(event: SubmitEvent) {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) return;

    onError(null);
    onLoadingChange(true);
    try {
      const result = isSignup
        ? await auth.signUp.email({
            name: name.trim() || normalizedEmail.split("@")[0],
            email: normalizedEmail,
            password,
          })
        : await auth.signIn.email({ email: normalizedEmail, password });

      if (result.error) {
        onError(result.error.message || authConfig.errors.genericError);
        return;
      }
      onSuccess();
    } catch (error) {
      console.error("Password auth error:", error);
      onError(authConfig.errors.networkError);
    } finally {
      onLoadingChange(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-center">
        {isSignup ? "Create your account" : "Log in with your password"}
      </h1>

      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        {isSignup && (
          <div className="space-y-1">
            <Label htmlFor={ids.name}>Name</Label>
            <Input
              id={ids.name}
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isDisabled}
              autoComplete="name"
              // First field of the form, as with the email step.
              // oxlint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
            />
          </div>
        )}
        <div className="space-y-1">
          <Label htmlFor={ids.email}>Email</Label>
          <Input
            id={ids.email}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isDisabled}
            autoComplete="email"
            // oxlint-disable-next-line jsx-a11y/no-autofocus
            autoFocus={!isSignup}
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={ids.password}>Password</Label>
          <Input
            id={ids.password}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isDisabled}
            autoComplete={isSignup ? "new-password" : "current-password"}
            minLength={8}
            required
          />
        </div>
        <Button
          type="submit"
          className="w-full"
          disabled={isDisabled || !email.trim() || password.length < 8}
        >
          {isSignup ? "Create account" : "Log in"}
        </Button>
      </form>

      <button
        type="button"
        onClick={onUseCode}
        disabled={isDisabled}
        className="text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
      >
        Email me a one-time code instead
      </button>

      <button
        type="button"
        onClick={onBack}
        disabled={isDisabled}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to {isSignup ? "sign up" : "login"}
      </button>
    </div>
  );
}
