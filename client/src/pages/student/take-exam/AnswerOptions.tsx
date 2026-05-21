import { useMemo, useRef } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { useState } from 'react';

import { MathText } from '@/components/shared/MathText';
import type { ExamQuestion, StudentAnswerValue } from '@/types/exam';

interface AnswerOptionsProps {
  question: ExamQuestion;
  answer: StudentAnswerValue | undefined;
  onSingleSelect: (questionId: number, optionId: number) => void;
  onMultiSelect: (questionId: number, optionId: number) => void;
  onTextAnswer: (questionId: number, value: string) => void;
  onMatchingAnswer: (questionId: number, label: string, value: string) => void;
}

function splitMatchingPair(content: string) {
  const [left = '', ...rightParts] = content.split(/\s*=>\s*/);
  return { left: left.trim(), right: rightParts.join(' => ').trim() };
}

interface MatchingChip {
  id: string;
  text: string;
}

interface MatchingPair {
  label: string;
  left: string;
  right: string;
}

const POOL_ID = '__pool__';

function shuffleDeterministic<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  let s = seed >>> 0;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function MatchingChipView({
  chip,
  isOverlay,
}: {
  chip: MatchingChip;
  isOverlay?: boolean;
}) {
  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-xl border-2 px-3 py-2 text-sm font-medium transition-shadow ${
        isOverlay
          ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)] shadow-[var(--shadow-md)] cursor-grabbing'
          : 'border-[var(--color-border)] bg-[var(--color-bg-card)] text-[var(--color-text-primary)] shadow-[var(--shadow-sm)] hover:border-[var(--color-primary)]/60 cursor-grab active:cursor-grabbing'
      }`}
    >
      <svg
        className="h-3.5 w-3.5 text-[var(--color-text-muted)]"
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path d="M7 4a1 1 0 100 2 1 1 0 000-2zM7 9a1 1 0 100 2 1 1 0 000-2zM7 14a1 1 0 100 2 1 1 0 000-2zM13 4a1 1 0 100 2 1 1 0 000-2zM13 9a1 1 0 100 2 1 1 0 000-2zM13 14a1 1 0 100 2 1 1 0 000-2z" />
      </svg>
      <MathText>{chip.text}</MathText>
    </div>
  );
}

function DraggableChip({ chip }: { chip: MatchingChip }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: chip.id,
    data: { chip },
  });
  return (
    <div
      ref={setNodeRef}
      style={{ opacity: isDragging ? 0 : 1 }}
      {...attributes}
      {...listeners}
    >
      <MatchingChipView chip={chip} />
    </div>
  );
}

function DropSlot({
  id,
  chip,
  placeholder,
}: {
  id: string;
  chip: MatchingChip | null;
  placeholder: string;
}) {
  const { isOver, setNodeRef } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-[52px] items-center justify-center rounded-xl border-2 border-dashed px-3 py-2 text-sm transition-colors ${
        isOver
          ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)]'
          : chip
            ? 'border-[var(--color-primary)]/60 bg-[var(--color-primary-soft)]/50'
            : 'border-[var(--color-border-strong)] bg-[var(--color-bg-input)]'
      }`}
    >
      {chip ? (
        <DraggableChip chip={chip} />
      ) : (
        <span className="text-xs italic text-[var(--color-text-muted)]">{placeholder}</span>
      )}
    </div>
  );
}

