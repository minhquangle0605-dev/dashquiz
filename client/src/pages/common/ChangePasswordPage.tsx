import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/stores/authStore';
import { changePassword as changePasswordApi } from '@/services/user.api';
import { ROLE_DASHBOARDS } from '@/utils/constants';

const passwordComplexity = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(
        passwordComplexity,
        'Password must contain an uppercase letter, a lowercase letter, and a number',
      ),
    confirmPassword: z.string().min(1, 'Please confirm your new password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'New password must be different from the current one',
    path: ['newPassword'],
  });

type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;

export default function ChangePasswordPage() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const onSubmit = async (data: ChangePasswordFormData) => {
    setServerError(null);
    try {
      await changePasswordApi(data.currentPassword, data.newPassword, data.confirmPassword);
      if (user) setUser({ ...user, mustChangePassword: false });
      toast.success('Password updated. Welcome!');
      const dashboard = user ? ROLE_DASHBOARDS[user.role] ?? '/' : '/';
      navigate(dashboard, { replace: true });
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      const message = axiosErr.response?.data?.message;
      setServerError(message ?? 'Unable to change your password. Please try again.');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg-page)] px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-8 shadow-[var(--shadow-md)]">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)]">
            Change your password
          </h1>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">
            For security, you must set a new password before continuing.
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
            {...register('currentPassword')}
            label="Current password"
            type="password"
            autoComplete="current-password"
            placeholder="Enter your temporary password"
            error={errors.currentPassword?.message}
            disabled={isSubmitting}
          />
          <Input
            {...register('newPassword')}
            label="New password"
            type="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            error={errors.newPassword?.message}
            disabled={isSubmitting}
          />
          <Input
            {...register('confirmPassword')}
            label="Confirm new password"
            type="password"
            autoComplete="new-password"
            placeholder="Re-enter your new password"
            error={errors.confirmPassword?.message}
            disabled={isSubmitting}
          />

          <Button type="submit" isLoading={isSubmitting} className="w-full py-2.5" size="lg">
            {isSubmitting ? 'Updating…' : 'Update password'}
          </Button>
        </form>

        <button
          type="button"
          onClick={logout}
          className="mt-5 w-full text-center text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
