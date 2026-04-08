import { Link } from 'react-router-dom';

export default function ResetPasswordPage() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <div className="mb-8 flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-fuchsia-100 text-fuchsia-600">
          <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Đặt lại mật khẩu</h1>
          <p className="mt-1 text-sm text-slate-600">Placeholder — form mật khẩu mới sau khi có token từ email.</p>
        </div>
      </div>
      <form className="space-y-5" onSubmit={(e) => e.preventDefault()}>
        <div>
          <label htmlFor="new-password" className="mb-1.5 block text-sm font-medium text-slate-700">
            Mật khẩu mới
          </label>
          <input
            id="new-password"
            type="password"
            placeholder="••••••••"
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>
        <div>
          <label htmlFor="confirm-password" className="mb-1.5 block text-sm font-medium text-slate-700">
            Xác nhận mật khẩu
          </label>
          <input
            id="confirm-password"
            type="password"
            placeholder="••••••••"
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>
        <button
          type="submit"
          className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500"
        >
          Cập nhật mật khẩu
        </button>
        <p className="text-center text-sm text-slate-600">
          <Link to="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
            Về trang đăng nhập
          </Link>
        </p>
      </form>
    </div>
  );
}
