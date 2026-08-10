// Title: Forgot Password Page
// Path: src/app/forgot-password/page.tsx
// Functionality: Next.js route page for application workflows and screen composition.

'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { MailCheck, ShieldAlert, ShieldCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { en } from '@/localization/en';
import { ROUTES } from '@/config/routes';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSent(false);
    setIsLoading(true);

    try {
      const supabase = createClient();
      const redirectTo = `${window.location.origin}${ROUTES.authCallback}?next=${ROUTES.resetPassword}`;
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

      if (resetError) throw new Error(resetError.message);
      setSent(true);
    } catch {
      setError(en.auth.forgotPassword.sendError);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted p-4 selection:bg-muted">
      <Card className="w-full max-w-md shadow-xl border-border/60 bg-card/80 backdrop-blur-xl">
        <CardHeader className="space-y-3 text-center pb-6 pt-8">
          <div className="flex justify-center mb-1">
            <div className="h-12 w-12 bg-primary rounded-xl flex items-center justify-center shadow-md">
              <ShieldCheck className="h-6 w-6 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
            <h1>{en.auth.forgotPassword.title}</h1>
          </CardTitle>
          <CardDescription className="text-muted-foreground font-medium">
            {en.auth.forgotPassword.description}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2.5">
              <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {en.auth.emailLabel}
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder={en.auth.emailPlaceholder}
                value={email}
                onChange={event => setEmail(event.target.value)}
                required
                aria-invalid={Boolean(error)}
                aria-describedby={error ? 'forgot-error' : undefined}
                className="h-12 bg-muted/50 transition-all"
                disabled={isLoading}
              />
            </div>

            {sent && (
              <div role="status" className="bg-success/10 text-success p-3.5 rounded-lg flex items-center gap-3 text-sm font-medium border border-success/20">
                <MailCheck className="h-4 w-4 shrink-0" />
                <span>{en.auth.forgotPassword.sent}</span>
              </div>
            )}

            {error && (
              <div id="forgot-error" role="alert" className="bg-destructive/10 text-destructive p-3.5 rounded-lg flex items-center gap-3 text-sm font-medium border border-destructive/20">
                <ShieldAlert className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-base rounded-lg transition-all shadow-sm"
              disabled={isLoading}
            >
              {isLoading ? (
                <><Spinner className="mr-2 size-5 text-current" /> {en.auth.forgotPassword.loading}</>
              ) : (
                en.auth.forgotPassword.submit
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
