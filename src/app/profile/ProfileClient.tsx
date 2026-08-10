// Title: Profile Client
// Path: src/app/profile/ProfileClient.tsx
// Functionality: Client-side interaction layer for profile workflows and UI state.

'use client';

import { useState, type ElementType, type ReactNode } from 'react';
import { AlertCircle, CheckCircle, Lock, LogOut, Mail, User } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { updateProfileInfoAction } from '@/actions/profile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { ROUTES } from '@/config/routes';
import { en } from '@/localization/en';

interface Props {
  email: string;
  fullName: string;
  phone: string;
}

type Msg = { type: 'ok' | 'err'; text: string };
type PasswordErrorField = 'current' | 'new' | 'confirm' | null;

const messages = en.profile;

function useMsg() {
  const [msg, setMsg] = useState<Msg | null>(null);
  const ok = (text: string) => setMsg({ type: 'ok', text });
  const err = (text: string) => setMsg({ type: 'err', text });
  const clear = () => setMsg(null);

  return { msg, ok, err, clear };
}

function FeedbackMsg({ id, msg }: { id: string; msg: Msg | null }) {
  if (!msg) return null;
  const isOk = msg.type === 'ok';

  return (
    <div
      id={id}
      role={isOk ? 'status' : 'alert'}
      aria-live={isOk ? 'polite' : 'assertive'}
      className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${
        isOk
          ? 'border-success/20 bg-success/10 text-success'
          : 'border-destructive/20 bg-destructive/10 text-destructive'
      }`}
    >
      {isOk ? <CheckCircle className="mt-0.5 size-4 shrink-0" /> : <AlertCircle className="mt-0.5 size-4 shrink-0" />}
      <span>{msg.text}</span>
    </div>
  );
}

function Section({ icon: Icon, title, children }: { icon: ElementType; title: string; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-md border border-border bg-card shadow-sm">
      <div className="flex items-center gap-3 border-b border-border bg-muted/20 px-4 py-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-card">
          <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
        </span>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      </div>
      <div className="space-y-4 p-4 sm:p-5">{children}</div>
    </section>
  );
}

function Field({ htmlFor, label, children }: { htmlFor: string; label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

function InfoSection({ email, fullName, phone }: Props) {
  const { msg, ok, err, clear } = useMsg();
  const [name, setName] = useState(fullName);
  const [ph, setPhone] = useState(phone);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    clear();
    setBusy(true);
    const res = await updateProfileInfoAction({ full_name: name, phone: ph });
    setBusy(false);
    if (res.success) ok(messages.saveSuccess);
    else err(res.error ?? messages.saveErrorFallback);
  };

  return (
    <Section icon={User} title={messages.infoTitle}>
      <Field htmlFor="profile-email" label={messages.emailLabel}>
        <Input
          id="profile-email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          readOnly
          aria-describedby="profile-email-hint"
          className="h-10 bg-muted/40 text-muted-foreground"
        />
        <p id="profile-email-hint" className="text-xs leading-5 text-muted-foreground">{messages.emailReadOnlyHint}</p>
      </Field>

      <Field htmlFor="profile-name" label={messages.nameLabel}>
        <Input
          id="profile-name"
          name="name"
          type="text"
          autoComplete="name"
          value={name}
          onChange={event => setName(event.target.value)}
          placeholder={messages.namePlaceholder}
          className="h-10 bg-background"
        />
      </Field>

      <Field htmlFor="profile-phone" label={messages.phoneLabel}>
        <Input
          id="profile-phone"
          name="tel"
          type="tel"
          autoComplete="tel"
          value={ph}
          onChange={event => setPhone(event.target.value)}
          placeholder={messages.phonePlaceholder}
          className="h-10 bg-background"
        />
      </Field>

      <FeedbackMsg id="profile-info-feedback" msg={msg} />

      <Button type="button" onClick={save} disabled={busy || !name.trim()} className="h-9">
        {busy ? <Spinner className="size-3.5 text-current" /> : null}
        {messages.saveChanges}
      </Button>
    </Section>
  );
}

function PasswordSection({ email }: { email: string }) {
  const { msg, ok, err, clear } = useMsg();
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [conf, setConf] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorField, setErrorField] = useState<PasswordErrorField>(null);

  const save = async () => {
    clear();
    setErrorField(null);
    if (next.length < 8) {
      setErrorField('new');
      return err(messages.passwordTooShort);
    }
    if (next !== conf) {
      setErrorField('confirm');
      return err(messages.passwordMismatch);
    }

    setBusy(true);
    const supabase = createClient();
    const { error: authErr } = await supabase.auth.signInWithPassword({ email, password: cur });
    if (authErr) {
      setBusy(false);
      setErrorField('current');
      return err(messages.passwordWrong);
    }

    const { error: updErr } = await supabase.auth.updateUser({ password: next });
    setBusy(false);
    if (updErr) {
      setErrorField('new');
      return err(updErr.message);
    }

    ok(messages.passwordSuccess);
    setCur('');
    setNext('');
    setConf('');
  };

  return (
    <Section icon={Lock} title={messages.passwordTitle}>
      <Field htmlFor="profile-current-password" label={messages.currentPasswordLabel}>
        <Input
          id="profile-current-password"
          name="current-password"
          type="password"
          value={cur}
          onChange={event => setCur(event.target.value)}
          autoComplete="current-password"
          aria-invalid={errorField === 'current'}
          aria-describedby={errorField === 'current' ? 'profile-password-feedback' : undefined}
          className="h-10 bg-background"
        />
      </Field>

      <Field htmlFor="profile-new-password" label={messages.newPasswordLabel}>
        <Input
          id="profile-new-password"
          name="new-password"
          type="password"
          value={next}
          onChange={event => setNext(event.target.value)}
          autoComplete="new-password"
          aria-invalid={errorField === 'new'}
          aria-describedby={errorField === 'new' ? 'profile-password-feedback' : undefined}
          className="h-10 bg-background"
        />
      </Field>

      <Field htmlFor="profile-confirm-password" label={messages.confirmPasswordLabel}>
        <Input
          id="profile-confirm-password"
          name="confirm-password"
          type="password"
          value={conf}
          onChange={event => setConf(event.target.value)}
          autoComplete="new-password"
          aria-invalid={errorField === 'confirm'}
          aria-describedby={errorField === 'confirm' ? 'profile-password-feedback' : undefined}
          className="h-10 bg-background"
        />
      </Field>

      <FeedbackMsg id="profile-password-feedback" msg={msg} />

      <Button type="button" onClick={save} disabled={busy || !cur || !next || !conf} className="h-9">
        {busy ? <Spinner className="size-3.5 text-current" /> : null}
        {messages.updatePassword}
      </Button>
    </Section>
  );
}

function EmailSection({ email }: { email: string }) {
  const { msg, ok, err, clear } = useMsg();
  const [newEmail, setNewEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [emailInvalid, setEmailInvalid] = useState(false);

  const save = async () => {
    clear();
    setEmailInvalid(false);
    if (!newEmail.trim() || !newEmail.includes('@')) {
      setEmailInvalid(true);
      return err(messages.invalidEmail);
    }
    if (newEmail.trim().toLowerCase() === email.toLowerCase()) {
      setEmailInvalid(true);
      return err(messages.sameEmail);
    }

    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
    setBusy(false);
    if (error) {
      setEmailInvalid(true);
      return err(error.message);
    }

    setSent(true);
    ok(messages.emailConfirmationSent(newEmail));
  };

  return (
    <Section icon={Mail} title={messages.emailChangeTitle}>
      <p className="text-sm text-muted-foreground">
        {messages.currentEmailPrefix} <span className="font-medium text-foreground">{email}</span>
      </p>

      <Field htmlFor="profile-new-email" label={messages.newEmailLabel}>
        <Input
          id="profile-new-email"
          name="email"
          type="email"
          value={newEmail}
          onChange={event => {
            setNewEmail(event.target.value);
            if (emailInvalid) setEmailInvalid(false);
          }}
          disabled={sent}
          placeholder={messages.newEmailPlaceholder}
          autoComplete="email"
          aria-invalid={emailInvalid}
          aria-describedby={emailInvalid ? 'profile-email-change-feedback' : undefined}
          className="h-10 bg-background"
        />
      </Field>

      <FeedbackMsg id="profile-email-change-feedback" msg={msg} />

      {!sent && (
        <Button type="button" onClick={save} disabled={busy || !newEmail.trim()} className="h-9">
          {busy ? <Spinner className="size-3.5 text-current" /> : null}
          {messages.sendConfirmation}
        </Button>
      )}
    </Section>
  );
}

export function ProfileClient({ email, fullName, phone }: Props) {
  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    // Full reload (not router.push) so the previous session's client router cache is
    // fully discarded — prevents stale-tree 404s when switching accounts.
    window.location.assign(ROUTES.login);
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-card shadow-sm">
            <User className="size-4 text-muted-foreground" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold text-foreground sm:text-2xl">{messages.pageTitle}</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">{messages.pageDescription}</p>
          </div>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={signOut} className="w-full sm:w-auto">
          <LogOut className="size-4" aria-hidden="true" />
          {messages.signOut}
        </Button>
      </header>

      <InfoSection email={email} fullName={fullName} phone={phone} />
      <PasswordSection email={email} />
      <EmailSection email={email} />
    </div>
  );
}
