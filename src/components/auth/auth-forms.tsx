'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Checkbox, Field, FieldError, FieldHint, Input, Label } from '@/components/ui/field';
import { COPY } from '@/lib/copy';
import {
  loginSchema,
  registerSchema,
  type LoginFormValues,
  type LoginInput,
  type RegisterFormValues,
  type RegisterInput,
} from '@/validators/auth';

type ApiResponse = {
  ok: boolean;
  data?: { redirectTo?: string };
  error?: { message?: string; details?: Record<string, string> };
};

async function postJson(url: string, body: unknown): Promise<ApiResponse> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return (await response.json()) as ApiResponse;
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') ?? undefined;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues, unknown, LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', next },
  });

  const onSubmit = handleSubmit(async (values) => {
    const result = await postJson('/api/auth/login', { ...values, next });
    if (!result.ok) {
      toast.error(result.error?.message ?? COPY.common.error);
      return;
    }
    toast.success(COPY.auth.loginSuccess);
    // The server decides the destination; it has already validated the target.
    router.push(result.data?.redirectTo ?? '/dashboard');
    router.refresh();
  });

  return (
    // `method="post"` is the no-JS fallback, not the transport: submission
    // normally goes through fetch in `onSubmit`. If hydration ever fails, a
    // native POST fails loudly instead of a native GET putting the password
    // into the URL, browser history and server logs.
    <form onSubmit={onSubmit} method="post" className="flex flex-col gap-5" noValidate>
      <Field>
        <Label htmlFor="email">{COPY.auth.email}</Label>
        {/* Addresses are Latin; isolating them keeps the RTL layout stable. */}
        <Input
          id="email"
          type="email"
          dir="ltr"
          autoComplete="email"
          aria-invalid={Boolean(errors.email)}
          {...register('email')}
        />
        <FieldError message={errors.email?.message} />
      </Field>

      <Field>
        <Label htmlFor="password">{COPY.auth.password}</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={Boolean(errors.password)}
          {...register('password')}
        />
        <FieldError message={errors.password?.message} />
      </Field>

      <Button type="submit" size="lg" loading={isSubmitting}>
        {COPY.auth.submitLogin}
      </Button>

      <p className="text-ink-700 text-center text-sm">
        {COPY.auth.noAccount}{' '}
        <Link href="/register" className="text-brand-700 font-medium hover:underline">
          {COPY.nav.register}
        </Link>
      </p>
    </form>
  );
}

export function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') ?? undefined;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues, unknown, RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
      acceptTerms: false as unknown as true,
      next,
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    const result = await postJson('/api/auth/register', { ...values, next });
    if (!result.ok) {
      toast.error(result.error?.message ?? COPY.common.error);
      return;
    }
    toast.success(COPY.auth.registerSuccess);
    router.push(result.data?.redirectTo ?? '/dashboard');
    router.refresh();
  });

  return (
    // `method="post"` is the no-JS fallback, not the transport: submission
    // normally goes through fetch in `onSubmit`. If hydration ever fails, a
    // native POST fails loudly instead of a native GET putting the password
    // into the URL, browser history and server logs.
    <form onSubmit={onSubmit} method="post" className="flex flex-col gap-5" noValidate>
      <Field>
        <Label htmlFor="name">{COPY.auth.fullName}</Label>
        <Input
          id="name"
          autoComplete="name"
          aria-invalid={Boolean(errors.name)}
          {...register('name')}
        />
        <FieldError message={errors.name?.message} />
      </Field>

      <Field>
        <Label htmlFor="email">{COPY.auth.email}</Label>
        <Input
          id="email"
          type="email"
          dir="ltr"
          autoComplete="email"
          aria-invalid={Boolean(errors.email)}
          {...register('email')}
        />
        <FieldError message={errors.email?.message} />
      </Field>

      <Field>
        <Label htmlFor="phone">
          {COPY.auth.phone}{' '}
          <span className="text-ink-600 font-normal">({COPY.common.optional})</span>
        </Label>
        <Input
          id="phone"
          type="tel"
          dir="ltr"
          autoComplete="tel"
          placeholder="05XXXXXXXX"
          aria-invalid={Boolean(errors.phone)}
          {...register('phone')}
        />
        <FieldError message={errors.phone?.message} />
      </Field>

      <Field>
        <Label htmlFor="password">{COPY.auth.password}</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          aria-describedby="password-hint"
          aria-invalid={Boolean(errors.password)}
          {...register('password')}
        />
        <FieldHint id="password-hint">{COPY.auth.passwordHint}</FieldHint>
        <FieldError message={errors.password?.message} />
      </Field>

      <Field>
        <Label htmlFor="confirmPassword">{COPY.auth.confirmPassword}</Label>
        <Input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          aria-invalid={Boolean(errors.confirmPassword)}
          {...register('confirmPassword')}
        />
        <FieldError message={errors.confirmPassword?.message} />
      </Field>

      <Field>
        <div className="flex items-start gap-3">
          <Checkbox id="acceptTerms" className="mt-1" {...register('acceptTerms')} />
          <Label htmlFor="acceptTerms" className="leading-relaxed font-normal">
            أوافق على{' '}
            <Link href="/terms" className="text-brand-700 font-medium hover:underline">
              الشروط والأحكام
            </Link>{' '}
            و
            <Link href="/privacy" className="text-brand-700 font-medium hover:underline">
              سياسة الخصوصية
            </Link>
          </Label>
        </div>
        <FieldError message={errors.acceptTerms?.message} />
      </Field>

      <Button type="submit" size="lg" loading={isSubmitting}>
        {COPY.auth.submitRegister}
      </Button>

      <p className="text-ink-700 text-center text-sm">
        {COPY.auth.haveAccount}{' '}
        <Link href="/login" className="text-brand-700 font-medium hover:underline">
          {COPY.nav.login}
        </Link>
      </p>
    </form>
  );
}
