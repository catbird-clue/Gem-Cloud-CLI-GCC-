import React, { useRef, useMemo, useState } from 'react';
import type { UploadedFile, FileTreeNode, TreeNodeValue, GeminiModel } from '../types';
import { UploadIcon, FolderIcon, FileIcon, TrashIcon, DownloadIcon, EyeIcon, SummaryIcon, MemoryIcon } from './Icons';

interface FileExplorerProps {
  files: UploadedFile[];
  modifiedFiles: Record<string, number>;
  model: GeminiModel;
  isLoading: boolean;
  onFileUpload: (files: FileList | null) => void;
  onViewFile: (file: UploadedFile) => void;
  onViewDiff: (file: UploadedFile) => void;
  onAddChatMessage: (message: string) => void;
  onAcknowledgeFileChange: (filePath: string) => void;
  onGenerateContext: () => void;
  onEditMemory: () => void;
}

interface FileTreeProps {
  node: FileTreeNode;
  modifiedFiles: Record<string, number>;
  onDownloadFile: (file: UploadedFile) => void;
  onViewFile: (file: UploadedFile) => void;
  onViewDiff: (file: UploadedFile) => void;
  level?: number;
}

const MEMORY_FILE_PATH = 'AI_Memory/long_term_memory.md';

/**
 * Builds a file system tree structure from a flat list of files.
 * This function is designed to be robust against path conflicts.
 * For example, if it processes a file path 'docs' and later encounters 'docs/getting-started.md',
 * it will correctly treat 'docs' as a folder, ensuring the tree is valid.
 * Folders always take precedence over files with the same name in the path.
 */
const buildFileTree = (files: UploadedFile[]): FileTreeNode => {
  const tree: FileTreeNode = {};

  files.forEach(file => {
    const parts = file.path.split('/');
    let currentLevel = tree;

    parts.forEach((part, idx) => {
      const isLastPart = idx === parts.length - 1;
      const existingNode = currentLevel[part];

      // If node doesn't exist, create a new file or folder node.
      if (!existingNode) {
        if (isLastPart) {
          currentLevel[part] = { type: 'file', file };
        } else {
          currentLevel[part] = { type: 'folder', children: {} };
        }
      } else {
        // If node exists, handle potential conflicts.
        if (!isLastPart && existingNode.type === 'file') {
          // Conflict: A file exists where a directory is needed.
          // Promote the file node to a folder node to allow children to be added.
          currentLevel[part] = { type: 'folder', children: {} };
        }
        // if a folder exists where a file should be, we prioritize the folder structure and ignore the file.
        else if (isLastPart && existingNode.type === 'folder') {
            return; // Skip, folder has priority.
        }
        else if (isLastPart && existingNode.type === 'file') {
            // Overwrite existing file with new content if paths are identical.
            currentLevel[part] = { type: 'file', file: file };
        }
      }

      // Descend into the next level if the current part is a folder.
      const node = currentLevel[part];
      if (!isLastPart && node?.type === 'folder') {
        currentLevel = node.children as FileTreeNode;
      }
    });
  });

  return tree;
};


