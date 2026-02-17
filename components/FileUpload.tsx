import React, { useRef, useState } from 'react';

interface FileUploadProps {
  onFilesSelected: (files: FileList) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFilesSelected }) => {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFilesSelected(e.dataTransfer.files);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFilesSelected(e.target.files);
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
        relative group cursor-pointer
        border-[0.5px] border-zinc-100 rounded-3xl p-12
        flex flex-col items-center justify-center space-y-6
        transition-all duration-500 ease-out
        ${isDragging ? 'bg-[#ccff0005] border-[#ccff0066] scale-[0.99]' : 'bg-white hover:border-zinc-200'}
      `}
      onClick={() => inputRef.current?.click()}
    >
      <input
        type="file"
        ref={inputRef}
        onChange={handleInputChange}
        className="hidden"
        multiple={false}
        accept=".md,.pdf,.docx"
      />
      
      <div className={`
        w-16 h-16 rounded-full border border-zinc-100 
        flex items-center justify-center
        transition-all duration-500
        ${isDragging ? 'bg-acid-lime border-acid-lime scale-110' : 'bg-zinc-50 group-hover:bg-white'}
      `}>
        <svg 
          width="20" height="20" viewBox="0 0 24 24" fill="none" 
          stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
          className={isDragging ? 'text-black' : 'text-zinc-500'}
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
      </div>

      <div className="text-center">
        <p className="text-zinc-900 font-medium text-lg">
          {isDragging ? 'Drop to upload' : 'Add document'}
        </p>
        <p className="text-zinc-600 text-sm font-light mt-1">
          Drag and drop or click to browse
        </p>
      </div>

      {/* Decorative accent */}
      <div className={`
        absolute bottom-0 left-1/2 -translate-x-1/2 h-1 bg-acid-lime 
        transition-all duration-700 rounded-full
        ${isDragging ? 'w-1/2 opacity-100' : 'w-0 opacity-0'}
      `} />
    </div>
  );
};

export default FileUpload;