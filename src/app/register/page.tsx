// Title: Register Page Component
// Path: src/app/register/page.tsx
// Functionality: Renders the public registration interface for new residents.
// Implements password strength validation and Terms of Service agreement.

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import Link from 'next/link';
import { getPasswordStrengthLevel, isPasswordPolicySatisfied, PASSWORD_POLICY } from '@/config/auth';
import { en } from '@/localization/en';
import { ROUTES } from '@/config/routes';
import { AuthAcceptanceService } from '@/services/AuthAcceptanceService';

export default function RegisterPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Which field the current error belongs to, so only the offending input is marked
  // invalid (a password-policy failure must not paint the email/name fields red).
  const [errorField, setErrorField] = useState<'email' | 'password' | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const passwordStrengthLevel = getPasswordStrengthLevel(password);
  const passwordStrengthLabel = en.auth.register.strengthLabels[passwordStrengthLevel];

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setErrorField(null);

    if (!agreedToTerms) {
      setError(en.auth.register.termsError);
      setIsLoading(false);
      return;
    }

    if (!isPasswordPolicySatisfied(password)) {
      setError(en.auth.passwordPolicyError);
      setErrorField('password');
      setIsLoading(false);
      return;
    }

    // Initialize the Supabase client only on submit — creating it at module load
    // can crash static prerendering (SSG) during the build.
    const supabase = createClient();

    // Invitation acceptance is token-bound: the one-time token arrives in the
    // accept-link (/register?invite=<token>) the admin shares with the invitee.
    const inviteToken = new URLSearchParams(window.location.search).get('invite');

    try {
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}${ROUTES.authCallback}`,
          // Carry the invite token in user metadata so the auth callback can accept
          // the invitation once the email is confirmed (email-confirmation-enabled
          // projects have no session here yet).
          data: inviteToken
            ? { full_name: fullName, invite_token: inviteToken }
            : { full_name: fullName },
        },
      });

      if (authError) {
        // Sign-up failures (invalid/duplicate email, provider rejection) are
        // email-centric — mark the email field, not every input.
        setErrorField('email');
        throw new Error(authError.message);
      }

      if (data.user) {
        // If a session already exists (email confirmation disabled), accept the
        // invitation now — token-bound, so it only succeeds for the invited email
        // that holds the link. Non-blocking. With confirmation enabled there is no
        // session yet; the auth callback finishes acceptance after verification.
        if (inviteToken && data.session) {
          try { await AuthAcceptanceService.consumeInvitation(supabase, inviteToken); } catch { /* non-blocking */ }
        }
        router.push(ROUTES.home);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : en.auth.unexpectedError);
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
            <h1>{en.auth.register.title}</h1>
          </CardTitle>
          <CardDescription className="text-muted-foreground font-medium">
            {en.auth.register.description}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRegister} className="space-y-5">
            <div className="space-y-4">
              <div className="space-y-2.5">
                <Label htmlFor="fullName" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {en.auth.register.fullNameLabel}
                </Label>
                <Input
                  id="fullName"
                  name="name"
                  type="text"
                  autoComplete="name"
                  placeholder={en.auth.register.fullNamePlaceholder}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className="h-12 bg-muted/50 transition-all"
                  disabled={isLoading}
                />
              </div>
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
                  aria-invalid={errorField === 'email'}
                  aria-describedby={errorField === 'email' ? 'register-error' : undefined}
                  className="h-12 bg-muted/50 transition-all"
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2.5">
                <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {en.auth.passwordLabel}
                </Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  placeholder={en.auth.passwordPolicyPlaceholder}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  aria-invalid={errorField === 'password'}
                  aria-describedby={errorField === 'password' ? 'register-error' : undefined}
                  className="h-12 bg-muted/50 transition-all"
                  disabled={isLoading}
                />
                {password && (
                  <div className="space-y-1.5">
                    <div className="flex gap-1.5">
                      {Array.from({ length: PASSWORD_POLICY.strengthSegments }, (_, index) => index + 1).map(i => (
                        <div
                          key={i}
                          className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                            i <= passwordStrengthLevel
                              ? passwordStrengthLevel === 1 ? 'bg-destructive'
                                : passwordStrengthLevel === 2 ? 'bg-warning'
                                : 'bg-success'
                              : 'bg-muted'
                          }`}
                        />
                      ))}
                    </div>
                    <p className={`text-[11px] font-semibold ${
                      passwordStrengthLevel === 1 ? 'text-destructive'
                        : passwordStrengthLevel === 2 ? 'text-warning'
                        : 'text-success'
                    }`}>
                      {passwordStrengthLabel}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-start gap-3 pt-2">
                <input
                  type="checkbox"
                  id="terms"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-input text-primary focus:ring-ring cursor-pointer"
                />
                {/* Native <label> (not the shadcn Label, which is display:flex) so the
                    multi-phrase legal text and inline links flow as normal wrapping text. */}
                <label htmlFor="terms" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">
                  {en.auth.register.termsPrefix} <Link href={ROUTES.terms} className="text-foreground hover:underline font-medium">{en.auth.register.termsLink}</Link> {en.auth.register.privacyJoiner} <Link href={ROUTES.privacy} className="text-foreground hover:underline font-medium">{en.auth.register.privacyLink}</Link>. {en.auth.register.termsSuffix}
                </label>
              </div>
            </div>

            {error && (
              <div id="register-error" role="alert" className="bg-destructive/10 text-destructive p-3.5 rounded-lg flex items-center gap-3 text-sm font-medium border border-destructive/20">
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
                <>
                  <Spinner className="mr-2 size-5 text-current" />
                  {en.auth.register.loading}
                </>
              ) : (
                en.auth.register.submit
              )}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="justify-center border-t border-border pt-6 pb-6">
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            {en.auth.register.hasAccount}
            <Link href={ROUTES.login} className="font-semibold text-foreground hover:underline px-2 py-1 rounded-md hover:bg-muted transition-colors">
              {en.auth.register.signIn}
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
