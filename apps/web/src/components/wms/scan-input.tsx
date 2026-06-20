import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

export interface ScanInputHandle {
  focus: () => void;
  clear: () => void;
}

interface ScanInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onScan: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
}

export const ScanInput = forwardRef<ScanInputHandle, ScanInputProps>(
  function ScanInput(
    {
      id,
      label,
      value,
      onChange,
      onScan,
      placeholder,
      autoFocus,
      className,
    },
    ref,
  ) {
    const inputRef = useRef<HTMLInputElement>(null);

    useImperativeHandle(ref, () => ({
      focus: () => inputRef.current?.focus(),
      clear: () => onChange(''),
    }));

    useEffect(() => {
      if (autoFocus) {
        inputRef.current?.focus();
      }
    }, [autoFocus]);

    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
      if (e.key === 'Enter') {
        e.preventDefault();
        const scanned = value.trim();
        if (scanned) {
          onScan(scanned);
        }
      }
    }

    return (
      <div className={className}>
        <Label htmlFor={id} className="text-base">
          {label}
        </Label>
        <Input
          id={id}
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="mt-2 h-14 text-lg"
          autoComplete="off"
          inputMode="text"
        />
      </div>
    );
  },
);
