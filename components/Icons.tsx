import React from 'react';

type IconProps = {
  className?: string;
};

export const UploadIcon = ({ className }: IconProps): React.ReactElement => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
  </svg>
);

export const SendIcon = ({ className }: IconProps): React.ReactElement => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
    <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
  </svg>
);

export const FileIcon = ({ className }: IconProps): React.ReactElement => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
  </svg>
);

export const FolderIcon = ({ className }: IconProps): React.ReactElement => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
  </svg>
);

export const CopyIcon = ({ className }: IconProps): React.ReactElement => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
);

export const CheckIcon = ({ className }: IconProps): React.ReactElement => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

export const GeminiIcon = ({ className }: IconProps): React.ReactElement => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
    </svg>
);

export const TrashIcon = ({ className }: IconProps): React.ReactElement => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

export const MemoryIcon = ({ className }: IconProps): React.ReactElement => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-1.043 1.118-1.212.558-.17 1.148.09 1.483.562l.159.24a.87.87 0 001.246.398l.22-.12a1.06 1.06 0 011.302.48l.159.24a.87.87 0 001.246.398l.22-.12a1.06 1.06 0 011.302.48l.159.24a.87.87 0 001.246.398l.22-.12a1.06 1.06 0 011.302.48l.159.24a.87.87 0 001.246.398l.22-.12a1.06 1.06 0 011.302.48" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 12a2.25 2.25 0 00-2.25-2.25c-1.334 0-2.433 1.25-2.25 2.5 1.191.04 1.45.143 1.875.333a2.492 2.492 0 001.5.333c.313 0 .522-.053.625-.111" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.846 4.41a1.06 1.06 0 011.302.48l.159.24a.87.87 0 001.246.398l.22-.12a1.06 1.06 0 011.302.48l.159.24a.87.87 0 001.246.398l.22-.12a1.06 1.06 0 011.302.48l.159.24a.87.87 0 001.246.398l.22-.12a1.06 1.06 0 011.302.48l.159.24a.87.87 0 001.246.398" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.154 8.59a1.06 1.06 0 01-1.302.48l-.22-.12a.87.87 0 00-1.246.398l-.159.24a1.06 1.06 0 01-1.302.48l-.22-.12a.87.87 0 00-1.246.398l-.159.24a1.06 1.06 0 01-1.302.48l-.22-.12a.87.87 0 00-1.246.398l-.159.24a1.06 1.06 0 01-1.302.48" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.846 13.41a1.06 1.06 0 011.302.48l.159.24a.87.87 0 001.246.398l.22-.12a1.06 1.06 0 011.302.48l.159.24a.87.87 0 001.246.398l.22-.12a1.06 1.06 0 011.302.48l.159.24a.87.87 0 001.246.398l.22-.12a1.06 1.06 0 011.302.48l.159.24a.87.87 0 001.246.398" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 12a9 9 0 1118 0 9 9 0 01-18 0z" />
  </svg>
);

export const ExportIcon = ({ className }: IconProps): React.ReactElement => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
);

export const DownloadIcon = ({ className }: IconProps): React.ReactElement => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
);

export const StopIcon = ({ className }: IconProps): React.ReactElement => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24">
    <path d="M6 6h12v12H6z" />
  </svg>
);

export const ChevronDownIcon = ({ className }: IconProps): React.ReactElement => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
);

export const ChevronUpIcon = ({ className }: IconProps): React.ReactElement => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
  </svg>
);

export const EyeIcon = ({ className }: IconProps): React.ReactElement => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);

export const SaveIcon = ({ className }: IconProps): React.ReactElement => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 3.75H4.5a1.5 1.5 0 00-1.5 1.5v13.5a1.5 1.5 0 001.5 1.5h15a1.5 1.5 0 001.5-1.5V5.25a1.5 1.5 0 00-1.5-1.5H15M9 3.75V2.25a1.5 1.5 0 011.5-1.5h3a1.5 1.5 0 011.5 1.5V3.75m-7.5 11.25l3-3m0 0l3 3m-3-3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
  </svg>
);

export const ThoughtIcon = ({ className }: IconProps): React.ReactElement => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.184m-1.5.184a6.01 6.01 0 01-1.5-.184m1.5.184A2.25 2.25 0 0113.5 12H11a2.25 2.25 0 01-2.25-2.25V6.75A2.25 2.25 0 0111 4.5h2a2.25 2.25 0 012.25 2.25v.75M12 18h.008v.008H12v-.008z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25A5.25 5.25 0 0014.25 9h-4.5A5.25 5.25 0 004.5 14.25v.75c0 1.954 1.255 3.658 3 4.5v-2.25c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125v2.25c1.745-.842 3-2.546 3-4.5v-.75z" />
    </svg>
);

export const WarningIcon = ({ className }: IconProps): React.ReactElement => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);

export const PaperclipIcon = ({ className }: IconProps): React.ReactElement => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.122 2.122l7.81-7.81" />
  </svg>
);

export const CloseIcon = ({ className }: IconProps): React.ReactElement => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

export const SummaryIcon = ({ className }: IconProps): React.ReactElement => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);