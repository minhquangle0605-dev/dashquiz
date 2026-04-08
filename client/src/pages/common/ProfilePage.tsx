export default function ProfilePage() {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-200 to-slate-400 text-2xl font-bold text-white shadow-inner">
            U
          </div>
          <div className="text-center sm:text-left">
            <h1 className="text-2xl font-bold text-slate-900">Hồ sơ</h1>
            <p className="mt-2 text-slate-600">
              Placeholder — ảnh đại diện, họ tên, email, đổi mật khẩu và tùy chọn thông báo.
            </p>
            <dl className="mt-6 grid gap-3 text-left text-sm sm:grid-cols-2">
              <div className="rounded-lg bg-slate-50 px-3 py-2">
                <dt className="text-slate-500">Họ tên</dt>
                <dd className="font-medium text-slate-900">—</dd>
              </div>
              <div className="rounded-lg bg-slate-50 px-3 py-2">
                <dt className="text-slate-500">Email</dt>
                <dd className="font-medium text-slate-900">—</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