function PoolDropZone({
  chips,
  activeChipId,
}: {
  chips: MatchingChip[];
  activeChipId: string | null;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: POOL_ID });
  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-[80px] flex-wrap items-center gap-2 rounded-2xl border-2 border-dashed p-3 transition-colors ${
        isOver
          ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)]/40'
          : 'border-[var(--color-border)] bg-[var(--color-bg-subtle)]'
      }`}
    >
      {chips.length === 0 ? (
        <span className="text-xs italic text-[var(--color-text-muted)]">
          All answers have been placed. Drag one back here to undo.
        </span>
      ) : (
        chips.map((chip) =>
          chip.id === activeChipId ? (
            <div key={chip.id} style={{ opacity: 0 }}>
              <MatchingChipView chip={chip} />
            </div>
          ) : (
            <DraggableChip key={chip.id} chip={chip} />
          ),
        )
      )}
    </div>
  );
}

export function AnswerOptions({
  question,
  answer,
  onSingleSelect,
  onMultiSelect,
  onTextAnswer,
  onMatchingAnswer,
}: AnswerOptionsProps) {
  const qid = question.questionId;

  if (question.questionType === 'SHORT_ANSWER') {
    return (
      <textarea
        rows={4}
        value={typeof answer === 'string' ? answer : ''}
        onChange={(e) => onTextAnswer(qid, e.target.value)}
        className="w-full rounded-2xl border-2 border-[var(--color-border)] bg-[var(--color-bg-input)] p-4 text-sm leading-relaxed text-[var(--color-text-primary)] shadow-[var(--shadow-sm)] transition-[border-color,box-shadow] placeholder:text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)] focus:border-[var(--color-primary)] focus:outline-none focus:shadow-[var(--ring-brand)]"
        placeholder="Type your answer here…"
      />
    );
  }

  if (question.questionType === 'MATCHING') {
    return (
      <MatchingDragDrop
        question={question}
        answer={answer}
        onMatchingAnswer={onMatchingAnswer}
      />
    );
  }

  const isMulti = question.questionType === 'MULTIPLE_CHOICE';

  return (
    <div className="space-y-3 stagger">
      {question.options.map((opt) => {
        const selected = isMulti
          ? Array.isArray(answer) && (answer as number[]).includes(opt.id)
          : answer === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => (isMulti ? onMultiSelect(qid, opt.id) : onSingleSelect(qid, opt.id))}
            className={`group flex w-full items-start gap-4 rounded-2xl border-2 p-4 text-left transition-all duration-150 will-change-transform active:scale-[0.995] focus-ring-brand ${
              selected
                ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)] shadow-[var(--shadow-md)]'
                : 'border-[var(--color-border)] bg-[var(--color-bg-card)] hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-bg-subtle)]'
            }`}
          >
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold transition-all ${
                selected
                  ? 'bg-gradient-brand text-white shadow-[var(--shadow-brand)]'
                  : 'bg-[var(--color-bg-muted)] text-[var(--color-text-secondary)] group-hover:bg-[var(--color-primary-soft)] group-hover:text-[var(--color-primary)]'
              }`}
            >
              {isMulti ? (
                selected ? (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                ) : (
                  <span className="block h-3.5 w-3.5 rounded border-2 border-current" />
                )
              ) : (
                opt.label
              )}
            </span>
            <div
              className={`flex-1 pt-1 text-sm leading-relaxed ${
                selected
                  ? 'font-medium text-[var(--color-text-primary)]'
                  : 'text-[var(--color-text-secondary)]'
              }`}
            >
              <MathText>{opt.content}</MathText>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function MatchingDragDrop({
  question,
  answer,
  onMatchingAnswer,
}: {
  question: ExamQuestion;
  answer: StudentAnswerValue | undefined;
  onMatchingAnswer: (questionId: number, label: string, value: string) => void;
}) {
  const qid = question.questionId;

  const pairs: MatchingPair[] = useMemo(() => {
    return question.options
      .map((opt) => {
        const { left, right } = splitMatchingPair(opt.content);
        if (!left || !right) return null;
        return { label: opt.label, left, right };
      })
      .filter((p): p is MatchingPair => p !== null);
  }, [question.options]);

  const allChips: MatchingChip[] = useMemo(() => {
    return question.options.map((opt) => {
      const { left, right } = splitMatchingPair(opt.content);
      const text = left && right ? right : opt.content.trim();
      return { id: `chip-${opt.id}`, text };
    });
  }, [question.options]);

  const shuffledChipIdsRef = useRef<string[] | null>(null);
  const shuffledChips: MatchingChip[] = useMemo(() => {
    if (!shuffledChipIdsRef.current) {
      const seed = question.questionId * 9301 + 49297;
      shuffledChipIdsRef.current = shuffleDeterministic(allChips, seed).map((c) => c.id);
    }
    const byId = new Map(allChips.map((c) => [c.id, c]));
    return shuffledChipIdsRef.current
      .map((id) => byId.get(id))
      .filter((c): c is MatchingChip => Boolean(c));
  }, [allChips, question.questionId]);

  const matchingAnswer: Record<string, string> = useMemo(() => {
    if (answer && typeof answer === 'object' && !Array.isArray(answer)) {
      return answer as Record<string, string>;
    }
    return {};
  }, [answer]);

  const slotAssignments: Record<string, MatchingChip | null> = useMemo(() => {
    const assigned: Record<string, MatchingChip | null> = {};
    const usedChipIds = new Set<string>();
    for (const pair of pairs) {
      const stored = matchingAnswer[pair.label];
      if (!stored) {
        assigned[pair.label] = null;
        continue;
      }
      const chip = shuffledChips.find(
        (c) =>
          !usedChipIds.has(c.id) &&
          c.text.replace(/\s+/g, ' ').trim().toLowerCase() ===
            stored.replace(/\s+/g, ' ').trim().toLowerCase(),
      );
      if (chip) {
        usedChipIds.add(chip.id);
        assigned[pair.label] = chip;
      } else {
        assigned[pair.label] = null;
      }
    }
    return assigned;
  }, [pairs, matchingAnswer, shuffledChips]);

  const pooledChips: MatchingChip[] = useMemo(() => {
    const used = new Set(
      Object.values(slotAssignments)
        .filter((c): c is MatchingChip => c !== null)
        .map((c) => c.id),
    );
    return shuffledChips.filter((c) => !used.has(c.id));
  }, [shuffledChips, slotAssignments]);

  const [activeChipId, setActiveChipId] = useState<string | null>(null);
  const activeChip =
    activeChipId !== null
      ? shuffledChips.find((c) => c.id === activeChipId) ?? null
      : null;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor),
  );

  const findSlotByChipId = (chipId: string): string | null => {
    for (const [label, chip] of Object.entries(slotAssignments)) {
      if (chip?.id === chipId) return label;
    }
    return null;
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveChipId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveChipId(null);
    const { active, over } = event;
    if (!over) return;
    const chipId = String(active.id);
    const dropTargetId = String(over.id);

    const sourceLabel = findSlotByChipId(chipId);
    const chip = shuffledChips.find((c) => c.id === chipId);
    if (!chip) return;

    if (dropTargetId === POOL_ID) {
      if (sourceLabel) onMatchingAnswer(qid, sourceLabel, '');
      return;
    }

    const targetLabel = dropTargetId;
    if (!pairs.find((p) => p.label === targetLabel)) return;

    const occupant = slotAssignments[targetLabel];
    if (occupant && occupant.id === chipId) return;

    if (occupant && sourceLabel) {
      onMatchingAnswer(qid, sourceLabel, occupant.text);
      onMatchingAnswer(qid, targetLabel, chip.text);
      return;
    }

    if (occupant && !sourceLabel) {
      onMatchingAnswer(qid, targetLabel, chip.text);
      return;
    }

    if (sourceLabel && sourceLabel !== targetLabel) {
      onMatchingAnswer(qid, sourceLabel, '');
    }
    onMatchingAnswer(qid, targetLabel, chip.text);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveChipId(null)}
    >
      <div className="space-y-5">
        <div className="space-y-3 stagger">
          {pairs.map((pair) => (
            <div
              key={pair.label}
              className="grid items-center gap-3 rounded-2xl border-2 border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 transition-colors sm:grid-cols-[1fr_auto_1fr]"
            >
              <div className="text-sm font-medium text-[var(--color-text-primary)]">
                <MathText>{pair.left}</MathText>
              </div>
              <div className="hidden text-[var(--color-text-muted)] sm:block">→</div>
              <DropSlot
                id={pair.label}
                chip={slotAssignments[pair.label] ?? null}
                placeholder="Drop answer here…"
              />
            </div>
          ))}
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              Answer pool
            </span>
            <span className="text-[11px] text-[var(--color-text-muted)]">
              {pooledChips.length} / {shuffledChips.length} remaining
            </span>
          </div>
          <PoolDropZone chips={pooledChips} activeChipId={activeChipId} />
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeChip ? <MatchingChipView chip={activeChip} isOverlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}
