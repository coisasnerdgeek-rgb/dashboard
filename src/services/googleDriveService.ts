import { gapi } from 'gapi-script';
import toast from 'react-hot-toast';
import { DriveImage } from '../Dashboard/types';

// Credentials
export const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY || 'AIzaSyCpFDphRkLzPbj7AA_d7vigRqapcFjj8EA';
export const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '886094348101-rvklqj6jmtflse5bjf87ig09gqlsca8l.apps.googleusercontent.com';
const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];
const SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly';

// State
let isGapiLoaded = false;
let accessToken: string | null = null;
let tokenClient: any = null;
let signInCallback: ((success: boolean) => void) | null = null;

// Debug Environment
console.log('[Drive Service] Config:', {
    apiKeyLength: API_KEY?.length,
    clientIdPrefix: CLIENT_ID?.substring(0, 15) + '...',
    isDev: import.meta.env.DEV
});

// Load GAPI client (for Drive API calls)
const loadGapiClient = (): Promise<void> => {
    return new Promise((resolve, reject) => {
        if (isGapiLoaded) {
            resolve();
            return;
        }

        const checkGapi = () => {
            if (typeof gapi !== 'undefined' && gapi.load) {
                gapi.load('client', async () => {
                    try {
                        await gapi.client.init({
                            apiKey: API_KEY,
                            discoveryDocs: DISCOVERY_DOCS,
                        });
                        isGapiLoaded = true;
                        console.log('[Drive] GAPI Client loaded successfully');
                        resolve();
                    } catch (err) {
                        console.error('[Drive] Error loading GAPI client:', err);
                        reject(err);
                    }
                });
            } else {
                setTimeout(checkGapi, 100);
            }
        };
        checkGapi();
    });
};

// Initialize GIS Token Client
const initTokenClient = (): Promise<void> => {
    return new Promise((resolve, reject) => {
        const checkGIS = () => {
            // @ts-ignore
            if (typeof google !== 'undefined' && google.accounts && google.accounts.oauth2) {
                // @ts-ignore
                tokenClient = google.accounts.oauth2.initTokenClient({
                    client_id: CLIENT_ID,
                    scope: SCOPES,
                    callback: (response: any) => {
                        if (response.error) {
                            console.error('[Drive] GIS Token Error:', response);
                            if (signInCallback) signInCallback(false);
                            return;
                        }
                        accessToken = response.access_token;
                        console.log('[Drive] GIS Token received successfully!');

                        // Set the token for GAPI client
                        gapi.client.setToken({ access_token: accessToken });

                        if (signInCallback) signInCallback(true);
                    },
                });
                console.log('[Drive] GIS Token Client initialized');
                resolve();
            } else {
                setTimeout(checkGIS, 100);
            }
        };
        checkGIS();
    });
};

// Main initialization
export const initGapi = async () => {
    await loadGapiClient();
    await initTokenClient();

    // Check if we have a stored token
    const storedToken = localStorage.getItem('googleDriveAccessToken');
    if (storedToken) {
        accessToken = storedToken;
        gapi.client.setToken({ access_token: accessToken });
        console.log('[Drive] Using stored access token');
    }
};

// Sign In using GIS
export const handleSignIn = (): Promise<boolean> => {
    return new Promise(async (resolve) => {
        try {
            console.log('[Drive] handleSignIn called (GIS mode)...');
            await initGapi();

            if (!tokenClient) {
                console.error('[Drive] Token client not initialized');
                toast.error('Erro ao inicializar cliente de autenticação');
                resolve(false);
                return;
            }

            signInCallback = (success: boolean) => {
                if (success && accessToken) {
                    localStorage.setItem('googleDriveAccessToken', accessToken);
                    localStorage.setItem('googleDriveTokenTimestamp', Date.now().toString());
                    toast.success('Conectado ao Google Drive!');
                }
                resolve(success);
            };

            // Request access token - use 'none' for potential silent refresh if we already had a token
            const hasRecentToken = localStorage.getItem('googleDriveAccessToken');
            tokenClient.requestAccessToken({
                prompt: hasRecentToken ? 'none' : 'consent',
                hint: hasRecentToken ? undefined : undefined // Could potentially use user email hint if stored
            });

        } catch (err: any) {
            console.error('[Drive] Sign-In Error:', err);
            toast.error('Erro ao conectar: ' + (err.message || 'Erro desconhecido'));
            resolve(false);
        }
    });
};

// Initialize the API functionality - checking persistence first
export const initializeDriveSystem = async (): Promise<boolean> => {
    await initGapi();
    return !!accessToken;
};

// Check if user is authenticated (variable state)
export const isUserAuthenticated = () => {
    return !!accessToken;
};


// Get current access token
export const getAccessToken = () => accessToken;

