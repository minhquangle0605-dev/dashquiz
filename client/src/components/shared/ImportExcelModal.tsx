import { useState, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';

import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import {
  SubjectChapterTopicSelect,
  emptyCurriculumSelection,
  type CurriculumSelection,
} from './SubjectChapterTopicSelect';
import {
  importQuestions,
  getImportTemplateUrl,
} from '@/services/question.api';
import type { ImportQuestionResult } from '@/types/question';

type Step = 'upload' | 'importing' | 'result';

export interface ImportExcelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImported: () => void;
}

export function ImportExcelModal({
  isOpen,
  onClose,
  onImported,
}: ImportExcelModalProps) {
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [curriculum, setCurriculum] = useState<CurriculumSelection>(
    emptyCurriculumSelection(),
  );
  const [dragActive, setDragActive] = useState(false);
  const [result, setResult] = useState<ImportQuestionResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setStep('upload');
    setFile(null);
    setCurriculum(emptyCurriculumSelection());
    setResult(null);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const handleFile = useCallback((f: File) => {
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];
    if (!validTypes.includes(f.type) && !f.name.match(/\.xlsx?$/i)) {
      toast.error('Please upload an Excel file (.xlsx or .xls).');
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      toast.error('File size must be under 10 MB.');
      return;
    }
    setFile(f);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      if (e.dataTransfer.files?.[0]) {
        handleFile(e.dataTransfer.files[0]);
      }
    },
    [handleFile],
  );

  const handleImport = async () => {
    if (!file) {
      toast.error('Please select a file first.');
      return;
    }
    if (!curriculum.subjectId || !curriculum.gradeLevel || !curriculum.chapterId) {
      toast.error('Please select a subject, grade and chapter for the imported questions.');
      return;
    }

    setStep('importing');
    try {
      const res = await importQuestions(
        file,
        Number(curriculum.subjectId),
        Number(curriculum.chapterId),
      );
      setResult(res);
      setStep('result');
      if (res.imported > 0) {
        toast.success(`Imported ${res.imported} question(s) successfully.`);
        onImported();
      }
    } catch (e: unknown) {
      setStep('upload');
      const msg =
        e instanceof Error ? e.message : 'Import failed. Please try again.';
      toast.error(msg);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Import Questions from Excel"
      size="lg"
      className="!max-w-2xl"
    >
      {/* Upload step */}
      {step === 'upload' && (
        <div className="space-y-5">
          {/* Download template */}
          <div className="flex items-center gap-3 rounded-lg border border-sky-200 bg-sky-50 p-3">
            <svg
              className="h-5 w-5 shrink-0 text-sky-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="flex-1 text-sm text-sky-800">
              Download the{' '}
              <a
                href={getImportTemplateUrl()}
                className="font-semibold underline hover:text-sky-900"
                target="_blank"
                rel="noreferrer"
              >
                Excel template
              </a>{' '}
              to see the required format before uploading.
            </p>
          </div>

          {/* Curriculum select */}
          <SubjectChapterTopicSelect
            value={curriculum}
            onChange={setCurriculum}
            allowEmpty={false}
            showTopic={false}
            labels={{
              subject: 'Target Subject *',
              grade: 'Target Grade *',
              chapter: 'Target Chapter *',
            }}
          />

          {/* Dropzone */}
          <div
            className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
              dragActive
                ? 'border-indigo-400 bg-indigo-50'
                : file
                  ? 'border-emerald-300 bg-emerald-50'
                  : 'border-slate-300 bg-slate-50 hover:border-slate-400'
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0]) handleFile(e.target.files[0]);
              }}
            />

            {file ? (
              <>
                <svg
                  className="mb-2 h-10 w-10 text-emerald-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p className="text-sm font-semibold text-emerald-800">
                  {file.name}
                </p>
                <p className="mt-1 text-xs text-emerald-600">
                  {(file.size / 1024).toFixed(1)} KB
                </p>
                <button
                  type="button"
                  className="mt-3 text-xs font-medium text-slate-500 underline hover:text-slate-700"
                  onClick={() => {
                    setFile(null);
                    if (inputRef.current) inputRef.current.value = '';
                  }}
                >
                  Change file
                </button>
              </>
            ) : (
              <>
                <svg
                  className="mb-3 h-10 w-10 text-slate-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                  />
                </svg>
                <p className="text-sm font-medium text-slate-700">
                  Drag & drop your Excel file here
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  or{' '}
                  <button
                    type="button"
                    className="font-semibold text-indigo-600 hover:text-indigo-500"
                    onClick={() => inputRef.current?.click()}
                  >
                    browse files
                  </button>
                </p>
                <p className="mt-2 text-xs text-slate-400">
                  .xlsx or .xls, max 10 MB
                </p>
              </>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={
                !file ||
                !curriculum.subjectId ||
                !curriculum.gradeLevel ||
                !curriculum.chapterId
              }
              onClick={handleImport}
            >
              Import Questions
            </Button>
          </div>
        </div>
      )}

      {/* Importing step */}
      {step === 'importing' && (
        <div className="flex flex-col items-center gap-4 py-12">
          <span className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
          <p className="text-sm font-medium text-slate-600">
            Importing questions from <strong>{file?.name}</strong>...
          </p>
          <p className="text-xs text-slate-400">
            This may take a moment depending on the file size.
          </p>
        </div>
      )}

      {/* Result step */}
      {step === 'result' && result && (
        <div className="space-y-5">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-slate-50 p-4 text-center">
              <p className="text-2xl font-bold text-slate-800">
                {result.totalRows}
              </p>
              <p className="text-xs text-slate-500">Total Rows</p>
            </div>
            <div className="rounded-lg bg-emerald-50 p-4 text-center">
              <p className="text-2xl font-bold text-emerald-700">
                {result.imported}
              </p>
              <p className="text-xs text-emerald-600">Imported</p>
            </div>
            <div className="rounded-lg bg-red-50 p-4 text-center">
              <p className="text-2xl font-bold text-red-700">
                {result.failed}
              </p>
              <p className="text-xs text-red-600">Failed</p>
            </div>
          </div>

          {/* Error details */}
          {result.errors.length > 0 && (
            <div className="max-h-48 overflow-y-auto rounded-lg border border-red-200 bg-red-50">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-red-200 text-left text-xs font-semibold text-red-700">
                    <th className="px-4 py-2">Row</th>
                    <th className="px-4 py-2">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {result.errors.map((err, i) => (
                    <tr
                      key={i}
                      className="border-b border-red-100 last:border-0"
                    >
                      <td className="whitespace-nowrap px-4 py-2 font-mono text-xs text-red-800">
                        #{err.row}
                      </td>
                      <td className="px-4 py-2 text-xs text-red-700">
                        {err.message}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
            <Button variant="outline" onClick={reset}>
              Import Another
            </Button>
            <Button variant="primary" onClick={handleClose}>
              Done
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
