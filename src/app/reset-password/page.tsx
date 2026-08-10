// Title: Reset Password Page
// Path: src/app/reset-password/page.tsx
// Functionality: Next.js route page for application workflows and screen composition.

'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { CheckCircle2, ShieldAlert } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { isPasswordPolicySatisfied } from '@/config/auth';
import { en } from '@/localization/en';
import { ROUTES } from '@/config/routes';
import { AuthAcceptanceService } from '@/services/AuthAcceptanceService';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(false);

    if (password !== confirmPassword) {
      setError(en.auth.resetPassword.mismatchError);
      return;
    }

    if (!isPasswordPolicySatisfied(password)) {
      setError(en.auth.passwordPolicyError);
      return;
    }

    setIsLoading(true);

    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) throw new Error(updateError.message);
      // An admin-provisioned resident accepts here (sets their password): finalize the
      // account so the intended apartment is occupied + approved atomically (0018).
      // Best-effort and a no-op for ordinary password resets; must not block success.
      try { await AuthAcceptanceService.finalizePendingAccount(supabase); } catch { /* non-blocking */ }
      setPassword('');
      setConfirmPassword('');
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : en.auth.resetPassword.updateError);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted p-4 selection:bg-muted">
      <Card className="w-full max-w-md shadow-xl border-border/60 bg-card/80 backdrop-blur-xl">
        <CardHeader className="space-y-3 text-center pb-6 pt-6">
          <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
            <h1>{en.auth.resetPassword.title}</h1>
          </CardTitle>
          <CardDescription className="text-muted-foreground font-medium">
            {en.auth.resetPassword.description}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-4">
              <div className="space-y-2.5">
                <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {en.auth.resetPassword.newPasswordLabel}
                </Label>
                <Input
                  id="password"
                  name="new-password"
                  type="password"
                  autoComplete="new-password"
                  placeholder={en.auth.passwordPolicyPlaceholder}
                  value={password}
                  onChange={event => setPassword(event.target.value)}
                  required
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? 'reset-error' : undefined}
                  className="h-12 bg-muted/50 transition-all"
                  disabled={isLoading || success}
                />
              </div>
              <div className="space-y-2.5">
                <Label htmlFor="confirmPassword" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {en.auth.resetPassword.confirmPasswordLabel}
                </Label>
                <Input
                  id="confirmPassword"
                  name="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  placeholder={en.auth.resetPassword.confirmPasswordPlaceholder}
                  value={confirmPassword}
                  onChange={event => setConfirmPassword(event.target.value)}
                  required
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? 'reset-error' : undefined}
                  className="h-12 bg-muted/50 transition-all"
                  disabled={isLoading || success}
                />
              </div>
            </div>

            {success && (
              <div role="status" className="bg-success/10 text-success p-3.5 rounded-lg flex items-center gap-3 text-sm font-medium border border-success/20">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{en.auth.resetPassword.success}</span>
              </div>
            )}

            {error && (
              <div id="reset-error" role="alert" className="bg-destructive/10 text-destructive p-3.5 rounded-lg flex items-center gap-3 text-sm font-medium border border-destructive/20">
                <ShieldAlert className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-base rounded-lg transition-all shadow-sm"
              disabled={isLoading || success}
            >
              {isLoading ? (
                <><Spinner className="mr-2 size-5 text-current" /> {en.auth.resetPassword.loading}</>
              ) : (
                en.auth.resetPassword.submit
              )}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="justify-center border-t border-border pt-6 pb-6">
          <Link href={ROUTES.login} className="text-sm font-semibold text-foreground hover:underline px-2 py-1 rounded-md hover:bg-muted transition-colors">
            {en.auth.forgotPassword.backToSignIn}
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
