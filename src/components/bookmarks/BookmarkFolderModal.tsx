import { useState, useEffect } from 'react';
import {
  Folder,
  FolderPlus,
  Edit2,
  Trash2,
  Bookmark,
  Zap,
  Star,
  AlertCircle,
  BookOpen,
  CheckCircle,
  Target,
  FileText,
  Flame,
  Award,
} from 'lucide-react';
import { Modal, Button } from '@/components/ui';
import type { BookmarkFolder } from '@/types';

export interface BookmarkFolderModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: { name: string; color: string; icon: string; description: string }) => void;
  onDelete?: (id: string) => void;
  folder?: BookmarkFolder | null;
  questionCount?: number;
}

export const COLOR_OPTIONS = [
  { id: 'blue', name: 'Ocean Blue', bg: 'bg-blue-500', text: 'text-blue-400', badge: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  { id: 'emerald', name: 'Emerald', bg: 'bg-emerald-500', text: 'text-emerald-400', badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  { id: 'rose', name: 'Rose Red', bg: 'bg-rose-500', text: 'text-rose-400', badge: 'bg-rose-500/15 text-rose-400 border-rose-500/30' },
  { id: 'amber', name: 'Amber Gold', bg: 'bg-amber-500', text: 'text-amber-400', badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  { id: 'purple', name: 'Deep Violet', bg: 'bg-purple-500', text: 'text-purple-400', badge: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
  { id: 'cyan', name: 'Cyan Tech', bg: 'bg-cyan-500', text: 'text-cyan-400', badge: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30' },
  { id: 'orange', name: 'Sunset Orange', bg: 'bg-orange-500', text: 'text-orange-400', badge: 'bg-orange-500/15 text-orange-400 border-orange-500/30' },
];

export const ICON_OPTIONS = [
  { id: 'folder', name: 'Folder', icon: Folder },
  { id: 'bookmark', name: 'Bookmark', icon: Bookmark },
  { id: 'zap', name: 'Formula', icon: Zap },
  { id: 'star', name: 'Star', icon: Star },
  { id: 'alert-circle', name: 'Mistake', icon: AlertCircle },
  { id: 'book-open', name: 'Book', icon: BookOpen },
  { id: 'target', name: 'Target', icon: Target },
  { id: 'file-text', name: 'Notes', icon: FileText },
  { id: 'flame', name: 'Hot Topic', icon: Flame },
  { id: 'award', name: 'Mastery', icon: Award },
];

export function getFolderColorClasses(color?: string) {
  const match = COLOR_OPTIONS.find((c) => c.id === color) || COLOR_OPTIONS[0];
  return match;
}

export function getFolderIconComponent(iconName?: string) {
  const match = ICON_OPTIONS.find((i) => i.id === iconName);
  return match ? match.icon : Folder;
}

export function BookmarkFolderModal({
  open,
  onClose,
  onSave,
  onDelete,
  folder,
  questionCount = 0,
}: BookmarkFolderModalProps) {
  const isEditing = !!folder;
  const isSystem = folder?.isSystem || folder?.id === 'default';

  const [name, setName] = useState('');
  const [color, setColor] = useState('blue');
  const [icon, setIcon] = useState('folder');
  const [description, setDescription] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (folder) {
      setName(folder.name || '');
      setColor(folder.color || 'blue');
      setIcon(folder.icon || 'folder');
      setDescription(folder.description || '');
      setConfirmDelete(false);
    } else {
      setName('');
      setColor('blue');
      setIcon('folder');
      setDescription('');
      setConfirmDelete(false);
    }
  }, [folder, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      color,
      icon,
      description: description.trim(),
    });
    onClose();
  };

  const handleDelete = () => {
    if (!folder || isSystem || !onDelete) return;
    onDelete(folder.id);
    onClose();
  };

  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      maxWidth="max-w-lg"
      panelClassName="overflow-y-auto overscroll-contain"
    >
      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5" data-lenis-prevent>
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary-soft text-primary text-xs font-semibold mb-1">
              {isEditing ? <Edit2 size={12} /> : <FolderPlus size={12} />}
              <span>{isEditing ? 'Edit Category' : 'New Category'}</span>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-text">
              {isEditing ? `Edit "${folder.name}"` : 'Create Bookmark Category'}
            </h2>
          </div>
        </div>

        {/* Name input */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold uppercase tracking-wider text-muted">
            Category Name <span className="text-danger">*</span>
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Geometry Formulas, English Vocab, Speed Drills"
            className="w-full h-11 px-3.5 rounded-xl bg-surface-2 border border-border text-text placeholder:text-muted/60 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
            autoFocus
          />
        </div>

        {/* Description input */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold uppercase tracking-wider text-muted">
            Description <span className="text-muted/60 font-normal">(optional)</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add key objectives or notes for this category..."
            rows={2}
            className="w-full px-3.5 py-2.5 rounded-xl bg-surface-2 border border-border text-text placeholder:text-muted/60 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors resize-none"
          />
        </div>

        {/* Color Palette Picker */}
        <div className="space-y-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-muted">
            Category Accent Color
          </label>
          <div className="flex flex-wrap gap-2.5">
            {COLOR_OPTIONS.map((c) => {
              const isSelected = color === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setColor(c.id)}
                  title={c.name}
                  className={`relative w-8 h-8 rounded-full transition-all flex items-center justify-center ${c.bg} ${
                    isSelected ? 'ring-4 ring-primary/40 scale-110 shadow-md' : 'opacity-80 hover:opacity-100'
                  }`}
                >
                  {isSelected && <CheckCircle size={14} className="text-white drop-shadow" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Icon Picker */}
        <div className="space-y-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-muted">
            Category Icon
          </label>
          <div className="grid grid-cols-5 gap-2">
            {ICON_OPTIONS.map((opt) => {
              const IconComp = opt.icon;
              const isSelected = icon === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setIcon(opt.id)}
                  className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all ${
                    isSelected
                      ? 'border-primary bg-primary-soft/60 ring-1 ring-primary text-primary'
                      : 'border-border bg-surface-2 hover:bg-surface-3 text-muted hover:text-text'
                  }`}
                >
                  <IconComp size={18} />
                  <span className="text-[10px] font-medium mt-1 truncate max-w-full">
                    {opt.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Live Preview */}
        <div className="p-3.5 rounded-xl bg-surface-2 border border-border/70">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted mb-2">
            Live Preview
          </div>
          <div className="flex items-center gap-3">
            {(() => {
              const IconComp = getFolderIconComponent(icon);
              const colorCls = getFolderColorClasses(color);
              return (
                <div className={`w-10 h-10 rounded-xl grid place-items-center border ${colorCls.badge}`}>
                  <IconComp size={20} />
                </div>
              );
            })()}
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-text truncate">
                {name.trim() || 'Untitled Category'}
              </div>
              <div className="text-xs text-muted truncate mt-0.5">
                {description.trim() || `${questionCount} saved questions`}
              </div>
            </div>
          </div>
        </div>

        {/* Delete Warning if editing non-system folder */}
        {isEditing && !isSystem && onDelete && (
          <div className="pt-2 border-t border-border">
            {confirmDelete ? (
              <div className="p-3 rounded-xl bg-danger-soft/60 border border-danger/30 space-y-2">
                <p className="text-xs font-semibold text-danger-fg">
                  Are you sure? All {questionCount} questions in this category will be moved back to "General".
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    onClick={handleDelete}
                    className="text-xs"
                  >
                    Confirm Delete
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setConfirmDelete(false)}
                    className="text-xs"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="text-xs font-semibold text-danger-fg hover:underline inline-flex items-center gap-1"
              >
                <Trash2 size={13} /> Delete this category
              </button>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} size="md">
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="md" disabled={!name.trim()}>
            {isEditing ? 'Save Changes' : 'Create Category'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
