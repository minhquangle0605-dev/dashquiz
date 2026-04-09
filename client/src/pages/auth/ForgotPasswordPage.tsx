import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { forgotPassword } from '@/services/auth.api';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

const forgotSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
});

type ForgotFormData = z.infer<typeof forgotSchema>;

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [sentEmail, setSentEmail] = useState('');
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotFormData>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = async (data: ForgotFormData) => {
    setServerError(null);

    try {
      await forgotPassword(data.email);
      setSentEmail(data.email);
      setSent(true);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number; data?: { message?: string } } };
      const status = axiosErr.response?.status;

      if (status === 429) {
        setServerError('Too many requests. Please wait a few minutes before trying again.');
      } else {
        setSentEmail(data.email);
        setSent(true);
      }
    }
  };

  if (sent) {
    return (
      <div className="w-full text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
          <svg className="h-8 w-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Check your email
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-500">
          If an account exists for <strong className="text-slate-700">{sentEmail}</strong>,
          we sent a password reset link. Please check your inbox and spam folder.
        </p>
        <div className="mt-8 space-y-3">
          <Button
            variant="outline"
            onClick={() => { setSent(false); setServerError(null); }}
            className="w-full"
          >
            Try a different email
          </Button>
          <p className="text-sm text-slate-500">
            <Link to="/login" className="font-medium text-indigo-600 hover:text-indigo-500 transition-colors">
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Reset your password
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Enter your email address and we'll send you a link to reset your password.
        </p>
      </div>

      {serverError && (
        <div
          className="mb-6 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3"
          role="alert"
        >
          <svg className="mt-0.5 h-5 w-5 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <p className="text-sm text-red-700">{serverError}</p>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        <Input
          {...register('email')}
          label="Email address"
          type="email"
          autoComplete="email"
          placeholder="you@school.edu"
          error={errors.email?.message}
          disabled={isSubmitting}
        />

        <Button
          type="submit"
          isLoading={isSubmitting}
          className="w-full py-2.5"
          size="lg"
        >
          {isSubmitting ? 'Sending...' : 'Send reset link'}
        </Button>

        <p className="text-center text-sm text-slate-500">
          Remember your password?{' '}
          <Link to="/login" className="font-medium text-indigo-600 hover:text-indigo-500 transition-colors">
            Back to sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
