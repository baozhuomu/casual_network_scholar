import React, { useCallback, useRef } from 'react';
import { Paper } from '../types';
import { UploadIcon } from './icons/UploadIcon';
import ProgressBar from './ProgressBar';

interface FileUploadPanelProps {
  papers: Paper[];
  onFileChange: (files: FileList | null) => void;
  onRemovePaper: (id: string) => void;
  onAnalyze: () => void;
  isLoading: boolean;
  error: string | null;
  isCollapsed: boolean;
}

const FileStatusItem: React.FC<{ paper: Paper; onRemove: () => void; }> = ({ paper, onRemove }) => {
  const getStatusInfo = () => {
    switch(paper.status) {
      case 'parsing':
        return <div className="flex items-center gap-2 text-xs text-blue-500"><svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> 解析中...</div>;
      case 'ocr':
        return (
          <div className="w-full text-xs text-purple-500">
            <div className="flex items-center gap-2 mb-1">
              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              <span>{paper.message || 'OCR识别中...'}</span>
            </div>
            {typeof paper.progress === 'number' && paper.progress > 0 && <ProgressBar progress={paper.progress} />}
          </div>
        );
      case 'ready':
        return <div className="flex items-center gap-1 text-xs text-green-500"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> 准备就绪</div>;
      case 'error':
        return <div className="flex items-center gap-1 text-xs text-red-500" title={paper.message}><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> 错误</div>;
      default:
        return null;
    }
  };

  return (
    <div className="group flex items-center justify-between p-2 bg-gray-100 dark:bg-gray-700 rounded-md animate-fade-in">
      <div className="flex-grow truncate pr-2 min-w-0">
        <p className="text-sm font-medium truncate" title={paper.name}>{paper.name}</p>
        <div className="mt-1">{getStatusInfo()}</div>
      </div>
      <button onClick={onRemove} className="flex-shrink-0 opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 dark:hover:text-red-400 rounded-full transition-opacity">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
      </button>
    </div>
  );
};


const FileUploadPanel: React.FC<FileUploadPanelProps> = ({ papers, onFileChange, onRemovePaper, onAnalyze, isLoading, error, isCollapsed }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFileChange(e.dataTransfer.files);
    }
  }, [onFileChange]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFileChange(e.target.files);
    if (e.target) {
        e.target.value = '';
    }
  };

  const triggerFileSelect = () => {
    if (!isLoading) {
      fileInputRef.current?.click();
    }
  };

  if (isCollapsed) {
    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 h-full flex flex-col">
            <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
                <UploadIcon className="w-5 h-5" />
                已上传文献
            </h2>
            <div className="overflow-y-auto flex-grow">
                <ul className="space-y-2">
                {papers.map((paper) => (
                    <li key={paper.id} className="text-sm p-2 bg-gray-100 dark:bg-gray-700 rounded truncate" title={paper.name}>
                       {paper.status === 'ready' && <span className="text-green-500 mr-2">✔</span>}
                       {paper.status === 'error' && <span className="text-red-500 mr-2">✖</span>}
                       {paper.status === 'parsing' && <span className="text-blue-500 mr-2">…</span>}
                       {paper.status === 'ocr' && <span className="text-purple-500 mr-2">…</span>}
                       {paper.name}
                    </li>
                ))}
                </ul>
            </div>
        </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 h-full flex flex-col">
      <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-white">1. 上传文献</h2>
      <p className="mb-6 text-gray-500 dark:text-gray-400">
        拖拽或选择您的学术论文。支持 PDF、DOCX 和 TXT 格式。最多 100 份文件。
      </p>

      <div 
        className="flex-grow flex flex-col"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <div 
          onClick={triggerFileSelect}
          className={`flex-shrink-0 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center transition-colors ${!isLoading ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50' : 'opacity-50'}`}
        >
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileSelect} 
            multiple 
            accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
            className="hidden"
            disabled={isLoading || papers.length >= 100}
          />
          <UploadIcon className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-500" />
          <p className="mt-4 font-semibold text-gray-600 dark:text-gray-300">将文件拖拽至此</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">或点击浏览</p>
          {papers.length >= 100 && <p className="text-xs text-yellow-500 mt-2">已达到 100 份文件上限。</p>}
        </div>

        <div className="mt-4 space-y-2 overflow-y-auto flex-grow pr-2 min-h-24">
          {papers.map((paper) => (
            <FileStatusItem key={paper.id} paper={paper} onRemove={() => onRemovePaper(paper.id)} />
          ))}
        </div>
      </div>

      <div className="mt-6 flex flex-col sm:flex-row items-center gap-4">
        <button
          onClick={onAnalyze}
          disabled={isLoading || papers.filter(p => p.status === 'ready').length === 0}
          className="w-full bg-primary-600 text-white px-6 py-3 rounded-md font-semibold hover:bg-primary-700 disabled:bg-primary-400 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
        >
          {isLoading ? (
            <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                分析中...
            </>
          ) : `分析 ${papers.filter(p => p.status === 'ready').length} 份文献并构建图谱`}
        </button>
      </div>
      {error && <p className="mt-4 text-sm text-red-500 dark:text-red-400">{error}</p>}
    </div>
  );
};

export default FileUploadPanel;