/**
 * Gera uma URL de miniatura robusta para uma imagem do Drive.
 * Se for PDF ou se a miniatura padrão falhar, tenta usar o endpoint de miniatura direto com token.
 */
export const getThumbnailUrl = (img: DriveImage): string => {
    const isPdf = img.mimeType === 'application/pdf' || (img.name && img.name.toLowerCase().endsWith('.pdf'));
    const token = getAccessToken();

    // Se for PDF e temos token, usamos o endpoint direto com token para garantir visualização em tempo real
    if (isPdf && token) {
        return `https://drive.google.com/thumbnail?id=${img.id}&sz=w600&access_token=${token}`;
    }

    if (img.thumbnailLink) {
        // Tenta aumentar a resolução da miniatura padrão
        if (img.thumbnailLink.includes('=s')) {
            return img.thumbnailLink.replace(/=s\d+/, '=s600');
        }
        if (img.thumbnailLink.includes('sz=')) {
            return img.thumbnailLink.replace(/sz=w\d+/, 'sz=w600');
        }
        return img.thumbnailLink;
    }

    // Se não houver link de miniatura, usa o endpoint direto da API
    const size = 'sz=w600';

    // Se tivermos um token, anexamos para garantir acesso a arquivos privados
    if (token) {
        return `https://drive.google.com/thumbnail?id=${img.id}&${size}&access_token=${token}`;
    }

    // Tentativa pública (funcionará apenas se o arquivo for compartilhado publicamente)
    return `https://drive.google.com/thumbnail?id=${img.id}&${size}`;
};

/**
 * Extrai todos os IDs de pedido do nome da pasta
 * Exemplo: "251216H1G5Q991 Pão gostoso 251216H1HXY0XR 251216H1KBQFA2 251216H1N507CV"
 * Retorna: ["251216H1G5Q991", "251216H1HXY0XR", "251216H1KBQFA2", "251216H1N507CV"]
 */
const extractOrderIdsFromFolderName = (folderName: string): string[] => {
    // Padrão flexível: Procure por sequências de 8+ caracteres alfanuméricos que comecem com números
    // Ex: 251216H1G5Q991 ou 200012456278
    const idPattern = /\b\d{6,8}[A-Z0-9]*\b/g;
    const matches = folderName.match(idPattern);
    return matches || [];
};

