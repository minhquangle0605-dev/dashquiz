import { Link } from 'react-router-dom';

export default function ForgotPasswordPage() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <div className="mb-8 flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-100 text-violet-600">
          <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
            />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Quên mật khẩu</h1>
          <p className="mt-1 text-sm text-slate-600">
            Placeholder — nhập email để nhận hướng dẫn đặt lại mật khẩu (chưa kết nối API).
          </p>
        </div>
      </div>
      <form className="space-y-5" onSubmit={(e) => e.preventDefault()}>
        <div>
          <label htmlFor="reset-email" className="mb-1.5 block text-sm font-medium text-slate-700">
            Email
          </label>
          <input
            id="reset-email"
            type="email"
            placeholder="you@school.edu.vn"
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>
        <button
          type="submit"
          className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500"
        >
          Gửi liên kết
        </button>
        <p className="text-center text-sm text-slate-600">
          <Link to="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
            Quay lại đăng nhập
          </Link>
        </p>
      </form>
    </div>
  );
}
