import { Link } from 'react-router-dom';

import { ROUTES } from '@/utils/constants';

export default function ForgotPasswordPage() {
  return (
    <div className="w-full">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Forgot your password?
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          WebQuiz accounts are managed by your school, so passwords are reset by
          an administrator rather than by email.
        </p>
      </div>

      <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>
          <div className="text-sm text-slate-700">
            <p className="font-medium text-slate-900">How to recover your account</p>
            <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-slate-600">
              <li>Contact your school administrator and verify your identity.</li>
              <li>The administrator resets your password to a temporary one.</li>
              <li>Sign in with that temporary password.</li>
              <li>You will be asked to set a new password before continuing.</li>
            </ol>
          </div>
        </div>
      </div>

      <p className="mt-5 text-xs leading-relaxed text-slate-400">
        For security, WebQuiz never reveals existing passwords. Keep your
        temporary password private and change it as soon as you sign in.
      </p>

      <Link
        to={ROUTES.LOGIN}
        className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
        </svg>
        Back to sign in
      </Link>
    </div>
  );
}
