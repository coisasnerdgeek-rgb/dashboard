import * as React from 'react';

interface FileUploadProps {
  onFileUpload: (files: FileList) => void;
  isDataLoaded: boolean;
  files: { name: string, importDate: string }[];
  onClearData: () => void;
  onRemoveFile: (fileName: string) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileUpload, isDataLoaded, files, onClearData, onRemoveFile }) => {
  const [isDragging, setIsDragging] = React.useState(false);

  const handleDragEnter = React.useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = React.useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = React.useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = React.useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFileUpload(e.dataTransfer.files);
    }
  }, [onFileUpload]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileUpload(e.target.files);
      // Reset input value to allow re-uploading the same file
      e.target.value = '';
    }
  };

  return (
    <div className="p-8 lg:p-12 text-center">
      {isDataLoaded && (
        <div className="mb-10 p-6 bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-600 rounded-lg max-w-4xl mx-auto text-left">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h3 className="text-lg font-bold text-green-800 dark:text-green-200">Planilhas Carregadas</h3>
                     <div className="mt-2 space-y-2">
                        {files.map(file => (
                            <div key={file.name} className="flex items-center justify-between gap-2 p-2 bg-green-100 dark:bg-green-800/30 rounded-md">
                                <div className="flex items-center gap-2 min-w-0">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-600 dark:text-green-300 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                                    </svg>
                                    <div className="flex flex-col min-w-0">
                                      <span className="text-sm text-gray-700 dark:text-gray-300 truncate font-mono" title={file.name}>{file.name}</span>
                                      <span className="text-xs text-gray-500 dark:text-gray-400 font-sans">{new Date(file.importDate).toLocaleString('pt-BR')}</span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => onRemoveFile(file.name)}
                                    className="flex-shrink-0 p-1.5 text-red-500 rounded-full hover:bg-red-100 dark:hover:bg-red-900/50"
                                    aria-label={`Remover ${file.name}`}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                    </svg>
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
                <button 
                    onClick={onClearData}
                    className="flex-shrink-0 inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-colors"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" />
                    </svg>
                    Limpar Todos os Dados
                </button>
            </div>
        </div>
      )}
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`relative block w-full rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 p-12 text-center hover:border-gray-400 dark:hover:border-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors duration-300 ${isDragging ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : ''}`}
      >
        <svg className="mx-auto h-16 w-16 text-gray-400 dark:text-gray-500" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
            <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <h2 className="mt-4 text-2xl font-bold tracking-tight text-gray-800 dark:text-gray-200">{isDataLoaded ? 'Adicionar Mais Planilhas' : 'Comece enviando suas planilhas'}</h2>
        <p className="mt-2 block text-md text-gray-500 dark:text-gray-400">
          Arraste e solte <span className="font-semibold text-primary-600 dark:text-primary-400">arquivos XLSX</span> aqui, ou clique para selecionar.
        </p>
        <label htmlFor="file-upload" className="relative cursor-pointer mt-6 inline-flex items-center rounded-md bg-primary-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 focus-within:outline-none focus-within:ring-2 focus-within:ring-primary-500 focus-within:ring-offset-2">
            <span>Selecionar Arquivos</span>
            <input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={handleFileChange} accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" multiple />
        </label>
      </div>
    </div>
  );
};

export default FileUpload;