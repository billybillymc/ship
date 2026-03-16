import { cn } from '@/lib/cn';
import type { ConvertibleDocumentType } from '@ship/shared';

interface DocumentTypeSelectorProps {
  value: ConvertibleDocumentType;
  onChange: (type: ConvertibleDocumentType) => void;
  disabled?: boolean;
  /**
   * Document types that should be disabled (e.g., when conversion is restricted)
   */
  disabledTypes?: ConvertibleDocumentType[];
}

const TYPE_OPTIONS: { value: ConvertibleDocumentType; label: string; icon: React.ReactNode }[] = [
  { value: 'issue', label: 'Issue', icon: <IssueIcon /> },
  { value: 'project', label: 'Project', icon: <ProjectIcon /> },
];

export function DocumentTypeSelector({
  value,
  onChange,
  disabled = false,
  disabledTypes = [],
}: DocumentTypeSelectorProps) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-muted">Type</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as ConvertibleDocumentType)}
        disabled={disabled}
        aria-label="Document type"
        className={cn(
          'w-full rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground',
          'focus:border-accent focus:outline-none',
          'disabled:cursor-not-allowed disabled:opacity-50'
        )}
      >
        {TYPE_OPTIONS.map((opt) => (
          <option
            key={opt.value}
            value={opt.value}
            disabled={disabledTypes.includes(opt.value)}
          >
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * Get fields that are required for a specific document type
 */
export function getRequiredFieldsForType(type: ConvertibleDocumentType): string[] {
  switch (type) {
    case 'issue':
      return ['state', 'priority'];
    case 'project':
      return ['impact', 'confidence', 'ease'];
    default:
      return [];
  }
}

/**
 * Check which required fields are missing for a document type
 */
export function getMissingRequiredFields(
  type: ConvertibleDocumentType,
  properties: Record<string, unknown>
): string[] {
  const required = getRequiredFieldsForType(type);
  return required.filter((field) => {
    const value = properties[field];
    return value === undefined || value === null || value === '';
  });
}

// Icons
function IssueIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  );
}

function ProjectIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  );
}
