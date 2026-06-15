import React, { useState, useCallback, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Lote } from '../../types';
import { saveLote, deleteLote, uploadLoteImage, updateLote, deleteLoteImage, getLoteSummary, getPedidosByLote, getPedidosSemLote, bulkAssignLoteToPedidos } from '../../services/supabaseService';
import { LoteImageModal } from './LoteImageModal';
import { isUserAuthenticated, handleSignIn } from '../../services/googleDriveService';

interface LotesManagerProps {
    lotes: Lote[];
    onLoteChange: () => void;
}

export const LotesManager: React.FC<LotesManagerProps> = ({ lotes, onLoteChange }) => {
    const [numeroLote, setNumeroLote] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [viewingLote, setViewingLote] = useState<Lote | null>(null);
    const [isGoogleDriveAuth, setIsGoogleDriveAuth] = useState(false);

    // Batch upload preview states
    const [batchFiles, setBatchFiles] = useState<File[]>([]);
    const [batchPreviews, setBatchPreviews] = useState<string[]>([]);

    // Edit mode states
    const [editingLote, setEditingLote] = useState<Lote | null>(null);
    const [editNumero, setEditNumero] = useState('');
    const [editFile, setEditFile] = useState<File | null>(null);
    const [editPreview, setEditPreview] = useState<string | null>(null);

    // Pedidos vinculados states
    const [pedidoCounts, setPedidoCounts] = useState<Record<string, number>>({});
    const [viewingPedidos, setViewingPedidos] = useState<{ lote: Lote; pedidos: any[] } | null>(null);
    const [loadingPedidos, setLoadingPedidos] = useState(false);

    // Pedidos sem lote states
    const [pedidosSemLote, setPedidosSemLote] = useState<any[]>([]);
    const [showPedidosSemLote, setShowPedidosSemLote] = useState(false);
    const [loadingPedidosSemLote, setLoadingPedidosSemLote] = useState(false);
    const [selectedPedidos, setSelectedPedidos] = useState<Set<string>>(new Set());
    const [selectedLoteForBulk, setSelectedLoteForBulk] = useState<string>('');

    // Check Google Drive authentication on mount
    useEffect(() => {
        setIsGoogleDriveAuth(isUserAuthenticated());
    }, []);

    // Load pedido counts for all lotes
    useEffect(() => {
        const loadPedidoCounts = async () => {
            const counts: Record<string, number> = {};
            for (const lote of lotes) {
                try {
                    const summary = await getLoteSummary(lote.numeroLote);
                    counts[lote.id] = summary.pedidoCount;
                } catch (error) {
                    console.error(`Error fetching count for lote ${lote.numeroLote}:`, error);
                    counts[lote.id] = 0;
                }
            }
            setPedidoCounts(counts);
        };

        if (lotes.length > 0) {
            loadPedidoCounts();
        }
    }, [lotes]);

    const handleFileSelect = (file: File) => {
        if (!file.type.startsWith('image/')) {
            toast.error('Por favor selecione uma imagem válida');
            return;
        }

        if (file.size > 10 * 1024 * 1024) {
            toast.error('Imagem muito grande. Máximo 10MB');
            return;
        }

        setSelectedFile(file);
        const reader = new FileReader();
        reader.onloadend = () => {
            setPreview(reader.result as string);
        };
        reader.readAsDataURL(file);
    };

    const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(false);

        const files = Array.from(e.dataTransfer.files);

        if (files.length === 0) return;

        // Filter only image files
        const imageFiles = files.filter(f => f.type.startsWith('image/'));

        if (imageFiles.length === 0) {
            toast.error('Nenhuma imagem válida encontrada');
            return;
        }

        if (imageFiles.length !== files.length) {
            toast.error(`${files.length - imageFiles.length} arquivo(s) ignorado(s) - apenas imagens são aceitas`);
        }

        if (imageFiles.length === 1) {
            // Single file: use existing flow
            handleFileSelect(imageFiles[0]);
        } else {
            // Multiple files: store for preview - NÃO FAZ UPLOAD AUTOMÁTICO
            setBatchFiles(imageFiles);

            // Create previews for all images
            const previews: string[] = [];
            imageFiles.forEach((file, index) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    previews[index] = reader.result as string;
                    // Update state when all previews are loaded
                    if (previews.filter(p => p).length === imageFiles.length) {
                        setBatchPreviews([...previews]);
                    }
                };
                reader.readAsDataURL(file);
            });

            toast.success(`${imageFiles.length} imagens carregadas. Preencha o número do lote e clique em Salvar.`, { duration: 4000 });
        }
    }, [numeroLote]);

    const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback(() => {
        setIsDragging(false);
    }, []);

    const handleSave = async () => {
        if (!numeroLote || numeroLote.trim().length === 0) {
            toast.error('N\u00famero do lote \u00e9 obrigat\u00f3rio');
            return;
        }

        if (numeroLote.trim().length > 3) {
            toast.error('N\u00famero do lote muito longo (m\u00e1ximo 3 caracteres)');
            return;
        }

        // Check which mode: batch or single
        const isBatchMode = batchFiles.length > 0;

        if (!isBatchMode && !selectedFile) {
            toast.error('Selecione uma imagem');
            return;
        }

        // Check if lote already exists - if yes, we'll add images to it
        const existingLote = lotes.find(l => l.numeroLote.toUpperCase() === numeroLote.toUpperCase());
        const isAddingToExisting = !!existingLote;

        setIsUploading(true);
        try {
            if (isBatchMode) {
                // BATCH MODE: Upload multiple images
                let successCount = 0;
                const loteNumber = numeroLote.toUpperCase();
                const allImageUrls: string[] = [];
                const allThumbnails: string[] = [];

                // Upload all images first
                for (let i = 0; i < batchFiles.length; i++) {
                    const file = batchFiles[i];

                    // Upload image
                    const { imageUrl, thumbnailUrl } = await uploadLoteImage(file, loteNumber);
                    allImageUrls.push(imageUrl);
                    if (thumbnailUrl) allThumbnails.push(thumbnailUrl);
                    successCount++;
                }

                // Save or update lote with ALL images
                if (isAddingToExisting && existingLote) {
                    // Update existing lote - append new images to existing array
                    const currentImages = existingLote.imagens || [existingLote.imagemUrl];
                    const updatedImages = [...currentImages, ...allImageUrls];
                    await updateLote(existingLote.id, {
                        imagens: updatedImages
                    });
                } else {
                    // Create NEW lote with all images
                    await saveLote({
                        numeroLote: loteNumber,
                        imagemUrl: allImageUrls[0], // First image as primary
                        imagens: allImageUrls, // All images in array
                        dataCriacao: new Date().toISOString(),
                        thumbnail: allThumbnails[0]
                    });
                }

                const message = isAddingToExisting
                    ? `${successCount} imagens adicionadas ao lote existente ${loteNumber}!`
                    : `Lote ${loteNumber} criado com ${successCount} imagens!`;
                toast.success(message);

                // Reset batch states
                setBatchFiles([]);
                setBatchPreviews([]);
            } else {
                // SINGLE MODE: Upload single image
                const { imageUrl, thumbnailUrl } = await uploadLoteImage(selectedFile, numeroLote.toUpperCase());

                if (isAddingToExisting && existingLote) {
                    // Add to existing lote - append to imagens array
                    const currentImages = existingLote.imagens || [existingLote.imagemUrl];
                    const updatedImages = [...currentImages, imageUrl];
                    await updateLote(existingLote.id, {
                        imagens: updatedImages
                    });
                    toast.success(`Imagem adicionada ao lote ${numeroLote.toUpperCase()}!`);
                } else {
                    // Create new lote with single image
                    await saveLote({
                        numeroLote: numeroLote.toUpperCase(),
                        imagemUrl: imageUrl,
                        imagens: [imageUrl], // Single image in array
                        dataCriacao: new Date().toISOString(),
                        thumbnail: thumbnailUrl
                    });
                    toast.success(`Lote ${numeroLote.toUpperCase()} cadastrado!`);
                }

                setSelectedFile(null);
                setPreview(null);
            }

            // Reset form
            setNumeroLote('');
            onLoteChange();
        } catch (error) {
            console.error('Error saving lote:', error);
            toast.error('Erro ao salvar lote');
        } finally {
            setIsUploading(false);
        }
    };

    const handleBatchUpload = async (files: File[]) => {
        // OBRIGATÓRIO: Verificar se o número do lote está preenchido
        if (!numeroLote || numeroLote.trim().length === 0) {
            toast.error('❌ Preencha o Número de Lote antes de fazer upload das imagens!');
            return;
        }

        // Validate lote number format (3 digits)
        if (numeroLote.trim().length > 3 || !/^\d+$/.test(numeroLote)) {
            toast.error('❌ Número de lote inválido! Use apenas números de 1 a 3 dígitos.');
            return;
        }

        // Filter only image files
        const imageFiles = files.filter(f => f.type.startsWith('image/'));

        if (imageFiles.length === 0) {
            toast.error('Nenhuma imagem válida encontrada');
            return;
        }

        if (imageFiles.length !== files.length) {
            toast.error(`${files.length - imageFiles.length} arquivo(s) ignorado(s) - apenas imagens são aceitas`);
        }

        // Check if lote already exists - allow adding more images to it
        const existingLote = lotes.find(l => l.numeroLote.toUpperCase() === numeroLote.toUpperCase());
        const isAddingToExisting = !!existingLote;

        setIsUploading(true);
        let successCount = 0;
        let failCount = 0;
        const errors: string[] = [];

        // IMPORTANTE: Usar o MESMO número de lote para TODAS as imagens
        const loteNumber = numeroLote.toUpperCase();

        for (let i = 0; i < imageFiles.length; i++) {
            const file = imageFiles[i];

            try {
                // Validate file size
                if (file.size > 10 * 1024 * 1024) {
                    errors.push(`${file.name}: maior que 10MB`);
                    failCount++;
                    continue;
                }

                // Upload image with lote number as reference
                const { imageUrl, thumbnailUrl } = await uploadLoteImage(file, loteNumber);

                // Save ONLY the first image as lote (or create multiple entries with same lote number?)
                // Based on requirement: "todas as imagens do lote 05 devem aparecer juntas"
                // I'll create ONE lote entry with the first image, additional images can be added later
                if (i === 0) {
                    await saveLote({
                        numeroLote: loteNumber,
                        imagemUrl: imageUrl,
                        dataCriacao: new Date().toISOString(),
                        thumbnail: thumbnailUrl
                    });
                } else {
                    // For additional images, we need to add them to the existing lote
                    // This might require updating the lote or creating a separate images table
                    // For now, just upload to storage with the same lote prefix
                    // The images will be accessible via the lote folder in storage
                }

                successCount++;
            } catch (error) {
                console.error(`Error uploading image ${file.name}:`, error);
                errors.push(`${file.name}: ${error instanceof Error ? error.message : 'erro desconhecido'}`);
                failCount++;
            }
        }

        setIsUploading(false);

        // Show results
        if (successCount > 0) {
            const message = isAddingToExisting
                ? `✅ ${successCount} imagem(ns) adicionada(s) ao lote existente ${loteNumber}!`
                : `✅ ${successCount} imagem(ns) adicionada(s) ao novo lote ${loteNumber}!`;
            toast.success(message);
            // Reset form
            setNumeroLote('');
            setSelectedFile(null);
            setPreview(null);
            onLoteChange();
        }

        if (failCount > 0) {
            const errorMsg = errors.length > 0
                ? `❌ ${failCount} falha(s):\n` + errors.slice(0, 3).join('\n') + (errors.length > 3 ? '\n...' : '')
                : `❌ ${failCount} falha(s)`;
            toast.error(errorMsg, { duration: 5000 });
        }
    };

    const handleDelete = async (lote: Lote) => {
        if (!confirm(`Deletar lote ${lote.numeroLote}?`)) return;

        try {
            await deleteLote(lote.id);
            toast.success(`Lote ${lote.numeroLote} deletado!`);
            onLoteChange();
        } catch (error) {
            console.error('Error deleting lote:', error);
            toast.error('Erro ao deletar lote');
        }
    };

    const handleEdit = async () => {
        if (!editingLote) return;

        if (!editNumero || editNumero.trim().length === 0) {
            toast.error('Número do lote é obrigatório');
            return;
        }

        if (editNumero.trim().length > 20) {
            toast.error('Número do lote muito longo (máximo 20 caracteres)');
            return;
        }

        // Check if numero changed and already exists
        if (editNumero !== editingLote.numeroLote) {
            if (lotes.some(l => l.numeroLote.toUpperCase() === editNumero.toUpperCase() && l.id !== editingLote.id)) {
                toast.error(`Lote "${editNumero}" já existe!`);
                return;
            }
        }

        setIsUploading(true);
        try {
            let imageUrl = editingLote.imagemUrl;
            let thumbnailUrl = editingLote.thumbnail;

            // Upload new image if changed
            if (editFile) {
                // Delete old image from Google Drive first
                try {
                    await deleteLoteImage(editingLote.imagemUrl);
                } catch (error) {
                    console.error('Error deleting old image:', error);
                    // Continue anyway - upload is more important
                }

                // Upload new image
                const uploadResult = await uploadLoteImage(editFile, editNumero.toUpperCase());
                imageUrl = uploadResult.imageUrl;
                thumbnailUrl = uploadResult.thumbnailUrl;
            }

            // Update lote in database
            await updateLote(editingLote.id, {
                numeroLote: editNumero.toUpperCase(),
                imagemUrl: imageUrl,
                thumbnail: thumbnailUrl
            });

            toast.success(`Lote ${editNumero.toUpperCase()} atualizado!`);

            // Reset edit mode
            setEditingLote(null);
            setEditNumero('');
            setEditFile(null);
            setEditPreview(null);

            // Refresh lotes list
            onLoteChange();
        } catch (error) {
            console.error('Error updating lote:', error);
            toast.error('Erro ao atualizar lote');
        } finally {
            setIsUploading(false);
        }
    };

    const startEdit = (lote: Lote) => {
        setEditingLote(lote);
        setEditNumero(lote.numeroLote);
        setEditPreview(lote.imagemUrl);
        setEditFile(null);
    };

    const handleViewPedidos = async (lote: Lote) => {
        setLoadingPedidos(true);
        try {
            const pedidos = await getPedidosByLote(lote.numeroLote);
            setViewingPedidos({ lote, pedidos });
        } catch (error) {
            console.error('Error fetching pedidos:', error);
            toast.error('Erro ao carregar pedidos');
        } finally {
            setLoadingPedidos(false);
        }
    };

    const loadPedidosSemLote = async () => {
        setLoadingPedidosSemLote(true);
        try {
            const pedidos = await getPedidosSemLote();
            setPedidosSemLote(pedidos);
            setShowPedidosSemLote(true);
        } catch (error) {
            console.error('Error loading pedidos sem lote:', error);
            toast.error('Erro ao carregar pedidos sem lote');
        } finally {
            setLoadingPedidosSemLote(false);
        }
    };

    const handleBulkAssign = async () => {
        if (selectedPedidos.size === 0) {
            toast.error('Selecione pelo menos um pedido');
            return;
        }

        if (!selectedLoteForBulk) {
            toast.error('Selecione um lote de destino');
            return;
        }

        try {
            await bulkAssignLoteToPedidos(Array.from(selectedPedidos), selectedLoteForBulk);
            toast.success(`${selectedPedidos.size} pedido(s) atribuído(s) ao lote ${selectedLoteForBulk}`);

            // Reset selections and reload
            setSelectedPedidos(new Set());
            setSelectedLoteForBulk('');
            await loadPedidosSemLote();
            onLoteChange(); // Refresh pedido counts
        } catch (error) {
            console.error('Error bulk assigning pedidos:', error);
            toast.error('Erro ao atribuir pedidos em lote');
        }
    };

    const togglePedidoSelection = (orderId: string) => {
        setSelectedPedidos(prev => {
            const newSet = new Set(prev);
            if (newSet.has(orderId)) {
                newSet.delete(orderId);
            } else {
                newSet.add(orderId);
            }
            return newSet;
        });
    };

    const toggleSelectAll = () => {
        if (selectedPedidos.size === pedidosSemLote.length) {
            setSelectedPedidos(new Set());
        } else {
            setSelectedPedidos(new Set(pedidosSemLote.map(p => p.order_id)));
        }
    };

    const cancelEdit = () => {
        setEditingLote(null);
        setEditNumero('');
        setEditFile(null);
        setEditPreview(null);
    };

    return (
        <div className="p-6 space-y-6">
            {/* Google Drive Authentication Warning */}
            {!isGoogleDriveAuth && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-400 dark:border-yellow-700 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                        <svg className="w-6 h-6 text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <div className="flex-1">
                            <h3 className="font-semibold text-yellow-800 dark:text-yellow-400 mb-1">
                                Conecte-se ao Google Drive
                            </h3>
                            <p className="text-sm text-yellow-700 dark:text-yellow-500 mb-3">
                                As imagens dos lotes são armazenadas no Google Drive. Você precisa se conectar para criar e gerenciar lotes.
                            </p>
                            <button
                                onClick={async () => {
                                    const success = await handleSignIn();
                                    setIsGoogleDriveAuth(success);
                                    if (success) {
                                        toast.success('Conectado ao Google Drive!');
                                    }
                                }}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-sm"
                            >
                                🔗 Conectar ao Google Drive
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Upload Section */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Cadastrar Novo Lote</h2>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* LEFT SIDE: Drag & Drop + Gallery (2/3 width) */}
                    <div className="lg:col-span-2 space-y-4">
                        {/* Drag & Drop Area */}
                        <div
                            className={`relative border-2 border-dashed rounded-xl p-6 transition-all ${isDragging
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                                }`}
                            onDrop={handleDrop}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                        >
                            <input
                                type="file"
                                accept="image/*"
                                multiple
                                onChange={(e) => {
                                    if (e.target.files && e.target.files.length > 0) {
                                        const files = Array.from(e.target.files);
                                        if (files.length === 1) {
                                            handleFileSelect(files[0]);
                                        } else {
                                            // Trigger the same batch logic as drag-drop
                                            const imageFiles = files.filter(f => f.type.startsWith('image/'));
                                            setBatchFiles(imageFiles);
                                            const previews: string[] = [];
                                            imageFiles.forEach((file, index) => {
                                                const reader = new FileReader();
                                                reader.onloadend = () => {
                                                    previews[index] = reader.result as string;
                                                    if (previews.filter(p => p).length === imageFiles.length) {
                                                        setBatchPreviews([...previews]);
                                                    }
                                                };
                                                reader.readAsDataURL(file);
                                            });
                                            toast.success(`${imageFiles.length} imagens carregadas.`);
                                        }
                                    }
                                }}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />

                            {preview && !batchPreviews.length ? (
                                <div className="relative">
                                    <img src={preview} alt="Preview" className="w-full h-48 object-contain rounded" />
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setPreview(null);
                                            setSelectedFile(null);
                                        }}
                                        className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full hover:bg-red-600"
                                    >
                                        ✕
                                    </button>
                                </div>
                            ) : !batchPreviews.length ? (
                                <div className="text-center">
                                    <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                                        <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                                        <span className="font-medium text-blue-600">Clique para selecionar</span> ou arraste as imagens
                                    </p>
                                    <p className="text-xs text-gray-500 mt-1">PNG, JPG, WEBP até 10MB (uma ou múltiplas)</p>
                                </div>
                            ) : null}
                        </div>

                        {/* Batch Preview Gallery */}
                        {batchPreviews.length > 0 && (
                            <div className="p-4 border-2 border-dashed border-purple-300 dark:border-purple-700 rounded-xl bg-purple-50/50 dark:bg-purple-900/10">
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="text-sm font-bold text-purple-900 dark:text-purple-100">
                                        {batchPreviews.length} {batchPreviews.length === 1 ? 'imagem' : 'imagens'} carregada(s)
                                    </h4>
                                    <button
                                        onClick={() => {
                                            setBatchFiles([]);
                                            setBatchPreviews([]);
                                        }}
                                        className="text-xs text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 font-semibold"
                                    >
                                        ✕ Limpar
                                    </button>
                                </div>
                                <div className="grid grid-cols-4 gap-2">
                                    {batchPreviews.map((preview, idx) => (
                                        <div key={idx} className="relative aspect-square">
                                            <img
                                                src={preview}
                                                alt={`Preview ${idx + 1}`}
                                                className="w-full h-full object-cover rounded border border-gray-300 dark:border-gray-600"
                                            />
                                            <div className="absolute top-1 right-1 bg-purple-600 text-white text-xs px-1.5 py-0.5 rounded font-bold">
                                                {idx + 1}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* RIGHT SIDE: Form (1/3 width) */}
                    <div className="flex flex-col justify-between space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Número de Lote (máx 3 caracteres)
                            </label>
                            <input
                                type="text"
                                value={numeroLote}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    // Aceitar apenas números com máximo 3 caracteres
                                    if (/^\d{0,3}$/.test(value)) {
                                        setNumeroLote(value);
                                    }
                                }}
                                placeholder="Ex: 05, 123"
                                maxLength={3}
                                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-lg font-mono tracking-wider text-center"
                            />
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-center">
                                {numeroLote.length}/3 caracteres
                            </p>
                        </div>

                        <button
                            onClick={handleSave}
                            disabled={isUploading || !numeroLote || (!selectedFile && batchFiles.length === 0)}
                            className="w-full mt-4 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {isUploading ? 'Salvando...' : 'Salvar Lote'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Lotes Grid */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                        Lotes Cadastrados ({lotes.length})
                    </h2>
                    <button
                        onClick={loadPedidosSemLote}
                        disabled={loadingPedidosSemLote}
                        className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        {loadingPedidosSemLote ? 'Carregando...' : 'Pedidos Sem Lote'}
                    </button>
                </div>

                {lotes.length === 0 ? (
                    <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                        Nenhum lote cadastrado ainda
                    </p>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                        {lotes.map((lote) => (
                            <div
                                key={lote.id}
                                className="group relative bg-gray-50 dark:bg-gray-700 rounded-lg overflow-hidden border-2 border-gray-200 dark:border-gray-600 hover:border-purple-500 transition-all cursor-pointer"
                                onClick={() => setViewingLote(lote)}
                            >
                                <div className="aspect-square w-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                                    <img
                                        src={lote.thumbnail || lote.imagemUrl}
                                        alt={`Lote ${lote.numeroLote}`}
                                        className="w-full h-full object-cover"
                                        loading="lazy"
                                        onError={(e) => {
                                            // Hide broken image and show icon instead
                                            e.currentTarget.style.display = 'none';
                                            const parent = e.currentTarget.parentElement;
                                            if (parent && !parent.querySelector('.fallback-icon')) {
                                                const icon = document.createElement('div');
                                                icon.className = 'fallback-icon flex items-center justify-center w-full h-full';
                                                icon.innerHTML = `<svg class="w-16 h-16 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                </svg>`;
                                                parent.appendChild(icon);
                                            }
                                        }}
                                    />
                                </div>
                                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex flex-col justify-end p-2">
                                    <p className="text-white font-bold text-lg">{lote.numeroLote}</p>
                                    <p className="text-white/80 text-xs">
                                        {new Date(lote.dataCriacao).toLocaleDateString('pt-BR')}
                                    </p>
                                </div>
                                {/* Pedido count badge */}
                                {pedidoCounts[lote.id] !== undefined && pedidoCounts[lote.id] > 0 && (
                                    <div className="absolute top-2 left-2">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleViewPedidos(lote);
                                            }}
                                            className="bg-purple-600 text-white px-2 py-1 rounded-full text-xs font-bold shadow-lg hover:bg-purple-500 transition-all flex items-center gap-1"
                                            title="Ver pedidos vinculados"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                            </svg>
                                            {pedidoCounts[lote.id]}
                                        </button>
                                    </div>
                                )}
                                {/* Action buttons */}
                                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {/* Edit button */}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            startEdit(lote);
                                        }}
                                        className="bg-blue-500 text-white p-1.5 rounded-full hover:bg-blue-600 transition-colors"
                                        title="Editar lote"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                    </button>
                                    {/* Delete button */}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDelete(lote);
                                        }}
                                        className="bg-red-500 text-white p-1.5 rounded-full hover:bg-red-600 transition-colors"
                                        title="Deletar lote"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Pedidos Sem Lote Modal */}
            {showPedidosSemLote && (
                <div className="fixed inset-0 z-[100003] flex items-center justify-center bg-black/80 backdrop-blur-sm">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-orange-500/30 p-6 max-w-6xl w-full mx-4 max-h-[85vh] overflow-hidden flex flex-col">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                                    Pedidos Sem Lote
                                </h2>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                    {pedidosSemLote.length} {pedidosSemLote.length === 1 ? 'pedido encontrado' : 'pedidos encontrados'}
                                    {selectedPedidos.size > 0 && ` • ${selectedPedidos.size} selecionado(s)`}
                                </p>
                            </div>
                            <button
                                onClick={() => {
                                    setShowPedidosSemLote(false);
                                    setSelectedPedidos(new Set());
                                    setSelectedLoteForBulk('');
                                }}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                            >
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Bulk Assignment Controls */}
                        {selectedPedidos.size > 0 && (
                            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded-lg p-4 mb-4">
                                <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                                    <div className="flex-1">
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                            Atribuir {selectedPedidos.size} pedido(s) ao lote:
                                        </label>
                                        <select
                                            value={selectedLoteForBulk}
                                            onChange={(e) => setSelectedLoteForBulk(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 dark:bg-gray-700 dark:text-white"
                                        >
                                            <option value="">Selecione um lote...</option>
                                            {lotes.map(lote => (
                                                <option key={lote.id} value={lote.numeroLote}>
                                                    {lote.numeroLote}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <button
                                        onClick={handleBulkAssign}
                                        disabled={!selectedLoteForBulk}
                                        className="px-6 py-2 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                                    >
                                        Atribuir
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Content */}
                        <div className="overflow-y-auto flex-1">
                            {pedidosSemLote.length === 0 ? (
                                <div className="text-center py-12">
                                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <p className="text-gray-500 dark:text-gray-400 mt-4">Todos os pedidos estão atribuídos a lotes!</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {/* Select All */}
                                    <div className="bg-gray-100 dark:bg-gray-700/50 rounded-lg p-3 mb-2">
                                        <label className="flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={pedidosSemLote.length > 0 && selectedPedidos.size === pedidosSemLote.length}
                                                onChange={toggleSelectAll}
                                                className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                                            />
                                            <span className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                                                Selecionar todos ({pedidosSemLote.length})
                                            </span>
                                        </label>
                                    </div>

                                    {/* Pedidos List */}
                                    {pedidosSemLote.map((pedido, index) => (
                                        <div
                                            key={index}
                                            className={`bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 transition-all ${selectedPedidos.has(pedido.order_id)
                                                ? 'ring-2 ring-orange-500 bg-orange-50 dark:bg-orange-900/20'
                                                : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                                                }`}
                                        >
                                            <div className="flex items-start gap-3">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedPedidos.has(pedido.order_id)}
                                                    onChange={() => togglePedidoSelection(pedido.order_id)}
                                                    className="mt-1 w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500 cursor-pointer"
                                                />
                                                <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-3">
                                                    <div>
                                                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Pedido</p>
                                                        <p className="text-sm font-bold text-gray-900 dark:text-white font-mono">{pedido.order_id}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Estampa</p>
                                                        <p className="text-sm text-gray-900 dark:text-white truncate">{pedido.nome_estampa || '-'}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Cor</p>
                                                        <p className="text-sm text-gray-900 dark:text-white">{pedido.cor || '-'}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Tamanho</p>
                                                        <p className="text-sm text-gray-900 dark:text-white">{pedido.tamanho || '-'}</p>
                                                    </div>
                                                </div>
                                            </div>
                                            {pedido.status && (
                                                <div className="mt-2 ml-7">
                                                    <span className="inline-block px-2 py-1 text-xs font-semibold rounded bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                                                        {pedido.status}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                            <button
                                onClick={() => {
                                    setShowPedidosSemLote(false);
                                    setSelectedPedidos(new Set());
                                    setSelectedLoteForBulk('');
                                }}
                                className="w-full px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                            >
                                Fechar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {editingLote && (
                <div className="fixed inset-0 z-[100001] flex items-center justify-center bg-black/80 backdrop-blur-sm">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-blue-500/30 p-6 max-w-2xl w-full mx-4">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                                Editar Lote {editingLote.numeroLote}
                            </h2>
                            <button
                                onClick={cancelEdit}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                            >
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Preview da Imagem */}
                            <div className="relative border-2 border-dashed rounded-xl p-6 transition-all border-gray-300 dark:border-gray-600 hover:border-gray-400">
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                            handleFileSelect(file);
                                            setEditFile(file);
                                        }
                                    }}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />

                                {editPreview ? (
                                    <div className="relative">
                                        <img src={editPreview} alt="Preview" className="w-full h-48 object-contain rounded" />
                                        <div className="absolute top-2 right-2 bg-blue-500/90 text-white text-xs px-2 py-1 rounded">
                                            {editFile ? 'Nova Imagem' : 'Imagem Atual'}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center h-48 flex items-center justify-center">
                                        <p className="text-gray-500 dark:text-gray-400">Clique para alterar imagem</p>
                                    </div>
                                )}
                            </div>

                            {/* Form */}
                            <div className="flex flex-col justify-between">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Número do Lote (máx 20 caracteres)
                                    </label>
                                    <input
                                        type="text"
                                        value={editNumero}
                                        onChange={(e) => setEditNumero(e.target.value.toUpperCase().slice(0, 20))}
                                        placeholder="11A"
                                        maxLength={20}
                                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-lg font-mono tracking-wider text-center"
                                    />
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
                                        {editNumero.length}/20 caracteres
                                    </p>
                                </div>

                                <div className="flex gap-3 mt-4">
                                    <button
                                        onClick={cancelEdit}
                                        className="flex-1 px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={handleEdit}
                                        disabled={isUploading || !editNumero}
                                        className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        {isUploading ? 'Salvando...' : 'Salvar Alterações'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Image Viewer Modal */}
            {viewingLote && (
                <LoteImageModal
                    loteNumero={viewingLote.numeroLote}
                    imagemUrl={viewingLote.imagemUrl}
                    imagens={viewingLote.imagens}
                    dataCriacao={viewingLote.dataCriacao}
                    onClose={() => setViewingLote(null)}
                />
            )}

            {/* Pedidos Vinculados Modal */}
            {viewingPedidos && (
                <div className="fixed inset-0 z-[100002] flex items-center justify-center bg-black/80 backdrop-blur-sm">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-purple-500/30 p-6 max-w-6xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                                    Pedidos Vinculados ao Lote {viewingPedidos.lote.numeroLote}
                                </h2>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                    {viewingPedidos.pedidos.length} {viewingPedidos.pedidos.length === 1 ? 'pedido encontrado' : 'pedidos encontrados'}
                                </p>
                            </div>
                            <button
                                onClick={() => setViewingPedidos(null)}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                            >
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Content */}
                        <div className="overflow-y-auto flex-1">
                            {viewingPedidos.pedidos.length === 0 ? (
                                <div className="text-center py-12">
                                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                                    </svg>
                                    <p className="text-gray-500 dark:text-gray-400 mt-4">Nenhum pedido vinculado a este lote</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {viewingPedidos.pedidos.map((pedido, index) => {
                                        // Debug: Log all available fields
                                        console.log(`[Pedido ${index}]`, {
                                            order_id: pedido.order_id,
                                            google_drive_images: pedido.google_drive_images,
                                            arte_pronta_id: pedido.arte_pronta_id,
                                            google_drive_folder_id: pedido.google_drive_folder_id
                                        });

                                        // Parse google_drive_images if available
                                        let thumbnailUrl = null;
                                        try {
                                            // Try google_drive_images first
                                            if (pedido.google_drive_images) {
                                                const images = JSON.parse(pedido.google_drive_images);
                                                if (Array.isArray(images) && images.length > 0) {
                                                    thumbnailUrl = images[0].thumbnailLink || images[0].url;
                                                    console.log(`[Lote Modal] Thumbnail from google_drive_images:`, thumbnailUrl);
                                                }
                                            }

                                            // Fallback to arte_pronta_id thumbnail
                                            if (!thumbnailUrl && pedido.arte_pronta_id) {
                                                // Construct Google Drive thumbnail URL from file ID
                                                thumbnailUrl = `https://drive.google.com/thumbnail?id=${pedido.arte_pronta_id}&sz=w200`;
                                                console.log(`[Lote Modal] Thumbnail from arte_pronta_id:`, thumbnailUrl);
                                            }
                                        } catch (e) {
                                            console.error('[Lote Modal] Error parsing thumbnail:', e, 'Data:', pedido.google_drive_images);
                                        }

                                        // Final fallback: Use LOTE's first image
                                        if (!thumbnailUrl && viewingPedidos.lote) {
                                            const loteImages = viewingPedidos.lote.imagens;
                                            if (loteImages && loteImages.length > 0) {
                                                thumbnailUrl = loteImages[0];
                                            } else {
                                                thumbnailUrl = viewingPedidos.lote.imagemUrl;
                                            }
                                            console.log(`[Lote Modal] Using lote image as fallback:`, thumbnailUrl);
                                        }

                                        return (
                                            <div
                                                key={index}
                                                className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex gap-4"
                                            >
                                                {/* Thumbnail */}
                                                {thumbnailUrl ? (
                                                    <div className="flex-shrink-0">
                                                        <img
                                                            src={thumbnailUrl}
                                                            alt="Estampa"
                                                            className="w-20 h-20 object-cover rounded-lg border border-gray-300 dark:border-gray-600"
                                                        />
                                                    </div>
                                                ) : (
                                                    <div className="flex-shrink-0 w-20 h-20 bg-gray-200 dark:bg-gray-600 rounded-lg flex items-center justify-center border border-gray-300 dark:border-gray-600">
                                                        <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                        </svg>
                                                    </div>
                                                )}

                                                {/* Details */}
                                                <div className="flex-1">
                                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                                        <div>
                                                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Pedido</p>
                                                            <p className="text-sm font-bold text-gray-900 dark:text-white font-mono">{pedido.order_id}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Estampa</p>
                                                            <p className="text-sm text-gray-900 dark:text-white truncate">{pedido.nome_estampa || '-'}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Cor</p>
                                                            <p className="text-sm text-gray-900 dark:text-white">{pedido.cor || '-'}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Tamanho</p>
                                                            <p className="text-sm text-gray-900 dark:text-white">{pedido.tamanho || '-'}</p>
                                                        </div>
                                                    </div>
                                                    {pedido.status && (
                                                        <div className="mt-2">
                                                            <span className="inline-block px-2 py-1 text-xs font-semibold rounded bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                                                                {pedido.status}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                            <button
                                onClick={() => setViewingPedidos(null)}
                                className="w-full px-6 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors"
                            >
                                Fechar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
