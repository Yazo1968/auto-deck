
import React from 'react';
import Header from './Header';
import FileUpload from './FileUpload';
import FileList from './FileList';
import { UploadedFile } from '../types';

interface UploadViewProps {
  files: UploadedFile[];
  selectedFileId: string | null;
  onFilesSelected: (files: FileList | null) => void;
  onRemoveFile: (id: string) => void;
  onSelectFile: (id: string) => void;
}

export const UploadView: React.FC<UploadViewProps> = ({
  files, selectedFileId,
  onFilesSelected, onRemoveFile, onSelectFile,
}) => {
  return (
    <div className="flex flex-col items-center px-6 py-12 md:py-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="w-full max-w-2xl space-y-16">
        <Header />
        <main className="space-y-12">
          <section className="space-y-4">
            <h2 className="text-sm font-medium uppercase tracking-widest text-zinc-600">Source</h2>
            <FileUpload onFilesSelected={onFilesSelected} />
          </section>
          {files.length > 0 && (
            <section className="space-y-4">
              <FileList
                files={files}
                onRemove={onRemoveFile}
                selectedId={selectedFileId}
                onSelect={onSelectFile}
              />
            </section>
          )}
        </main>
      </div>
    </div>
  );
};
