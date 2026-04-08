import { Outlet } from 'react-router-dom';

export default function AuthLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 lg:flex-row">
      <div className="relative flex flex-1 flex-col justify-between overflow-hidden bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 px-8 py-10 text-white lg:max-w-md lg:px-10">
        <div className="pointer-events-none absolute inset-0 opacity-30">
          <div className="absolute -left-20 top-20 h-72 w-72 rounded-full bg-white blur-3xl" />
          <div className="absolute bottom-10 right-0 h-64 w-64 rounded-full bg-cyan-300 blur-3xl" />
        </div>
        <div className="relative z-10">
          <p className="text-sm font-semibold uppercase tracking-widest text-white/80">WebQuiz</p>
          <h1 className="mt-4 text-3xl font-bold leading-tight sm:text-4xl">
            High School Learning Analytics
          </h1>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/85">
            Theo dõi tiến độ, kết quả kiểm tra và luyện tập — một nền tảng cho học sinh, giáo viên và
            phụ huynh.
          </p>
        </div>
        <p className="relative z-10 text-xs text-white/60">© WebQuiz</p>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
