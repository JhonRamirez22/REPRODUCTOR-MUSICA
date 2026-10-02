import { useRef } from 'react';
import { Icon } from './Icon.js';

interface LocalFilesButtonProps {
  onSelectFiles: (files: File[]) => void;
  className?: string;
  describedBy?: string;
  label?: string;
}

export function LocalFilesButton({
  onSelectFiles,
  className = 'button button-quiet',
  describedBy,
  label = 'Archivos locales',
}: LocalFilesButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        ref={inputRef}
        className="local-files-input"
        type="file"
        accept="audio/*,.mp3,.ogg,.oga,.wav,.m4a,.aac,.flac,.opus"
        multiple
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          const files = Array.from(event.currentTarget.files ?? []);
          event.currentTarget.value = '';
          if (files.length > 0) onSelectFiles(files);
        }}
      />
      <button
        className={className}
        type="button"
        aria-label="Elegir archivos locales de audio"
        aria-describedby={describedBy}
        onClick={() => inputRef.current?.click()}
      >
        <Icon name="music" size={17} />
        <span>{label}</span>
      </button>
    </>
  );
}
