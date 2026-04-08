import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-16">
      <div className="max-w-lg text-center">
        <p className="text-8xl font-black tracking-tight text-slate-200 select-none" aria-hidden>
          404
        </p>
        <div className="-mt-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-indigo-50 text-indigo-500">
            <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.25}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-slate-900">Không tìm thấy trang</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Minh họa: một chú robot đang nhìn vào bản đồ bị lỗi — đường dẫn bạn mở không tồn tại hoặc đã
            được di chuyển.
          </p>
          <Link
            to="/"
            className="mt-6 inline-flex items-center justify-center rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
          >
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}