const FileTree = ({ node, modifiedFiles, onDownloadFile, onViewFile, onViewDiff, level = 0 }: FileTreeProps): React.ReactElement => {
  return (
    <div>
      {(Object.entries(node) as [string, TreeNodeValue][])
        .sort(([aName, aValue], [bName, bValue]) => {
          if (aValue.type === 'folder' && bValue.type === 'file') return -1;
          if (aValue.type === 'file' && bValue.type === 'folder') return 1;
          return aName.localeCompare(bName);
        })
        .map(([name, value]) => {
          if (value.type === 'file' && value.file) {
            const file = value.file;
            const modificationCount = modifiedFiles[file.path] || 0;
            const isModified = modificationCount > 0;
            
            const handleFileClick = () => {
              if (isModified) {
                onViewDiff(file);
              } else {
                onViewFile(file);
              }
            };

            let displayName = name;
            let displayIcon = <FileIcon className="w-4 h-4 mr-2 flex-shrink-0" />;

            if (file.path === MEMORY_FILE_PATH) {
              displayName = 'Memory';
              displayIcon = <MemoryIcon className="w-4 h-4 mr-2 flex-shrink-0 text-indigo-400" />;
            }
            
            return (
              <div key={name} style={{ paddingLeft: `${level * 1}rem` }}>
                <div 
                  className="group flex items-center justify-between p-1 text-sm hover:bg-gray-700 rounded-md"
                  onClick={handleFileClick}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleFileClick()}
                  title={isModified ? `Click to review changes for ${displayName}` : `Click to view ${displayName}`}
                >
                  <div className="flex items-center truncate">
                    {displayIcon}
                    <span className={`truncate ${isModified ? 'text-green-400 font-medium cursor-pointer' : 'text-gray-400 cursor-default'}`}>
                      {displayName}
                    </span>
                    {isModified && (
                      <span className="ml-2 bg-green-800/50 text-green-300 text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center flex-shrink-0">
                        {modificationCount}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => { e.stopPropagation(); onViewFile(file); }}
                      className="p-1 text-gray-400 hover:text-indigo-400"
                      title={`View current version of ${displayName}`}
                      aria-label={`View current version of ${displayName}`}
                    >
                      <EyeIcon className="w-4 h-4" />
                    </button>
                    {isModified && (
                       <button
                        onClick={(e) => { e.stopPropagation(); onDownloadFile(file); }}
                        className="p-1 text-gray-400 hover:text-indigo-400"
                        title={`Download ${displayName}`}
                        aria-label={`Download ${displayName}`}
                      >
                        <DownloadIcon className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          } else {
             const folderDisplayName = name === 'AI_Memory' ? 'AI' : name;
             return (
              <div key={name} style={{ paddingLeft: `${level * 1}rem` }}>
                <div>
                  <div className="flex items-center p-1 text-sm text-gray-300 font-medium hover:bg-gray-700 rounded-md cursor-default">
                    <FolderIcon className="w-4 h-4 mr-2 flex-shrink-0" />
                    <span className="truncate">{folderDisplayName}</span>
                  </div>
                  {value.children && <FileTree node={value.children} level={level + 1} modifiedFiles={modifiedFiles} onDownloadFile={onDownloadFile} onViewFile={onViewFile} onViewDiff={onViewDiff} />}
                </div>
              </div>
            )
          }
        })}
    </div>
  );
};

export const FileExplorer = (props: FileExplorerProps): React.ReactElement => {
  const { 
    files, modifiedFiles, model, isLoading,
    onFileUpload, onViewFile, onViewDiff, onAddChatMessage, 
    onAcknowledgeFileChange, onGenerateContext, onEditMemory
  } = props;
  
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileTree = useMemo(() => buildFileTree(files || []), [files]);

  const handleButtonClick = () => {
    inputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFileUpload(e.target.files);
    e.target.value = ''; // Reset input to allow re-uploading the same folder
  };
  
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };
  
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };
  
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onAddChatMessage("For the best results, including full project structure, please use the 'Upload Project' button instead of dragging and dropping.");
      onFileUpload(e.dataTransfer.files);
    }
  };

  const handleDownloadFile = (file: UploadedFile) => {
    const blob = new Blob([file.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const fileName = file.path.split('/').pop() || 'download.txt';
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    onAcknowledgeFileChange(file.path);
  };

  const hasFiles = files.length > 0;

  return (
    <div 
      className={`w-1/4 max-w-xs flex flex-col bg-gray-800 border-r border-gray-700/50 transition-colors duration-200 ${isDragging ? 'bg-indigo-900/20' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="p-4 flex flex-col space-y-4 border-b border-gray-700/50">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-200">File Explorer</h2>
          <div className="flex items-center space-x-1">
            <button
              onClick={onEditMemory}
              className="p-2 text-gray-400 hover:text-indigo-400 hover:bg-gray-700 rounded-md transition-colors"
              title="Edit Memory"
              aria-label="Edit Memory"
            >
              <MemoryIcon className="w-5 h-5" />
            </button>
             <button
              onClick={onGenerateContext}
              disabled={isLoading || !hasFiles}
              className="p-2 text-gray-400 hover:text-indigo-400 hover:bg-gray-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title={hasFiles ? "Generate Context" : "Upload files to generate Context"}
              aria-label="Generate Context"
            >
              <SummaryIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        <div className="space-y-1">
          <span className="block text-xs font-medium text-gray-400">
            AI Model
          </span>
          <div className="w-full bg-gray-700/50 border border-gray-600/50 text-gray-300 text-sm rounded-md p-2 font-mono">
            {model}
          </div>
        </div>
      </div>

      <div className="flex-1 p-2 overflow-y-auto">
        {hasFiles ? (
          <FileTree node={fileTree} modifiedFiles={modifiedFiles} onDownloadFile={handleDownloadFile} onViewFile={onViewFile} onViewDiff={onViewDiff} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 p-4">
            <UploadIcon className="w-12 h-12 mb-4" />
            <p className="text-sm">
              Upload a project folder to get started.
            </p>
          </div>
        )}
      </div>
      <div className="p-4 border-t border-gray-700/50">
        <input
          type="file"
          ref={inputRef}
          onChange={handleFileChange}
          className="hidden"
          // @ts-ignore - 'directory' and 'webkitdirectory' are non-standard attributes for folder uploads.
          webkitdirectory="true"
          directory="true"
        />
        <button
          onClick={handleButtonClick}
          className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 px-4 rounded-md transition-all duration-200 flex items-center justify-center"
        >
          <UploadIcon className="w-5 h-5 mr-2" />
          {hasFiles ? 'Add/Update Folder' : 'Upload Project Folder'}
        </button>
      </div>
    </div>
  );
};
