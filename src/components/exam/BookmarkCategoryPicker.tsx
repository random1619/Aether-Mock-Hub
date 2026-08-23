import { useEffect, useMemo, useState } from 'react';
import { BookmarkCheck, Check, FolderPlus, X } from 'lucide-react';
import { Modal, Button } from '@/components/ui';
import type { BookmarkFolder } from '@/types';
import { getFolderColorClasses, getFolderIconComponent } from '@/components/bookmarks/BookmarkFolderModal';

export interface BookmarkCategoryPickerProps {
  open: boolean;
  questionNumber: number;
  folders: BookmarkFolder[];
  onClose: () => void;
  onConfirm: (folderId: string) => void;
  onCreateFolder?: (name: string) => BookmarkFolder | undefined;
}

export function BookmarkCategoryPicker({
  open,
  questionNumber,
  folders,
  onClose,
  onConfirm,
  onCreateFolder,
}: BookmarkCategoryPickerProps) {
  const defaultFolder = useMemo(
    () => folders.find((folder) => folder.id === 'default') || folders[0],
    [folders],
  );
  const [selectedId, setSelectedId] = useState(defaultFolder?.id || 'default');
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (open) {
      setSelectedId(defaultFolder?.id || 'default');
      setNewName('');
      setCreating(false);
    }
  }, [open, defaultFolder]);

  const confirm = () => {
    if (selectedId) onConfirm(selectedId);
  };

  const create = () => {
    const name = newName.trim();
    if (!name || !onCreateFolder) return;
    const folder = onCreateFolder(name);
    if (folder) {
      setSelectedId(folder.id);
      setNewName('');
      setCreating(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} maxWidth="max-w-xl" panelClassName="overflow-hidden">
      <div className="space-y-5" data-lenis-prevent>
        <div className="flex items-start justify-between gap-4 border-b border-border/70 pb-4">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary shadow-sm">
              <BookmarkCheck size={19} />
            </div>
            <div>
              <div className="mb-1 text-[10px] font-black uppercase tracking-[0.18em] text-primary">Save question {questionNumber}</div>
              <h2 className="text-xl font-black tracking-tight text-text">Choose a bookmark category</h2>
              <p className="mt-1 text-xs leading-relaxed text-muted">Keep this question close to the kind of practice you want to do next.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-xl text-muted transition hover:bg-surface-2 hover:text-text">
            <X size={16} />
          </button>
        </div>

        {folders.length ? (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3" role="radiogroup" aria-label="Bookmark category">
            {folders.map((folder) => {
              const Icon = getFolderIconComponent(folder.icon);
              const color = getFolderColorClasses(folder.color);
              const selected = selectedId === folder.id;
              return (
                <button
                  key={folder.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setSelectedId(folder.id)}
                  className={`group relative rounded-2xl border p-3 text-left transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 ${
                    selected
                      ? 'border-primary bg-primary-soft/60 shadow-[0_8px_24px_rgba(0,0,0,0.08)] ring-1 ring-primary/50'
                      : 'border-border bg-surface-2 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-surface'
                  }`}
                >
                  <span className={`mb-3 grid h-9 w-9 place-items-center rounded-xl border ${color.badge}`}><Icon size={17} /></span>
                  <span className="block truncate text-sm font-extrabold text-text">{folder.name}</span>
                  <span className="mt-0.5 block truncate text-[10px] text-muted">{folder.description || (folder.isSystem ? 'Built-in category' : 'Personal category')}</span>
                  {selected && <span className="absolute right-2.5 top-2.5 grid h-5 w-5 place-items-center rounded-full bg-primary text-primary-foreground"><Check size={12} strokeWidth={3} /></span>}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted">No categories yet. Create one to save this question.</div>
        )}

        {onCreateFolder && (
          <div className="rounded-2xl border border-border/70 bg-surface-2/70 p-3">
            {!creating ? (
              <button type="button" onClick={() => setCreating(true)} className="inline-flex items-center gap-2 text-xs font-extrabold text-primary hover:text-primary/80">
                <FolderPlus size={15} /> Create a new category
              </button>
            ) : (
              <div className="flex gap-2">
                <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && create()} placeholder="e.g. Revise this weekend" className="h-10 min-w-0 flex-1 rounded-xl border border-border bg-surface px-3 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
                <Button type="button" size="sm" onClick={create} disabled={!newName.trim()}>Add</Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setCreating(false)}>Cancel</Button>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 border-t border-border/70 pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="button" onClick={confirm} disabled={!selectedId}>Save to category</Button>
        </div>
      </div>
    </Modal>
  );
}
