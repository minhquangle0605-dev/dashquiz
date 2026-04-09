import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { linkStudent } from '@/services/parent.api';

export default function LinkStudentPage() {
  const [code, setCode] = useState('');
  const [relationship, setRelationship] = useState('parent');
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => linkStudent({ code: code.trim().toUpperCase(), relationship }),
    onSuccess: () => {
      toast.success('Student linked successfully!');
      queryClient.invalidateQueries({ queryKey: ['parent', 'children'] });
      navigate('/parent/dashboard');
    },
    onError: (error: Error & { response?: { data?: { message?: string } } }) => {
      const msg = error.response?.data?.message || 'Invalid code or student already linked. Please try again.';
      toast.error(msg);
    },
  });

  const isValid = code.trim().length === 6;

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Link Your Child</h1>
        <p className="mt-1 text-sm text-slate-500">
          Enter the 6-character verification code to connect with your child's account.
        </p>
      </div>

      <Card padding="lg">
        <div className="space-y-6">
          {/* Info banner */}
          <div className="flex gap-3 rounded-xl bg-amber-50 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="text-sm text-amber-800">
              <p className="font-semibold">Where to find the code?</p>
              <p className="mt-1 text-amber-700">
                Ask your school administrator to generate a link code for your child's student account.
              </p>
            </div>
          </div>

          {/* Code input */}
          <div>
            <label htmlFor="link-code" className="block text-sm font-semibold text-slate-700">
              Verification Code
            </label>
            <input
              id="link-code"
              type="text"
              value={code}
              onChange={(e) => {
                const val = e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6);
                setCode(val);
              }}
              placeholder="ABC123"
              maxLength={6}
              autoComplete="off"
              className="mt-2 block w-full rounded-xl border border-slate-300 px-4 py-3 text-center text-2xl font-bold tracking-[0.3em] text-slate-900 placeholder:text-slate-300 placeholder:tracking-[0.3em] focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
            <p className="mt-2 text-xs text-slate-400 text-center">
              {code.length}/6 characters
            </p>
          </div>

          {/* Relationship select */}
          <div>
            <label htmlFor="relationship" className="block text-sm font-semibold text-slate-700">
              Relationship
            </label>
            <select
              id="relationship"
              value={relationship}
              onChange={(e) => setRelationship(e.target.value)}
              className="mt-2 block w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="parent">Parent</option>
              <option value="guardian">Guardian</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Submit */}
          <Button
            onClick={() => mutation.mutate()}
            disabled={!isValid || mutation.isPending}
            className="w-full justify-center rounded-xl py-3 text-base font-semibold"
          >
            {mutation.isPending ? (
              <span className="flex items-center gap-2">
                <Spinner size="sm" /> Verifying...
              </span>
            ) : (
              'Link Student Account'
            )}
          </Button>

          {/* Back link */}
          <div className="text-center">
            <button
              type="button"
              onClick={() => navigate('/parent/dashboard')}
              className="min-h-[44px] rounded-lg px-4 py-2 text-sm font-medium text-slate-500 transition-colors hover:text-slate-700"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}
