import { useEffect, useState } from 'react';
import { useLatest } from '@/hooks/use-latest';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useListChildrenQuery } from './customers-api';
import { isRedactedChild, type Child, type Gender } from '@/types/api';
import type { CreateChildRequest } from './customers-api';
import { isValidBdPhone, PHONE_ERROR } from '@/lib/phone';
import { Plus, TriangleAlert, UserRound } from 'lucide-react';

export interface ChildSelection {
  /** An existing child on this guardian's account. */
  childId: string | null;
  /** Filled in when adding a new one. */
  draft: CreateChildRequest;
  mode: 'existing' | 'new';
}

export function emptyChildSelection(guardianName = '', guardianPhone = ''): ChildSelection {
  return {
    childId: null,
    mode: 'new',
    draft: {
      name: '',
      dateOfBirth: '',
      emergencyContactName: guardianName,
      emergencyContactPhone: guardianPhone,
    },
  };
}

/**
 * Pick a child already on the guardian's account, or add one.
 *
 * When the guardian is new there is nothing to pick from, so it goes straight
 * to the form. The emergency contact defaults to the guardian, which is right
 * almost every time and still editable.
 */
export function ChildPicker({
  customerId,
  guardianName,
  guardianPhone,
  value,
  onChange,
  disabled,
}: {
  customerId: string | null;
  guardianName: string;
  guardianPhone: string;
  value: ChildSelection;
  onChange: (value: ChildSelection) => void;
  disabled?: boolean;
}) {
  const { data: children, isLoading } = useListChildrenQuery(customerId ?? '', { skip: !customerId });
  const [touched, setTouched] = useState(false);

  const available = (children ?? []).filter((child): child is Child => !isRedactedChild(child) && child.isActive);

  // Read through a ref so the defaulting effects below can fire on a narrow
  // trigger without closing over a stale selection.
  const latest = useLatest({ value, onChange, available });

  // Default to the only child on file; with one child this removes a step that
  // has exactly one possible answer.
  const availableCount = available.length;

  useEffect(() => {
    const { value: current, onChange: emit, available: options } = latest.current;

    if (!customerId) {
      if (current.mode !== 'new' || current.childId !== null) {
        emit({ ...current, mode: 'new', childId: null });
      }
      return;
    }
    if (options.length > 0 && current.childId === null && current.mode === 'new') {
      emit({ ...current, mode: 'existing', childId: options[0].id });
    }
    if (options.length === 0 && current.mode === 'existing') {
      emit({ ...current, mode: 'new', childId: null });
    }
  }, [customerId, availableCount, latest]);

  // Keep the emergency contact in step with the guardian while it is untouched.
  useEffect(() => {
    const { value: current, onChange: emit } = latest.current;
    if (current.mode !== 'new' || touched) return;
    if (
      current.draft.emergencyContactName === guardianName &&
      current.draft.emergencyContactPhone === guardianPhone
    ) {
      return;
    }
    emit({
      ...current,
      draft: { ...current.draft, emergencyContactName: guardianName, emergencyContactPhone: guardianPhone },
    });
  }, [guardianName, guardianPhone, touched, latest]);

  const updateDraft = (patch: Partial<CreateChildRequest>) => {
    onChange({ ...value, draft: { ...value.draft, ...patch } });
  };

  if (customerId && isLoading) return <Skeleton className="h-24 w-full rounded-lg" />;

  return (
    <div className="space-y-3">
      {available.length > 0 ? (
        <div className="space-y-2">
          <Label>Child</Label>
          <div className="grid gap-2 sm:grid-cols-2">
            {available.map((child) => {
              const isSelected = value.mode === 'existing' && value.childId === child.id;
              return (
                <button
                  key={child.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange({ ...value, mode: 'existing', childId: child.id })}
                  className={`rounded-lg border p-3 text-left transition-colors ${
                    isSelected ? 'border-primary bg-primary/5' : 'hover:bg-accent'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <UserRound className="text-muted-foreground size-4 shrink-0" />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{child.name}</p>
                      <p className="text-muted-foreground text-xs">{child.ageYears} years old</p>
                    </div>
                  </div>
                  {child.medicalNotes ? (
                    <p className="text-warning-foreground dark:text-warning mt-2 flex items-start gap-1 text-xs">
                      <TriangleAlert className="mt-0.5 size-3 shrink-0" />
                      {child.medicalNotes}
                    </p>
                  ) : null}
                </button>
              );
            })}
          </div>

          <Button
            type="button"
            variant={value.mode === 'new' ? 'secondary' : 'outline'}
            size="sm"
            disabled={disabled}
            onClick={() => onChange({ ...value, mode: 'new', childId: null })}
          >
            <Plus /> Add another child
          </Button>
        </div>
      ) : null}

      {value.mode === 'new' ? (
        <div className="space-y-3 rounded-lg border p-3">
          <p className="text-sm font-medium">{available.length > 0 ? 'New child' : 'Child details'}</p>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="child-name">Name</Label>
              <Input
                id="child-name"
                value={value.draft.name}
                onChange={(event) => updateDraft({ name: event.target.value })}
                placeholder="Ayaan Rahman"
                disabled={disabled}
                maxLength={120}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="child-dob">Date of birth</Label>
              <Input
                id="child-dob"
                type="date"
                value={value.draft.dateOfBirth}
                onChange={(event) => updateDraft({ dateOfBirth: event.target.value })}
                max={new Date().toISOString().slice(0, 10)}
                disabled={disabled}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="child-gender">Gender (optional)</Label>
              <Select
                value={value.draft.gender ?? 'unset'}
                disabled={disabled}
                onValueChange={(next) => updateDraft({ gender: next === 'unset' ? undefined : (next as Gender) })}
              >
                <SelectTrigger id="child-gender">
                  <SelectValue placeholder="Not given" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unset">Not given</SelectItem>
                  <SelectItem value="MALE">Boy</SelectItem>
                  <SelectItem value="FEMALE">Girl</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="child-medical">Allergies or medical notes (optional)</Label>
              <Input
                id="child-medical"
                value={value.draft.medicalNotes ?? ''}
                onChange={(event) => updateDraft({ medicalNotes: event.target.value })}
                placeholder="Peanut allergy"
                disabled={disabled}
                maxLength={500}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="child-emergency-name">Emergency contact</Label>
              <Input
                id="child-emergency-name"
                value={value.draft.emergencyContactName}
                onChange={(event) => {
                  setTouched(true);
                  updateDraft({ emergencyContactName: event.target.value });
                }}
                disabled={disabled}
                maxLength={120}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="child-emergency-phone">Emergency phone</Label>
              <Input
                id="child-emergency-phone"
                value={value.draft.emergencyContactPhone}
                onChange={(event) => {
                  setTouched(true);
                  updateDraft({ emergencyContactPhone: event.target.value });
                }}
                inputMode="tel"
                disabled={disabled}
                className="tabular"
                aria-invalid={
                  value.draft.emergencyContactPhone.length > 0 && !isValidBdPhone(value.draft.emergencyContactPhone)
                }
              />
              {value.draft.emergencyContactPhone.length > 0 &&
              !isValidBdPhone(value.draft.emergencyContactPhone) ? (
                <p className="text-destructive text-sm">{PHONE_ERROR}</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** The `child` field a Kid Zone sale expects. */
export function toChildRef(selection: ChildSelection) {
  if (selection.mode === 'existing' && selection.childId) return { id: selection.childId };
  return {
    create: {
      ...selection.draft,
      medicalNotes: selection.draft.medicalNotes?.trim() || undefined,
    },
  };
}

export function isChildReady(selection: ChildSelection): boolean {
  if (selection.mode === 'existing') return selection.childId !== null;

  const { name, dateOfBirth, emergencyContactName, emergencyContactPhone } = selection.draft;
  return (
    name.trim().length >= 1 &&
    /^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth) &&
    emergencyContactName.trim().length >= 2 &&
    isValidBdPhone(emergencyContactPhone)
  );
}
