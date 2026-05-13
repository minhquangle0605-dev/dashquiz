import { useEffect, useRef, useState } from 'react';
import type { ClipboardEvent, DragEvent } from 'react';
import toast from 'react-hot-toast';

import { uploadQuestionImage } from '@/services/question.api';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeightClassName?: string;
  disabled?: boolean;
}

function isImageFile(file: File): boolean {
  return ['image/jpeg', 'image/png', 'image/webp'].includes(file.type);
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Enter content...',
  minHeightClassName = 'min-h-[128px]',
  disabled = false,
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || editor.innerHTML === value) return;
    editor.innerHTML = value;
  }, [value]);

  const emitChange = () => {
    onChange(editorRef.current?.innerHTML ?? '');
  };

  const runCommand = (command: string) => {
    if (disabled) return;
    editorRef.current?.focus();
    document.execCommand(command);
    emitChange();
  };

  const insertImage = async (file: File) => {
    if (!isImageFile(file)) {
      toast.error('Only JPG, PNG, and WebP images are supported.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must not exceed 5MB.');
      return;
    }

    setUploading(true);
    try {
      const result = await uploadQuestionImage(file);
      editorRef.current?.focus();
      document.execCommand(
        'insertHTML',
        false,
        `<img src="${result.url}" alt="${file.name.replace(/"/g, '')}" />`,
      );
      emitChange();
    } catch {
      toast.error('Failed to upload image.');
    } finally {
      setUploading(false);
    }
  };

  const handlePaste = async (event: ClipboardEvent<HTMLDivElement>) => {
    const image = Array.from(event.clipboardData.files).find(isImageFile);
    if (!image) return;
    event.preventDefault();
    await insertImage(image);
  };

  const handleDrop = async (event: DragEvent<HTMLDivElement>) => {
    const image = Array.from(event.dataTransfer.files).find(isImageFile);
    if (!image) return;
    event.preventDefault();
    await insertImage(image);
  };

  return (
    <div className="rounded-lg border border-slate-300 bg-white shadow-sm focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20">
      <div className="flex items-center gap-1 border-b border-slate-200 bg-slate-50 px-2 py-1.5">
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-md text-sm font-bold text-slate-700 hover:bg-white disabled:opacity-50"
          onClick={() => runCommand('bold')}
          disabled={disabled}
          title="Bold"
        >
          B
        </button>
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-md text-sm italic text-slate-700 hover:bg-white disabled:opacity-50"
          onClick={() => runCommand('italic')}
          disabled={disabled}
          title="Italic"
        >
          I
        </button>
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-md text-sm underline text-slate-700 hover:bg-white disabled:opacity-50"
          onClick={() => runCommand('underline')}
          disabled={disabled}
          title="Underline"
        >
          U
        </button>
        <button
          type="button"
          className="ml-1 flex h-8 items-center justify-center rounded-md px-2 text-xs font-semibold text-slate-700 hover:bg-white disabled:opacity-50"
          onClick={() => fileRef.current?.click()}
          disabled={disabled || uploading}
          title="Insert image"
        >
          {uploading ? 'Uploading...' : 'Image'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) void insertImage(file);
          }}
        />
      </div>
      <div
        ref={editorRef}
        role="textbox"
        aria-label={placeholder}
        contentEditable={!disabled}
        suppressContentEditableWarning
        className={`rich-text-editor w-full overflow-y-auto px-3 py-2.5 text-sm text-slate-900 outline-none ${minHeightClassName}`}
        data-placeholder={placeholder}
        onInput={emitChange}
        onPaste={(event) => void handlePaste(event)}
        onDrop={(event) => void handleDrop(event)}
        onDragOver={(event) => event.preventDefault()}
      />
    </div>
  );
}
