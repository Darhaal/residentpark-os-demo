// Title: Login Page Component
// Path: src/app/login/page.tsx
// Functionality: Secure authentication entry point with Open Redirect protection.

'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff, ShieldAlert, ShieldCheck } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import Link from 'next/link';
import { en } from '@/localization/en';
import { getSafeRedirectPath, ROUTES } from '@/config/routes';

function LoginForm() {
  const supabase = createClient();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        throw new Error(en.auth.login.invalidCredentials);
      }

      if (data.user) {
        // Read ?next= at submit time (client event, window is available) instead of
        // useSearchParams — the hook forces a Suspense bailout that strips the whole
        // form from the static prerender. Register reads ?invite= the same way.
        const safeNext = getSafeRedirectPath(new URLSearchParams(window.location.search).get('next'));
        // Full reload (not router.push) so the new session starts from a clean client
        // router cache — prevents stale-tree 404s when switching accounts.
        window.location.assign(safeNext);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : en.auth.unexpectedError);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md shadow-xl border-border/60 bg-card/80 backdrop-blur-xl">
      <CardHeader className="space-y-3 text-center pb-6 pt-8">
        <div className="flex justify-center mb-1">
          <div className="h-12 w-12 bg-primary rounded-xl flex items-center justify-center shadow-md">
            <ShieldCheck className="h-6 w-6 text-primary-foreground" />
          </div>
        </div>
        <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
          <h1>{en.auth.login.title}</h1>
        </CardTitle>
        <CardDescription className="text-muted-foreground font-medium">
          {en.auth.login.description}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-4">
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
                onChange={(e) => setEmail(e.target.value)}
                required
                aria-invalid={Boolean(error)}
                aria-describedby={error ? 'login-error' : undefined}
                className="h-12 bg-muted/50 transition-all"
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {en.auth.passwordLabel}
                </Label>
                <Link href={ROUTES.forgotPassword} className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
                  {en.auth.login.forgotPassword}
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder={en.auth.passwordPlaceholder}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? 'login-error' : undefined}
                  className="h-12 bg-muted/50 transition-all pr-11"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? en.auth.hidePassword : en.auth.showPassword}
                  aria-pressed={showPassword}
                  tabIndex={isLoading ? -1 : 0}
                  className="absolute inset-y-0 right-0 flex items-center rounded-r-lg px-3 text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          {error && (
            <div id="login-error" role="alert" className="bg-destructive/10 text-destructive p-3.5 rounded-lg flex items-center gap-3 text-sm font-medium border border-destructive/20">
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
              <><Spinner className="mr-2 size-5 text-current" /> {en.auth.login.loading}</>
            ) : (
              en.auth.login.submit
            )}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="justify-center border-t border-border pt-6 pb-6">
        <p className="text-sm text-muted-foreground flex items-center gap-1">
          {en.auth.login.needAccount}
          <Link href={ROUTES.register} className="font-semibold text-foreground hover:underline px-2 py-1 rounded-md hover:bg-muted transition-colors">
            {en.auth.login.registerRequest}
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-muted p-4 selection:bg-muted">
      <div className="w-full max-w-md">
        <LoginForm />
        <p className="mt-6 text-center text-xs text-muted-foreground">
          <Link href={ROUTES.terms} className="font-medium text-muted-foreground transition-colors hover:text-foreground hover:underline">
            {en.auth.termsOfService}
          </Link>
          <span className="mx-2">·</span>
          <Link href={ROUTES.privacy} className="font-medium text-muted-foreground transition-colors hover:text-foreground hover:underline">
            {en.auth.privacyPolicy}
          </Link>
        </p>
      </div>
    </div>
  );
}
