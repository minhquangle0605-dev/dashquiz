export default function CreateExamPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-lime-100 text-lime-800">
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Tạo đề kiểm tra</h1>
            <p className="mt-2 text-slate-600">
              Placeholder — chọn câu hỏi, cấu hình thời gian và xuất bản đề cho lớp.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
