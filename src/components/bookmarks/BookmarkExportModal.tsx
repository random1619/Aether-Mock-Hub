import { useState } from 'react';
import {
  Download,
  FileText,
  Copy,
  Check,
  Printer,
  Code,
} from 'lucide-react';
import { Modal, Button } from '@/components/ui';
import type { SavedQuestionRecord } from '@/types';

export interface BookmarkExportModalProps {
  open: boolean;
  onClose: () => void;
  questions: (SavedQuestionRecord & { provider?: string; subject?: string })[];
  folderName?: string;
}

export function BookmarkExportModal({
  open,
  onClose,
  questions,
  folderName = 'All Bookmarks',
}: BookmarkExportModalProps) {
  const [format, setFormat] = useState<'markdown' | 'json' | 'text'>('markdown');
  const [includeSolutions, setIncludeSolutions] = useState(true);
  const [includeNotes, setIncludeNotes] = useState(true);
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  const generateMarkdown = () => {
    let md = `# Bookmark Study Sheet: ${folderName}\n\n`;
    md += `*Generated on ${new Date().toLocaleDateString()} · Total ${questions.length} questions*\n\n---\n\n`;

    questions.forEach((q, idx) => {
      md += `### Question ${idx + 1} (${q.provider || 'Exam'} - ${q.subject || 'General'})\n\n`;
      if (q.comp) {
        md += `> **Passage:**\n> ${q.comp.replace(/\n/g, '\n> ')}\n\n`;
      }
      md += `${q.question}\n\n`;
      q.options.forEach((opt, optIdx) => {
        const isCorrect = optIdx === q.correct_option_id;
        md += `- **${String.fromCharCode(65 + optIdx)}:** ${opt}${includeSolutions && isCorrect ? ' *(Correct)*' : ''}\n`;
      });
      md += '\n';

      if (includeSolutions && q.solution) {
        md += `**Solution:**\n${q.solution}\n\n`;
      }

      if (includeNotes && q.notes) {
        md += `**Personal Notes:**\n*${q.notes}*\n\n`;
      }

      md += '---\n\n';
    });

    return md;
  };

  const generateJson = () => {
    return JSON.stringify(questions, null, 2);
  };

  const generatePlainText = () => {
    let txt = `BOOKMARK STUDY SHEET: ${folderName.toUpperCase()}\n`;
    txt += `Total Questions: ${questions.length} | Date: ${new Date().toLocaleDateString()}\n\n`;
    txt += '==================================================\n\n';

    questions.forEach((q, idx) => {
      txt += `Q${idx + 1}. [${q.subject || 'General'}] ${q.question.replace(/<[^>]*>?/gm, '')}\n\n`;
      q.options.forEach((opt, optIdx) => {
        txt += `   (${String.fromCharCode(65 + optIdx)}) ${opt.replace(/<[^>]*>?/gm, '')}\n`;
      });
      txt += '\n';

      if (includeSolutions) {
        txt += `   Correct Answer: (${String.fromCharCode(65 + q.correct_option_id)})\n`;
        if (q.solution) {
          txt += `   Solution: ${q.solution.replace(/<[^>]*>?/gm, '')}\n`;
        }
      }
      if (includeNotes && q.notes) {
        txt += `   My Note: ${q.notes}\n`;
      }
      txt += '\n--------------------------------------------------\n\n';
    });

    return txt;
  };

  const getContent = () => {
    if (format === 'json') return generateJson();
    if (format === 'text') return generatePlainText();
    return generateMarkdown();
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(getContent());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const handleDownload = () => {
    const content = getContent();
    const extension = format === 'json' ? 'json' : format === 'markdown' ? 'md' : 'txt';
    const mimeType =
      format === 'json' ? 'application/json' : 'text/plain;charset=utf-8';

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bookmarks_${folderName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    let html = `<!DOCTYPE html><html><head><title>Bookmarks - ${folderName}</title>`;
    html += `<style>
      body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.5; padding: 24px; color: #111; max-width: 800px; margin: auto; }
      h1 { border-bottom: 2px solid #2563eb; padding-bottom: 8px; font-size: 20px; }
      .meta { font-size: 12px; color: #666; margin-bottom: 20px; }
      .q-card { border: 1px solid #ddd; border-radius: 8px; padding: 16px; margin-bottom: 16px; page-break-inside: avoid; }
      .q-num { font-weight: bold; color: #2563eb; font-size: 14px; margin-bottom: 6px; }
      .q-text { font-size: 14px; margin-bottom: 12px; font-weight: 500; }
      .opt { margin: 4px 0; font-size: 13px; }
      .opt.correct { color: #16a34a; font-weight: bold; }
      .sol { margin-top: 10px; padding: 10px; background: #f8fafc; border-radius: 6px; font-size: 12px; border-left: 3px solid #16a34a; }
      .note { margin-top: 6px; padding: 8px; background: #fffbeb; font-size: 12px; border-left: 3px solid #d97706; }
    </style></head><body>`;

    html += `<h1>Bookmarks Revision Sheet: ${folderName}</h1>`;
    html += `<div class="meta">Total: ${questions.length} questions | Printed on ${new Date().toLocaleDateString()}</div>`;

    questions.forEach((q, idx) => {
      html += `<div class="q-card">`;
      html += `<div class="q-num">Q${idx + 1} (${q.subject || 'General'} · ${q.provider || 'Source'})</div>`;
      if (q.comp) html += `<div style="font-size:12px; color:#555; background:#eee; padding:6px; margin-bottom:8px;">${q.comp}</div>`;
      html += `<div class="q-text">${q.question}</div>`;
      q.options.forEach((opt, optIdx) => {
        const isRight = optIdx === q.correct_option_id;
        html += `<div class="opt ${includeSolutions && isRight ? 'correct' : ''}">(${String.fromCharCode(65 + optIdx)}) ${opt} ${includeSolutions && isRight ? '✓' : ''}</div>`;
      });
      if (includeSolutions && q.solution) {
        html += `<div class="sol"><strong>Solution:</strong> ${q.solution}</div>`;
      }
      if (includeNotes && q.notes) {
        html += `<div class="note"><strong>My Note:</strong> ${q.notes}</div>`;
      }
      html += `</div>`;
    });

    html += `<script>window.print();</script></body></html>`;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      maxWidth="max-w-2xl"
      panelClassName="overflow-y-auto overscroll-contain"
    >
      <div className="space-y-5" data-lenis-prevent>
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary-soft text-primary grid place-items-center">
              <Download size={16} />
            </div>
            <div>
              <h2 className="text-base font-bold text-text">Export &amp; Print Bookmarks</h2>
              <p className="text-xs text-muted">
                {questions.length} question{questions.length === 1 ? '' : 's'} from {folderName}
              </p>
            </div>
          </div>
        </div>

        {/* Format Selector */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold uppercase tracking-wider text-muted">
            Export Format
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setFormat('markdown')}
              className={`p-3 rounded-xl border text-left flex items-center gap-2.5 transition-all ${
                format === 'markdown'
                  ? 'border-primary bg-primary-soft/60 ring-1 ring-primary text-primary font-bold'
                  : 'border-border bg-surface-2 hover:bg-surface-3 text-text'
              }`}
            >
              <FileText size={16} />
              <div className="text-xs">
                <div>Markdown (.md)</div>
                <div className="text-[10px] text-muted font-normal">Notion / Obsidian</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setFormat('text')}
              className={`p-3 rounded-xl border text-left flex items-center gap-2.5 transition-all ${
                format === 'text'
                  ? 'border-primary bg-primary-soft/60 ring-1 ring-primary text-primary font-bold'
                  : 'border-border bg-surface-2 hover:bg-surface-3 text-text'
              }`}
            >
              <Printer size={16} />
              <div className="text-xs">
                <div>Plain Text (.txt)</div>
                <div className="text-[10px] text-muted font-normal">Simple &amp; clean</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setFormat('json')}
              className={`p-3 rounded-xl border text-left flex items-center gap-2.5 transition-all ${
                format === 'json'
                  ? 'border-primary bg-primary-soft/60 ring-1 ring-primary text-primary font-bold'
                  : 'border-border bg-surface-2 hover:bg-surface-3 text-text'
              }`}
            >
              <Code size={16} />
              <div className="text-xs">
                <div>Raw JSON (.json)</div>
                <div className="text-[10px] text-muted font-normal">Backup / Data</div>
              </div>
            </button>
          </div>
        </div>

        {/* Options */}
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <label className="inline-flex items-center gap-2 cursor-pointer text-text select-none">
            <input
              type="checkbox"
              checked={includeSolutions}
              onChange={(e) => setIncludeSolutions(e.target.checked)}
              className="w-4 h-4 rounded accent-primary cursor-pointer"
            />
            <span className="font-semibold">Include Solutions &amp; Answers</span>
          </label>

          <label className="inline-flex items-center gap-2 cursor-pointer text-text select-none">
            <input
              type="checkbox"
              checked={includeNotes}
              onChange={(e) => setIncludeNotes(e.target.checked)}
              className="w-4 h-4 rounded accent-primary cursor-pointer"
            />
            <span className="font-semibold">Include Personal Notes</span>
          </label>
        </div>

        {/* Preview snippet */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted">
            <span className="font-bold uppercase tracking-wider text-[10px]">Preview</span>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1 text-primary hover:underline font-semibold"
            >
              {copied ? <Check size={12} className="text-success" /> : <Copy size={12} />}
              <span>{copied ? 'Copied!' : 'Copy to Clipboard'}</span>
            </button>
          </div>
          <pre className="p-3.5 rounded-xl bg-surface-2 border border-border text-xs text-text-2 max-h-48 overflow-y-auto font-mono whitespace-pre-wrap select-all">
            {getContent().slice(0, 1500)}
            {getContent().length > 1500 ? '\n\n... (truncated for preview)' : ''}
          </pre>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-border">
          <Button
            variant="outline"
            size="md"
            leftIcon={<Printer size={15} />}
            onClick={handlePrint}
            className="w-full sm:w-auto"
          >
            Print / PDF View
          </Button>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button variant="secondary" size="md" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              leftIcon={<Download size={15} />}
              onClick={handleDownload}
            >
              Download File
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