export const getImagesForOrder = async (orderId: string, orderDate?: string, alternativeOrderId?: string): Promise<{ images: DriveImage[], folderName: string, relatedOrderIds?: string[], folderId: string } | null> => {
    // Ensure GAPI is initialized (at least API Key for public folders)
    await initGapi();

    // Safety check: warn if not authenticated, but proceed for public folders
    if (!isUserAuthenticated()) {
        console.log(`[Drive] Searching for ${orderId} in PUBLIC mode (API Key only).`);
    }

    const mainRootId = localStorage.getItem('googleDrivePublicFolderId') || '1lPRLR2oHxhPrkg4etlNyeTawZvDBZxk';
    const estampasRootId = localStorage.getItem('googleDriveEstampasFolderId');
    const backupRootId = localStorage.getItem('googleDriveBackupFolderId');

    // Helper to clear auth and retry
    const clearAuthAndRetry = () => {
        console.warn('[Drive] 401 Unauthorized. Clearing token and retrying public access...');
        accessToken = null;
        localStorage.removeItem('googleDriveAccessToken');
        gapi.client.setToken(null); // Clear GAPI token
        toast('Sessão do Drive expirou. Tentando acesso público...', { icon: '🔄' });
    };

    // Wrapper for list calls with 401 handling
    const safeListFiles = async (params: any): Promise<any> => {
        try {
            return await gapi.client.drive.files.list(params);
        } catch (error: any) {
            if (error?.status === 401 || error?.result?.error?.code === 401) {
                clearAuthAndRetry();
                // Retry without auth
                // remove drive-specific fields if they cause issues unauthenticated?
                // Actually supportsAllDrives is fine for public.
                return await gapi.client.drive.files.list(params);
            }
            throw error;
        }
    };

    const performSearch = async (searchId: string): Promise<{ images: DriveImage[], folderName: string, relatedOrderIds?: string[], folderId: string } | null> => {
        if (!searchId) return null;
        console.log(`[Drive] Searching for order: ${searchId}${searchId === alternativeOrderId ? ' (from Arte Pronta)' : ''}`);

        // If searchId looks like a Google Drive ID (no spaces, long, etc), try direct fetch first
        if (searchId.length >= 25 && !searchId.includes(' ')) {
            try {
                await initGapi();
                // Use safeListFiles
                const directFiles = await safeListFiles({
                    q: `'${searchId}' in parents and (mimeType contains 'image/' or mimeType = 'application/pdf') and trashed = false`,
                    fields: 'files(id, name, thumbnailLink, webViewLink, webContentLink, mimeType)',
                    pageSize: 100,
                    supportsAllDrives: true,
                    includeItemsFromAllDrives: true
                });

                if (directFiles.result.files) {
                    const folderInfo = await gapi.client.drive.files.get({
                        fileId: searchId,
                        fields: 'name',
                        supportsAllDrives: true
                    });
                    console.log(`[Drive] ✅ Successfully linked directly to folder: ${folderInfo.result.name}`);
                    return {
                        images: directFiles.result.files as DriveImage[],
                        folderName: folderInfo.result.name,
                        folderId: searchId
                    };
                }
            } catch (directError: any) {
                console.warn(`[Drive] Direct folder ID fetch failed for ${searchId}, falling back to search by name...`);
            }
        }

        const searchInFolder = async (rootFolderId: string) => {
            try {
                await initGapi();
                let orderFolder: { id: string, name: string } | undefined;

                // Always search for folder by name (never use as direct ID)
                // Search for folder matching the order ID
                let candidates: any[] = [];

                // 1. Try direct search first (Immediate children)
                const directSearch = await safeListFiles({
                    q: `'${rootFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and name contains '${searchId}' and trashed = false`,
                    fields: 'files(id, name)',
                    pageSize: 10,
                    supportsAllDrives: true,
                    includeItemsFromAllDrives: true
                });

                if (directSearch.result.files && directSearch.result.files.length > 0) {
                    candidates = directSearch.result.files;
                }

                // 2. Try date-based search (Subfolders like 28/12 or 28-12)
                if (candidates.length === 0 && orderDate) {
                    const variants = [
                        orderDate.substring(0, 5), // "DD/MM"
                        orderDate.substring(0, 5).replace('/', '-'), // "DD-MM"
                        orderDate.substring(3, 5) + '-' + orderDate.substring(0, 2), // "MM-DD"
                    ];

                    for (const dateFolderName of variants) {
                        if (candidates.length > 0) break;

                        const dateFolderResponse = await safeListFiles({
                            q: `'${rootFolderId}' in parents and name = '${dateFolderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
                            fields: 'files(id, name)',
                            pageSize: 1,
                            supportsAllDrives: true,
                            includeItemsFromAllDrives: true
                        });

                        const dateFolders = dateFolderResponse.result.files;
                        if (dateFolders && dateFolders.length > 0) {
                            const subfolderResponse = await safeListFiles({
                                q: `'${dateFolders[0].id}' in parents and mimeType = 'application/vnd.google-apps.folder' and name contains '${searchId}' and trashed = false`,
                                fields: 'files(id, name)',
                                pageSize: 15,
                                supportsAllDrives: true,
                                includeItemsFromAllDrives: true
                            });

                            if (subfolderResponse.result.files && subfolderResponse.result.files.length > 0) {
                                candidates = subfolderResponse.result.files;
                            }
                        }
                    }
                }

                if (candidates.length > 0) {
                    // Find folder that contains the order ID (anywhere in the name, not just at start)
                    orderFolder = candidates.find((f: any) => {
                        const folderIds = extractOrderIdsFromFolderName(f.name);
                        return folderIds.includes(searchId) || f.name.includes(searchId);
                    });
                }

                if (orderFolder) {
                    try {
                        const filesResponse = await safeListFiles({
                            q: `'${orderFolder.id}' in parents and (mimeType contains 'image/' or mimeType = 'application/pdf') and trashed = false`,
                            fields: 'files(id, name, thumbnailLink, webViewLink, webContentLink, mimeType)',
                            pageSize: 100,
                            supportsAllDrives: true,
                            includeItemsFromAllDrives: true
                        });
                        const files = filesResponse.result.files as DriveImage[];

                        // Extract all order IDs from folder name for shared mapping
                        const relatedOrderIds = extractOrderIdsFromFolderName(orderFolder.name);
                        console.log(`[Drive] ✅ Found ${files?.length || 0} files in folder ${orderFolder.id}`);
                        return { images: files || [], folderName: orderFolder.name, relatedOrderIds, folderId: orderFolder.id };
                    } catch (listError: any) {
                        console.error(`[Drive] ❌ Error listing files in folder ${orderFolder.id}:`, listError);
                        throw listError;
                    }
                }
                return null;
            } catch (error: any) {
                console.error(`[Drive] Error in searchInFolder for root ${rootFolderId}:`, error);
                return null;
            }
        };

        // 1st Attempt: Main Folder
        let result = await searchInFolder(mainRootId);

        // 2nd Attempt: Estampas Folder (Priority 2)
        if (!result && estampasRootId && estampasRootId !== mainRootId) {
            console.log(`[Drive] Order ${searchId} not found in main. Trying estampas...`);
            result = await searchInFolder(estampasRootId);
        }

        // 3rd Attempt: Backup Folder (if both failed)
        if (!result && backupRootId && backupRootId !== mainRootId && backupRootId !== estampasRootId) {
            console.log(`[Drive] Order ${searchId} not found in main/estampas. Trying backup...`);
            result = await searchInFolder(backupRootId);
        }

        // 4th Attempt: TRULY GLOBAL SEARCH (No parent restrictions) - REQUIRES AUTH
        // Only run if we STILL think we have an accessToken (meaning it wasn't cleared by 401s above)
        if (!result && accessToken) {
            console.log(`[Drive] Order ${searchId} NOT found in roots. Starting TRULY GLOBAL search...`);
            try {
                await initGapi();
                const globalQuery = `mimeType = 'application/vnd.google-apps.folder' and name contains '${searchId}' and trashed = false`;
                const searchParams: any = {
                    q: globalQuery,
                    fields: 'files(id, name)',
                    pageSize: 20
                };

                // Only include drive-scope params if authenticated
                if (accessToken) {
                    searchParams.supportsAllDrives = true;
                    searchParams.includeItemsFromAllDrives = true;
                }

                // Global search inherently likely to fail without proper permissions/scope or if expired
                // so we use safeListFiles here too
                const globalSearch = await safeListFiles(searchParams);

                const globalFiles = globalSearch.result.files || [];
                if (globalFiles.length > 0) {
                    const bestFolder = globalFiles.find((f: any) => {
                        const ids = extractOrderIdsFromFolderName(f.name);
                        return ids.includes(searchId) || f.name.includes(searchId);
                    });

                    if (bestFolder) {
                        const fileParams: any = {
                            q: `'${bestFolder.id}' in parents and (mimeType contains 'image/' or mimeType = 'application/pdf') and trashed = false`,
                            fields: 'files(id, name, thumbnailLink, webViewLink, webContentLink, mimeType)',
                            pageSize: 100
                        };

                        if (accessToken) {
                            fileParams.supportsAllDrives = true;
                            fileParams.includeItemsFromAllDrives = true;
                        }

                        const filesResponse = await safeListFiles(fileParams);
                        const files = filesResponse.result.files as DriveImage[];
                        return { images: files || [], folderName: bestFolder.name, folderId: bestFolder.id, relatedOrderIds: extractOrderIdsFromFolderName(bestFolder.name) };
                    }
                }
            } catch (globalError) {
                console.error(`[Drive] ❌ GLOBAL search error:`, globalError);
            }
        }

        return result;
    };

    // Main execution flow: Try alternative ID first, then fallback to original ID
    let finalResult = await performSearch(alternativeOrderId || orderId);

    // If alternative ID failed (or returned empty results), try the original orderId
    if ((!finalResult || finalResult.images.length === 0) && alternativeOrderId && alternativeOrderId.trim() !== orderId.trim()) {
        console.log(`[Drive] Fallback triggered. Alternative ID "${alternativeOrderId}" yielded no results. Trying original ID "${orderId}"...`);
        finalResult = await performSearch(orderId);
    }

    if (finalResult) {
        console.log(`[Drive] Final getImagesForOrder result: SUCCESS`);
    } else {
        console.log(`[Drive] Order ${orderId} NOT found in any search attempt.`);
    }

    return finalResult;
};

/**
 * Procura ou cria uma pasta no Google Drive
 */
export const findOrCreateFolder = async (folderName: string, parentId: string): Promise<string> => {
    await initGapi();

    // Procura por pasta existente
    const response = await gapi.client.drive.files.list({
        q: `'${parentId}' in parents and name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        fields: 'files(id, name)',
        pageSize: 1,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true
    });

    const files = response.result.files;
    if (files && files.length > 0) {
        return files[0].id;
    }

    // Se não existir, cria uma nova
    const createResponse = await gapi.client.drive.files.create({
        resource: {
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [parentId]
        },
        fields: 'id',
        supportsAllDrives: true
    });

    return createResponse.result.id;
};

/**
 * Faz o upload de um arquivo para uma pasta específica
 */
export const uploadFileToDrive = async (file: File, folderId: string): Promise<DriveImage> => {
    await initGapi();

    // Ensure we are signed in
    if (!isUserAuthenticated()) {
        const success = await handleSignIn();
        if (!success) {
            throw new Error('Falha na autenticação com Google Drive');
        }
    }

    const metadata = {
        name: file.name,
        parents: [folderId]
    };

    const formData = new FormData();
    formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    formData.append('file', file);

    const token = getAccessToken();
    if (!token) {
        throw new Error('Token de acesso não disponível');
    }

    const response = await fetch(`https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,thumbnailLink,webViewLink,mimeType&supportsAllDrives=true`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
        },
        body: formData
    });

    if (!response.ok) {
        throw new Error('Falha no upload para o Google Drive');
    }

    return await response.json();
};
