import React, { useEffect, useState, useRef } from 'react';
import { gapi } from 'gapi-script';
import { getSetting, saveSetting } from '../services/supabaseService';

import { initGapi, API_KEY, CLIENT_ID } from '../services/googleDriveService';

// Array of API discovery doc URLs for APIs
const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];

interface GoogleDriveProps {
    onClose: () => void;
    onSelectFile?: (link: string) => void;
    onSyncImages?: (mappings: Record<string, string>, printNames?: Record<string, string>) => Promise<void>;
}

interface DriveFile {
    id: string;
    name: string;
    thumbnailLink?: string;
    webViewLink?: string;
    mimeType: string;
    folderName?: string;
}

export const GoogleDrive: React.FC<GoogleDriveProps> = ({ onClose, onSelectFile, onSyncImages }) => {
    const [files, setFiles] = useState<DriveFile[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Folder Navigation State
    const [atualFolderId, setAtualFolderId] = useState<string>('11lPRLR2oHxhPrkg4etlNyeTawZvDBZxk');
    const [backupFolderId, setBackupFolderId] = useState<string>('1Wp9ZbBEI72wr4wjlxH9RN3zJNGmnWHxv');
    const [estampasFolderId, setEstampasFolderId] = useState<string>('');
    const [currentFolderId, setCurrentFolderId] = useState<string>('');
    const [folderName, setFolderName] = useState<string>('Estampas');
    const [isApiLoaded, setIsApiLoaded] = useState(false);
    const [isSignedIn, setIsSignedIn] = useState(false);

    // Input State for Folder ID
    const [inputFolderId, setInputFolderId] = useState('');

    // Search State
    const [searchTerm, setSearchTerm] = useState('');
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [tempAtualId, setTempAtualId] = useState('');
    const [tempBackupId, setTempBackupId] = useState('');
    const [tempEstampasId, setTempEstampasId] = useState('');
    const [isSavingSettings, setIsSavingSettings] = useState(false);

    useEffect(() => {
        const loadFolderIds = async () => {
            try {
                const savedAtual = await getSetting('googleDriveFolderId_Atual');
                const savedBackup = await getSetting('googleDriveFolderId_Backup');
                const savedEstampas = await getSetting('googleDriveFolderId_Estampas');

                if (savedAtual) {
                    setAtualFolderId(savedAtual);
                    setTempAtualId(savedAtual);
                    if (!currentFolderId) setCurrentFolderId(savedAtual);
                } else {
                    setTempAtualId(atualFolderId);
                }

                if (savedBackup) {
                    setBackupFolderId(savedBackup);
                    setTempBackupId(savedBackup);
                } else {
                    setTempBackupId(backupFolderId);
                }

                if (savedEstampas) {
                    setEstampasFolderId(savedEstampas);
                    setTempEstampasId(savedEstampas);
                } else {
                    setTempEstampasId('');
                }

                // Compatibility with old setting
                const legacyId = await getSetting('googleDriveFolderId');
                if (legacyId && !savedAtual) {
                    setAtualFolderId(legacyId);
                    setTempAtualId(legacyId);
                    if (!currentFolderId) setCurrentFolderId(legacyId);
                }
            } catch (error) {
                console.error('Error loading folder IDs from Supabase:', error);
            }
        };
        loadFolderIds();
    }, []);

    const handleSaveSettings = async () => {
        setIsSavingSettings(true);
        try {
            await saveSetting('googleDriveFolderId_Atual', tempAtualId);
            await saveSetting('googleDriveFolderId_Backup', tempBackupId);
            await saveSetting('googleDriveFolderId_Estampas', tempEstampasId);
            setAtualFolderId(tempAtualId);
            setBackupFolderId(tempBackupId);
            setEstampasFolderId(tempEstampasId);
            setIsSettingsOpen(false);
            // Reload files for the current root folder if we just changed it
            if (currentFolderId === atualFolderId || !currentFolderId) {
                setCurrentFolderId(tempAtualId);
                listFiles(tempAtualId);
            }
        } catch (err) {
            console.error('Error saving settings:', err);
            setError('Erro ao salvar configurações.');
        } finally {
            setIsSavingSettings(false);
        }
    };

    const isGapiInitialized = useRef(false);

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const { initGapi, isUserAuthenticated } = await import('../services/googleDriveService');
                await initGapi();

                // Check if user is already authenticated (from stored token)
                setIsSignedIn(isUserAuthenticated());
                setIsApiLoaded(true);
            } catch (err) {
                console.error("Erro ao carregar Drive:", err);
                setError("Falha ao carregar API do Google.");
            }
        };
        checkAuth();
    }, []);

    const handleLogin = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const { handleSignIn: signIn } = await import('../services/googleDriveService');
            const success = await signIn();
            setIsSignedIn(success);
            if (!success) {
                setError('Login cancelado ou falhou.');
            }
        } catch (err: any) {
            console.error("Login failed:", err);
            setError(`Erro ao logar: ${err.message || "Erro desconhecido"}`);
        } finally {
            setIsLoading(false);
        }
    };

    // Recursive search with depth limit
    const getAllFilesRecursive = async (currentFolderId: string, depth: number = 0, maxDepth: number = 4, parentFolderName?: string): Promise<DriveFile[]> => {
        if (depth > maxDepth) return [];

        let query = `(mimeType contains 'image/' or mimeType = 'application/vnd.google-apps.folder' or mimeType = 'application/pdf')`;
        query += ` and trashed = false`;
        query += ` and '${currentFolderId}' in parents`;

        if (searchTerm.trim()) {
            query += ` and name contains '${searchTerm}'`;
        }

        try {
            const response = await gapi.client.drive.files.list({
                'pageSize': 100,
                'fields': "files(id, name, mimeType, thumbnailLink, webViewLink, webContentLink)",
                'q': query,
                'key': API_KEY,
                'includeItemsFromAllDrives': true,
                'supportsAllDrives': true
            });

            const rawFiles = response.result.files || [];

            // Tag files with parent folder name
            const taggedFiles: DriveFile[] = rawFiles.map((f: any) => ({
                ...f,
                folderName: parentFolderName
            }));

            let allFiles: DriveFile[] = [...taggedFiles];

            // Find folders and search recursively
            const folders = rawFiles.filter((f: DriveFile) => f.mimeType === 'application/vnd.google-apps.folder');

            for (const folder of folders) {
                console.log(`📁 Searching in subfolder: ${folder.name} (depth ${depth + 1})`);
                const subFiles = await getAllFilesRecursive(folder.id, depth + 1, maxDepth, folder.name);
                allFiles = [...allFiles, ...subFiles];
            }

            return allFiles;
        } catch (err: any) {
            console.error(`Error at depth ${depth}:`, err);
            return [];
        }
    };

    const listFiles = (folderId: string) => {
        console.log("Listing files for:", folderId);
        setIsLoading(true);
        setError(null);

        if (!gapi.client.drive) {
            setError("API do Drive não carregada.");
            setIsLoading(false);
            return;
        }

        // Execute recursive search
        console.log('🚀 Starting recursive search from folder:', folderId);
        console.log('🔎 Search term:', searchTerm || '(none)');

        getAllFilesRecursive(folderId).then((allFiles) => {
            // Priority filtering: if a file name appears in both current searches (unlikely but possible if merging)
            // But since we are searching inside a SINGLE folderId here, no merging needed.
            // Merging logic would go in a higher level caller if searching multiple roots.

            console.log(`✅ FINAL RESULT: Found ${allFiles.length} total files across all subfolders`);
            setFiles(allFiles);
            setIsLoading(false);

            // Get folder name
            if (folderId === atualFolderId) setFolderName('Estampas ATUAIS (Prioridade)');
            else if (folderId === backupFolderId) setFolderName('Estampas BACKUP (Antigos)');
            else if (folderId === estampasFolderId) setFolderName('Galeria de Estampas');
            else getFolderName(folderId);

        }).catch((err: any) => {
            console.error("Error listing files", err);
            const errorMsg = err.result?.error?.message || err.message || "Erro desconhecido";
            setError(`Erro ao acessar pasta: ${errorMsg}. Verifique se a pasta é PÚBLICA.`);
            setIsLoading(false);
        });
    };

    const getFolderName = (id: string) => {
        gapi.client.drive.files.get({
            fileId: id,
            fields: 'name',
            key: API_KEY
        }).then((response: any) => {
            setFolderName(response.result.name);
        }).catch((err: any) => console.error("Error getting folder name", err));
    };

    const handleFolderClick = (id: string) => {
        setCurrentFolderId(id);
        listFiles(id);
        setSearchTerm('');
    };

    const [isSyncing, setIsSyncing] = useState(false);
    const [syncProgress, setSyncProgress] = useState(0);

    const handleSyncAll = async () => {
        if (!onSyncImages) return;
        setIsSyncing(true);
        setSyncProgress(1);
        setError(null);

        try {
            console.log("🚀 Starting Full Drive Indexing...");

            // 1. Crawl Backup
            setSyncProgress(10);
            const backupFiles = await getAllFilesRecursive(backupFolderId, 0, 10); // Higher depth for full sync

            // 2. Crawl Atual
            setSyncProgress(50);
            const atualFiles = await getAllFilesRecursive(atualFolderId, 0, 10);

            const mappings: Record<string, string> = {};
            const printNameMappings: Record<string, string> = {};

            // Helper to clean name
            const getSkuFromName = (name: string) => {
                return name.split('.')[0].trim(); // Simple: remove extension
            };

            const processFiles = (files: DriveFile[]) => {
                files.filter(f => f.mimeType.includes('image')).forEach(f => {
                    const sku = getSkuFromName(f.name);
                    if (sku) {
                        mappings[sku] = f.webViewLink || '';

                        // Extract print name from folder name
                        if (f.folderName) {
                            // Logic: Remove SKU from folder name if present, leaving the print name
                            // Example: Folder "251215D7UT2X5D AJ Motors" -> SKU "251215D7UT2X5D" -> Extract "AJ Motors"

                            // Normalize SKU for robust matching
                            const cleanSku = sku.replace(/\-/g, '').trim();

                            // Try to match SKU at start of folder name
                            // We use a looser match in case SKU in file vs folder varies slightly in separators
                            let printNameCandidate = f.folderName.trim();

                            // Check if folder starts with SKU (case insensitive)
                            if (printNameCandidate.toLowerCase().startsWith(cleanSku.toLowerCase())) {
                                printNameCandidate = printNameCandidate.substring(cleanSku.length).trim();
                            } else if (printNameCandidate.toLowerCase().startsWith(sku.toLowerCase())) {
                                printNameCandidate = printNameCandidate.substring(sku.length).trim();
                            }

                            // Clean up any leading separators/chars like "-" or "_"
                            printNameCandidate = printNameCandidate.replace(/^[\s\-_]+/, '').trim();

                            if (printNameCandidate && printNameCandidate.length > 2) {
                                printNameMappings[sku] = printNameCandidate;
                            }
                        }
                    }
                });
            };

            // Process Backup first
            processFiles(backupFiles);

            // Process Atual second (overwrites backup)
            processFiles(atualFiles);

            setSyncProgress(90);
            console.log(`✅ Indexed ${Object.keys(mappings).length} images. Sending to system...`);
            console.log(`✅ Found ${Object.keys(printNameMappings).length} print names.`);

            // @ts-ignore - Assuming onSyncImages can handle the second argument now
            await onSyncImages(mappings, printNameMappings);

            setSyncProgress(100);
            setTimeout(() => {
                setIsSyncing(false);
                setSyncProgress(0);
            }, 2000);

        } catch (err: any) {
            console.error("Sync failed:", err);
            setError("Falha na sincronização: " + (err.message || "Erro desconhecido"));
            setIsSyncing(false);
        }
    };

    const handleBackClick = () => {
        if (currentFolderId !== atualFolderId && currentFolderId !== backupFolderId) {
            // Go back to whichever root we were in (or just Atual by default)
            setCurrentFolderId(atualFolderId);
            listFiles(atualFolderId);
            setSearchTerm('');
        }
    };

    // Debounce search
    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            if (isApiLoaded && isSignedIn) {
                const targetFolder = currentFolderId || atualFolderId;
                if (targetFolder) {
                    listFiles(targetFolder);
                }
            }
        }, 500);

        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm, currentFolderId, isApiLoaded, isSignedIn, atualFolderId]);

    // Filter locally ONLY if we are NOT using the API search (which we are now).
    // Actually, since we are now doing server-side search, we should display 'files' directly.
    // But wait, if we are in "browse mode" (no search term), we might still want local filtering?
    // No, the user asked for recursive search, which implies server-side.
    // So we should rely on 'files' state being updated by listFiles.
    const filteredFiles = files; // Pass through, as filtering is done by API now.

    return (
        <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md h-full flex flex-col">
            <div className="flex justify-between items-center mb-6 flex-shrink-0">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
                    {onSelectFile ? 'Selecionar Arquivo do Drive' : 'Galeria Pública do Drive'}
                </h2>
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                        className={`p-2 rounded-full transition-colors ${isSettingsOpen ? 'bg-primary-100 text-primary-600' : 'text-gray-500 hover:bg-gray-100'}`}
                        title="Configurações de Pastas"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                    </button>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>
            {onSelectFile && !isSettingsOpen && (
                <div className="bg-blue-50 dark:bg-blue-900/30 p-2 mb-4 rounded border border-blue-200 dark:border-blue-800 text-sm text-blue-800 dark:text-blue-200">
                    Clique em um arquivo para selecioná-lo como comprovante.
                </div>
            )}

            {isSettingsOpen && (
                <div className="bg-gray-50 dark:bg-gray-900/50 p-6 mb-6 rounded-xl border border-gray-200 dark:border-gray-700 animate-slide-down">
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                        <span>⚙️</span> Configurações de Pastas do Google Drive
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <label className="block text-xs font-black text-gray-500 uppercase tracking-widest">ID Pasta: ATUAIS</label>
                            <input
                                type="text"
                                value={tempAtualId}
                                onChange={(e) => setTempAtualId(e.target.value)}
                                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500"
                                placeholder="ID da pasta"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="block text-xs font-black text-gray-500 uppercase tracking-widest">ID Pasta: BACKUP</label>
                            <input
                                type="text"
                                value={tempBackupId}
                                onChange={(e) => setTempBackupId(e.target.value)}
                                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500"
                                placeholder="ID da pasta"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="block text-xs font-black text-gray-500 uppercase tracking-widest">ID Pasta: ESTAMPAS</label>
                            <input
                                type="text"
                                value={tempEstampasId}
                                onChange={(e) => setTempEstampasId(e.target.value)}
                                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500"
                                placeholder="ID da pasta (opcional)"
                            />
                        </div>
                    </div>
                    <div className="mt-6 flex justify-end gap-3">
                        <button
                            onClick={() => setIsSettingsOpen(false)}
                            className="px-4 py-2 text-sm font-bold text-gray-600 hover:text-gray-800 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSaveSettings}
                            disabled={isSavingSettings}
                            className={`px-6 py-2 rounded-lg bg-primary-600 text-white text-sm font-black shadow-lg shadow-primary-500/20 transition-all active:scale-95 ${isSavingSettings ? 'opacity-50 cursor-not-allowed' : 'hover:bg-primary-700'}`}
                        >
                            {isSavingSettings ? 'Salvando...' : 'Salvar Configurações'}
                        </button>
                    </div>
                </div>
            )}

            {!API_KEY && (
                <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 flex-shrink-0" role="alert">
                    <p className="font-bold">Erro de Configuração</p>
                    <p>API Key não encontrada. Adicione VITE_GOOGLE_API_KEY ao seu .env.local</p>
                </div>
            )}

            {!atualFolderId && !backupFolderId ? (
                <div className="mb-6 flex-shrink-0">
                    <p className="text-gray-600 dark:text-gray-400 mb-4">Configuração inicial necessária.</p>
                </div>
            ) : (
                <div className="mb-4 space-y-3 flex-shrink-0 text-left">
                    {/* Folder Tabs / Selector */}
                    <div className="flex border-b border-gray-200 dark:border-gray-700 mb-2">
                        <button
                            onClick={() => { setCurrentFolderId(atualFolderId); listFiles(atualFolderId); }}
                            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${currentFolderId === atualFolderId ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                        >
                            ⚡ Atual (Principal)
                        </button>
                        <button
                            onClick={() => { setCurrentFolderId(backupFolderId); listFiles(backupFolderId); }}
                            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${currentFolderId === backupFolderId ? 'border-orange-500 text-orange-600 dark:text-orange-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                        >
                            📦 Backup (Antigos)
                        </button>
                        {estampasFolderId && (
                            <button
                                onClick={() => { setCurrentFolderId(estampasFolderId); listFiles(estampasFolderId); }}
                                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${currentFolderId === estampasFolderId ? 'border-purple-500 text-purple-600 dark:text-purple-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                            >
                                🎨 Estampas
                            </button>
                        )}
                    </div>
                    {/* Folder Navigation & Actions */}
                    <div className="flex flex-col gap-2">
                        {/* Status Bar */}
                        <div className="flex justify-between items-center bg-gray-50 dark:bg-gray-700/50 p-2 rounded border border-gray-200 dark:border-gray-600">
                            <div className="flex items-center gap-2 overflow-hidden">
                                <span className="text-xl">{currentFolderId === atualFolderId ? '⚡' : '📦'}</span>
                                <div className="flex flex-col min-w-0">
                                    <span className="font-bold text-gray-800 dark:text-gray-100 text-sm truncate">{folderName}</span>
                                    {currentFolderId !== atualFolderId && currentFolderId !== backupFolderId && (
                                        <button onClick={handleBackClick} className="text-xs text-blue-600 hover:underline text-left">
                                            ← Voltar à Pasta Raiz
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div className="flex gap-2 shrink-0">
                                <a
                                    href={`https://drive.google.com/drive/folders/${currentFolderId || atualFolderId}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded shadow-sm transition-colors"
                                >
                                    <span>☁️ Upload</span>
                                </a>
                                <button
                                    onClick={() => listFiles(currentFolderId || atualFolderId)}
                                    className="p-1.5 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 rounded text-gray-700 dark:text-gray-200 transition-colors"
                                    title="Atualizar Lista"
                                >
                                    🔄
                                </button>
                                {onSyncImages && (
                                    <button
                                        onClick={handleSyncAll}
                                        disabled={isSyncing}
                                        className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs font-bold transition-all ${isSyncing ? 'bg-gray-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'}`}
                                    >
                                        {isSyncing ? `⌛ Indexando ${syncProgress}%...` : '⚡ Indexar Tudo no Sistema'}
                                    </button>
                                )}
                            </div>
                        </div>

                    </div>

                    {/* Search Bar */}
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <svg className="h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Pesquisar arquivo..."
                            className="block w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                </div>
            )}

            {error && <p className="text-red-500 mb-4 flex-shrink-0 text-sm">{error}</p>}

            {!isSignedIn && isApiLoaded && (
                <div className="flex-grow flex flex-col items-center justify-center p-8 bg-gray-50 dark:bg-gray-900/30 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                    <div className="bg-blue-100 dark:bg-blue-900/50 p-4 rounded-full mb-4">
                        <svg className="h-12 w-12 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-2">Conecte sua conta</h3>
                    <p className="text-gray-600 dark:text-gray-400 text-sm text-center mb-6 max-w-xs">
                        Para visualizar e sincronizar imagens das estampas, você precisa autorizar o acesso ao seu Google Drive.
                    </p>
                    <button
                        onClick={handleLogin}
                        className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-lg shadow-lg shadow-blue-500/30 transition-all active:scale-95 flex items-center gap-2"
                    >
                        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12.545 11v2.422h5.658c-.194 1.247-.992 2.301-2.274 3.12l2.014 1.56c1.154-1.077 1.903-2.67 1.903-4.492a7.09 7.09 0 00-.15-1.45L12.545 11z" />
                            <path d="M12.545 11H12V3c-4.97 0-9 4.03-9 9s4.03 9 9 9c3.904 0 7.26-2.482 8.525-5.92l-2.014-1.56C17.65 15.535 15.297 17 12.545 17c-2.76 0-5-2.24-5-5s2.24-5 5-5c1.455 0 2.77.62 3.69 1.61L18.42 6.78A8.991 8.991 0 0012.545 3V11z" />
                        </svg>
                        Conectar com Google
                    </button>
                    <p className="mt-4 text-[10px] text-gray-500 uppercase tracking-tighter">🔒 Conexão Segura e Oficial</p>
                </div>
            )}

            {isLoading ? (
                <div className="flex justify-center p-8 flex-grow">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 overflow-y-auto flex-grow p-1">
                    {filteredFiles.map(file => (
                        <div key={file.id} className="border dark:border-gray-700 rounded p-2 hover:shadow-lg transition-shadow bg-gray-50 dark:bg-gray-900 relative group">
                            <div
                                className={`cursor-pointer ${onSelectFile ? 'ring-2 ring-transparent hover:ring-primary-500' : ''}`}
                                onClick={() => {
                                    if (file.mimeType === 'application/vnd.google-apps.folder') {
                                        handleFolderClick(file.id);
                                    } else if (onSelectFile) {
                                        onSelectFile(file.webViewLink || file.webContentLink || '');
                                    } else {
                                        window.open(file.webViewLink, '_blank');
                                    }
                                }}
                            >
                                {file.thumbnailLink ? (
                                    <img src={file.thumbnailLink} alt={file.name} className="w-full h-32 object-cover rounded mb-2" />
                                ) : file.mimeType === 'application/vnd.google-apps.folder' ? (
                                    <div className="w-full h-32 bg-blue-100 dark:bg-blue-900 flex items-center justify-center rounded mb-2 text-blue-500">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                        </svg>
                                    </div>
                                ) : (
                                    <div className="w-full h-32 bg-gray-200 dark:bg-gray-700 flex items-center justify-center rounded mb-2 text-gray-400">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                        </svg>
                                    </div>
                                )}
                                <p className="text-sm truncate text-gray-700 dark:text-gray-300" title={file.name}>{file.name}</p>
                            </div>

                            {/* Download Button */}
                            {file.mimeType !== 'application/vnd.google-apps.folder' && (
                                <a
                                    href={file.webContentLink || file.webViewLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="absolute top-2 right-2 p-1.5 bg-white dark:bg-gray-800 rounded-full shadow-md text-gray-600 dark:text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity hover:text-blue-600 dark:hover:text-blue-400"
                                    title="Download"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4-4m0 0l-4 4m4-4v12" />
                                    </svg>
                                </a>
                            )}
                        </div>
                    ))}
                    {filteredFiles.length === 0 && !isLoading && (
                        <p className="col-span-full text-center text-gray-500">
                            {searchTerm ? 'Nenhum arquivo encontrado para a pesquisa.' : 'Nenhum arquivo encontrado nesta pasta.'}
                        </p>
                    )}
                </div>
            )}
        </div>
    );
};
