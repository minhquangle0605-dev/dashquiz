import { Link } from 'react-router-dom';

export default function ForbiddenPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-16">
      <div className="max-w-lg text-center">
        <p className="text-8xl font-black tracking-tight text-rose-100 select-none" aria-hidden>
          403
        </p>
        <div className="-mt-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-rose-50 text-rose-500">
            <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.25}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-slate-900">Truy cập bị từ chối</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Bạn không có quyền xem nội dung này. Nếu đây là lỗi, hãy liên hệ quản trị viên hoặc đăng nhập
            bằng tài khoản phù hợp.
          </p>
          <Link
            to="/"
            className="mt-6 inline-flex items-center justify-center rounded-lg bg-slate-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-700"
          >
            Về trang chủ
          </Link>
        </div>
      </div>
    </div>
  );
}
