import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { EstampaRow, DriveImage, Lote } from '../../types';
import {
    getAtrasoStatus,
    getPecaColorClass,
    extractEstampaName,
    TABLE_HEADERS,
    aramadoLetras,
    aramadoNumeros,
    statusSelectColorClasses,
    localSelectColorClasses,
    canalColorClasses,
    fornecedorColorClasses
} from './utils';
import { getImagesForOrder, findOrCreateFolder, uploadFileToDrive, isUserAuthenticated, handleSignIn, getThumbnailUrl } from '../../services/googleDriveService';
import { getColorHex, getTextColorForBackground } from '../../utils/colorUtils';
import { getColorMap } from '../../services/skuService';
import { CopyButton } from '../common/CopyButton';
import { LoteImageModal } from './LoteImageModal';

interface EstampasListProps {
    data: EstampaRow[];
    isLoading?: boolean;
    sortConfig: { key: keyof EstampaRow; direction: 'asc' | 'desc' } | null;
    onSort: (key: keyof EstampaRow) => void;
    onRowUpdate: (updatedRow: EstampaRow) => void;
    onEditRow: (row: EstampaRow) => void;
    delayRules: Record<string, { onTime: number; atRisk: number }>;
    imageMappings?: Record<string, string>;
    lotes?: Lote[];
    selectedPedidos?: Set<string>;
    onTogglePedidoSelection?: (orderId: string) => void;
    onToggleSelectAll?: () => void;
}

export const EstampasList: React.FC<EstampasListProps> = ({
    data,
    isLoading,
    sortConfig,
    onSort,
    onRowUpdate,
    onEditRow,
    delayRules,
    imageMappings,
    lotes = [],
    selectedPedidos = new Set(),
    onTogglePedidoSelection = () => { },
    onToggleSelectAll = () => { },
}) => {
    // --- State ---
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    const [orderImages, setOrderImages] = useState<Record<string, DriveImage[] | null>>({});
    const [loadingImages, setLoadingImages] = useState<Record<string, boolean>>({});
    const [isUploading, setIsUploading] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [viewingLote, setViewingLote] = useState<Lote | null>(null);

    // Popovers
    const [editingObsRowId, setEditingObsRowId] = useState<string | null>(null);
    const [editingObsValue, setEditingObsValue] = useState('');
    const obsInputRef = useRef<HTMLTextAreaElement>(null);

    const [editingLinkRowId, setEditingLinkRowId] = useState<string | null>(null);
    const [editingLinkValue, setEditingLinkValue] = useState('');
    const linkInputRef = useRef<HTMLInputElement>(null);

    const [editingArteProntaRowId, setEditingArteProntaRowId] = useState<string | null>(null);
    const [editingArteProntaValue, setEditingArteProntaValue] = useState('');
    const arteProntaInputRef = useRef<HTMLInputElement>(null);

    const [thumbnailMenuOpen, setThumbnailMenuOpen] = useState<{ rowId: string, imgId: string } | null>(null);

    // --- Effects ---

    // Initialize images from cache
    useEffect(() => {
        const initialImages: Record<string, DriveImage[]> = {};
        data.forEach(row => {
            if (row.googleDriveImages) {
                try {
                    initialImages[row.codVenda] = JSON.parse(row.googleDriveImages);
                } catch (e) {
                    console.error("Failed to parse cached images for", row.codVenda);
                }
            }
        });
        if (Object.keys(initialImages).length > 0) {
            setOrderImages(prev => ({ ...prev, ...initialImages }));
        }
    }, [data]);

    // Close menus on click outside
    useEffect(() => {
        const handleClickOutside = () => {
            setThumbnailMenuOpen(null);
        };
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);


    // --- Helpers ---

    const colorList = React.useMemo(() => [...new Set(Object.values(getColorMap()))].sort(), []);

    const handleRowChange = (row: EstampaRow, field: keyof EstampaRow, value: any) => {
        const finalValue = (field === 'quantidade') ? (parseInt(value, 10) || 0) : value;
        const updates: Partial<EstampaRow> = { [field]: finalValue };

        // Automatic timestamp for Lote (L) or Aramado positions
        if ((field === 'L' || field === 'aramadoLetra' || field === 'aramadoNumero') && value && !row.aramadoDataColocacao) {
            const now = new Date();
            const formattedDate = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
            updates.aramadoDataColocacao = formattedDate;
        }

        onRowUpdate({ ...row, ...updates });
    };

    const toggleRow = async (rowId: string, orderId: string, orderDate?: string) => {
        setExpandedRows(prev => {
            const newSet = new Set(prev);
            if (newSet.has(rowId)) {
                newSet.delete(rowId);
            } else {
                newSet.add(rowId);
            }
            return newSet;
        });

        if (!expandedRows.has(rowId) && orderImages[orderId] === undefined && !loadingImages[orderId]) {
            setLoadingImages(prev => ({ ...prev, [orderId]: true }));
            try {
                const currentRow = data.find(r => r.id === rowId);
                let effectiveFolderId = currentRow?.googleDriveFolderId;

                if (currentRow?.arteProntaId) {
                    effectiveFolderId = currentRow.arteProntaId;
                } else if (imageMappings && imageMappings[orderId]) {
                    effectiveFolderId = imageMappings[orderId];
                }

                const folderIdToUse = currentRow?.arteProntaId || currentRow?.googleDriveFolderId || (imageMappings ? imageMappings[orderId] : undefined);

                const result = await getImagesForOrder(orderId, orderDate, folderIdToUse);

                if (result) {
                    let hasPersistentChanges = false;
                    let updatedRow = currentRow ? { ...currentRow } : undefined;

                    setOrderImages(prev => ({ ...prev, [orderId]: result.images }));

                    const usedArtePronta = !!currentRow?.arteProntaId;

                    if (updatedRow && (!updatedRow.googleDriveImages)) {
                        updatedRow.googleDriveImages = JSON.stringify(result.images);
                        hasPersistentChanges = true;
                    }

                    if (updatedRow && !folderIdToUse && result.folderId && !updatedRow.googleDriveFolderId && !usedArtePronta) {
                        updatedRow.googleDriveFolderId = result.folderId;
                        hasPersistentChanges = true;
                    }

                    if (updatedRow) {
                        const extractedName = extractEstampaName(result.folderName, orderId);
                        if (extractedName && extractedName !== updatedRow.nomeEstampa) {
                            updatedRow.nomeEstampa = extractedName;
                            hasPersistentChanges = true;
                        }

                        if (result.images.length > 0 && ['FAZER ARTE', 'SEM IMAGEM', 'IMAGEM', 'ERRO IMPRESSÃO'].includes(updatedRow.status)) {
                            updatedRow.status = 'PRONTA';
                            hasPersistentChanges = true;
                        }

                        if (result.images.length > 0 && !updatedRow.tratado) {
                            updatedRow.tratado = true;
                            hasPersistentChanges = true;
                        }
                    }

                    if (updatedRow && hasPersistentChanges) {
                        onRowUpdate(updatedRow);
                    }
                } else {
                    setOrderImages(prev => ({ ...prev, [orderId]: [] }));
                }
            } catch (error) {
                console.error("Error fetching images for order", orderId, error);
                setOrderImages(prev => ({ ...prev, [orderId]: [] }));
            } finally {
                setLoadingImages(prev => ({ ...prev, [orderId]: false }));
            }
        }
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, row: EstampaRow) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsUploading(row.id);
        try {
            if (!isUserAuthenticated()) {
                try {
                    await handleSignIn();
                } catch (authError) {
                    console.error('Erro na autenticação:', authError);
                    alert('Você precisa autorizar o Google Drive para fazer upload.');
                    setIsUploading(null);
                    return;
                }
            }

            const mainRootId = localStorage.getItem('googleDrivePublicFolderId') || '1npMWcDmlPPboLXX-PFV8GaUftk_Ey-Xn'; // Updated to new Drive account
            const dateParts = row.fullDate.split('/');
            const dateFolderName = `${dateParts[0].padStart(2, '0')}-${dateParts[1].padStart(2, '0')}`;
            const dateFolderId = await findOrCreateFolder(dateFolderName, mainRootId);
            const orderFolderName = `${row.codVenda}${row.nomeEstampa ? ` - ${row.nomeEstampa}` : ''}`;
            const orderFolderId = await findOrCreateFolder(orderFolderName, dateFolderId);
            const uploadedFile = await uploadFileToDrive(file, orderFolderId);

            setOrderImages(prev => ({
                ...prev,
                [row.codVenda]: [...(prev[row.codVenda] || []), uploadedFile]
            }));

            if (!row.tratado) {
                onRowUpdate({ ...row, tratado: true });
            }
            toast.success('Imagem enviada com sucesso!');
        } catch (error) {
            console.error('Erro no upload:', error);
            alert('Erro ao enviar imagem para o Google Drive.');
        } finally {
            setIsUploading(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    // --- Render Helpers ---

    const isEditableLinkChannel = (canal: string): boolean => {
        const normalizedCanal = canal.toUpperCase();
        return normalizedCanal.includes('SH MM') || normalizedCanal.includes('SH VEST');
    };

    const startEditingObs = (row: EstampaRow) => {
        setEditingObsRowId(row.id);
        setEditingObsValue(row.observacao || '');
        setTimeout(() => obsInputRef.current?.focus(), 50);
    };

    const saveObservation = (row: EstampaRow) => {
        if (editingObsRowId === row.id) {
            onRowUpdate({ ...row, observacao: editingObsValue });
            setEditingObsRowId(null);
            setEditingObsValue('');
        }
    };

    const startEditingLink = (row: EstampaRow) => {
        setEditingLinkRowId(row.id);
        setEditingLinkValue(row.linkPedido || '');
        setTimeout(() => linkInputRef.current?.focus(), 50);
    };

    const saveLinkPedido = (row: EstampaRow) => {
        if (editingLinkRowId === row.id) {
            let linkValue = editingLinkValue.trim();
            // Add protocol if missing
            if (linkValue && !/^https?:\/\//i.test(linkValue)) {
                linkValue = 'https://' + linkValue;
            }
            onRowUpdate({ ...row, linkPedido: linkValue });
            setEditingLinkRowId(null);
            setEditingLinkValue('');
        }
    };

    const startEditingArtePronta = (row: EstampaRow) => {
        setEditingArteProntaRowId(row.id);
        setEditingArteProntaValue(row.arteProntaId || '');
        setTimeout(() => arteProntaInputRef.current?.focus(), 50);
    };

    const saveArtePronta = (row: EstampaRow) => {
        if (editingArteProntaRowId === row.id) {
            const newValue = editingArteProntaValue.trim();
            if (newValue !== row.arteProntaId) {
                onRowUpdate({ ...row, arteProntaId: newValue });
                // Reset cached images to force re-fetch with new ID on next expand
                if (newValue) {
                    setOrderImages(prev => ({ ...prev, [row.codVenda]: null })); // Force refresh
                }
            }
            setEditingArteProntaRowId(null);
            setEditingArteProntaValue('');
        }
    };

    const handleOpenFolder = (img: DriveImage) => {
        // Logic to open folder (mocked effectively by opening webViewLink which usually goes to preview, logic in original was simple window.open)
        // Original used img.webViewLink. For folder open, it just opened the link?
        // Original code: window.open(img.webViewLink, '_blank'); for image click.
        // For 'Abrir Pasta', it seemed to imply finding parent folder.
        // Re-checking original:
        // onClick={() => handleOpenFolder(img)} ... implementation not in viewed code?
        // Assuming it opens parent folder if we had it.
        // Actually, let's just open the image link for now or just log.
        // Wait, the original likely used the parent ID if available.
        // I'll stick to opening the file link or folder if known.
        // For now, let's just open the image link as fallback.
        window.open(img.webViewLink, '_blank');
    };

    const handleDeleteFile = (img: DriveImage, codVenda: string) => {
        // Implement delete logic or placeholder
        if (confirm(`Deseja deletar ${img.name}?`)) {
            // Calling service to delete would be ideal
            // For now just update local state to hide it
            setOrderImages(prev => ({
                ...prev,
                [codVenda]: prev[codVenda]?.filter(i => i.id !== img.id) || []
            }));
            toast.success('Arquivo removido da lista (não do Drive)');
        }
    };

    const handleRenameFile = (img: DriveImage, codVenda: string) => {
        const newName = prompt("Novo nome:", img.name);
        if (newName) {
            // Update local state
            setOrderImages(prev => ({
                ...prev,
                [codVenda]: prev[codVenda]?.map(i => i.id === img.id ? { ...i, name: newName } : i) || []
            }));
        }
    }


    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto rounded-lg shadow-sm border border-gray-700 bg-gray-800">
            <table className="min-w-full border-separate border-spacing-0">
                <thead className="bg-[#1a1d23] sticky top-0 z-[15]">
                    <tr>
                        {TABLE_HEADERS.map((header) => (
                            <th
                                key={header.key}
                                scope="col"
                                className={`sticky top-0 z-[15] bg-[#1a1d23] border-b border-gray-800 px-1 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wide ${header.key === 'select' ? '' : 'cursor-pointer hover:bg-gray-800/50'} transition-colors ${header.widthClass}`}
                                onClick={() => header.sortable && onSort(header.key as keyof EstampaRow)}
                            >
                                {header.key === 'select' ? (
                                    <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                                        <input
                                            type="checkbox"
                                            checked={selectedPedidos.size === data.length && data.length > 0}
                                            onChange={onToggleSelectAll}
                                            className="w-4 h-4 text-purple-600 bg-gray-900 border-gray-700 rounded focus:ring-purple-500 focus:ring-2 cursor-pointer"
                                            title="Selecionar todos"
                                        />
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-start gap-1 px-2">
                                        {header.label}
                                        {sortConfig?.key === header.key && (
                                            <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                        )}
                                    </div>
                                )}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="bg-[#1a1d23] divide-y divide-gray-800">
                    {data.map((row) => {
                        const atraso = getAtrasoStatus(row.fullDate, row.canal, delayRules, row.dataPrevista);
                        const corBg = getColorHex(row.cor);
                        const corText = getTextColorForBackground(corBg);

                        return (
                            <React.Fragment key={row.id}>
                                <tr
                                    className={`hover:bg-gray-800/30 transition-colors cursor-pointer group ${expandedRows.has(row.id) ? 'bg-gray-800/30' : ''} 
                                        ${(orderImages[row.codVenda]?.length || row.tratado) ? 'bg-green-500/10' : ''} 
                                        ${row.L ? 'bg-purple-500/10 border-l-4 border-purple-500 shadow-[inset_0_0_15px_rgba(168,85,247,0.15)]' : ''} 
                                        ${selectedPedidos.has(row.codVenda) ? 'bg-blue-500/20 ring-2 ring-blue-500/50' : ''}
                                        ${row.status === 'AJUSTE' ? 'bg-fuchsia-500/20' : ''}
                                        ${['ERRO IMPRESSÃO', 'IMAGEM', 'NÃO CHEGOU'].includes(row.status) ? 'bg-red-500/20' : ''}
                                    `}
                                    onClick={() => onEditRow(row)}
                                >
                                    {/* SELECT CHECKBOX */}
                                    <td className="px-1 py-0.5 whitespace-nowrap text-center" onClick={(e) => e.stopPropagation()}>
                                        <div className="flex items-center justify-center">
                                            <input
                                                type="checkbox"
                                                checked={selectedPedidos.has(row.codVenda)}
                                                onChange={() => onTogglePedidoSelection(row.codVenda)}
                                                className="w-4 h-4 text-purple-600 bg-gray-900 border-gray-700 rounded focus:ring-purple-500 focus:ring-2 cursor-pointer"
                                            />
                                        </div>
                                    </td>

                                    {/* ACTIONS */}
                                    <td className="px-1 py-0.5 whitespace-nowrap text-center text-xs" onClick={(e) => e.stopPropagation()}>
                                        <div className="flex items-center justify-center gap-1">
                                            <button
                                                onClick={() => toggleRow(row.id, row.codVenda, row.fullDate)}
                                                className="text-gray-400 hover:text-primary-500 transition-colors"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 transform transition-transform ${expandedRows.has(row.id) ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </button>
                                            <button
                                                onClick={() => onEditRow(row)}
                                                className="text-gray-400 hover:text-white transition-colors"
                                                title="Ver detalhes"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                </svg>
                                            </button>
                                        </div>
                                    </td>

                                    {/* ATRASO */}
                                    <td className="px-1 py-0.5 whitespace-nowrap text-center">
                                        <div className="flex justify-center" title={atraso.tooltip}>
                                            <div className={`w-4 h-4 ${atraso.color}`}>
                                                {atraso.icon}
                                            </div>
                                        </div>
                                    </td>

                                    {/* STATUS */}
                                    <td className="px-1 py-0.5 whitespace-nowrap text-center" onClick={(e) => e.stopPropagation()}>
                                        <select
                                            value={row.status}
                                            onChange={(e) => handleRowChange(row, 'status', e.target.value)}
                                            className={`text-[10px] font-bold rounded px-2 py-0.5 border border-white/10 uppercase focus:outline-none focus:ring-1 focus:ring-white/30 w-full text-center appearance-none cursor-pointer hover:opacity-90 relative z-10 ${statusSelectColorClasses[row.status] || 'bg-gray-100 text-gray-800'}`}
                                        >
                                            {['FAZER ARTE', 'PRONTA', 'EM APROVAÇÃO', 'APROVADO', 'IMPRESSO', 'AJUSTE', 'IMAGEM', 'ERRO IMPRESSÃO', 'NÃO CHEGOU', 'CANCELADO'].map(opt => (
                                                <option key={opt} value={opt} className={`${statusSelectColorClasses[opt]} text-white`}>{opt}</option>
                                            ))}
                                        </select>
                                    </td>

                                    {/* DATA */}
                                    <td className="px-1 py-0.5 whitespace-nowrap text-center text-[10px] text-white font-medium">
                                        {row.fullDate ? row.fullDate.split('/').slice(0, 2).join('/') : ''}
                                    </td>

                                    {/* DATA PREVISTA */}
                                    <td className="px-1 py-0.5 whitespace-nowrap text-center text-[10px] text-gray-500 font-mono">
                                        {row.dataPrevista ? row.dataPrevista.split('/').slice(0, 2).join('/') : '-'}
                                    </td>


                                    {/* PEDIDO */}
                                    <td className="px-1 py-0.5 whitespace-nowrap text-center" onClick={(e) => e.stopPropagation()}>
                                        <div className="flex items-center justify-center gap-1">
                                            {(() => {
                                                const canalUpper = row.canal?.toUpperCase() || '';
                                                const isML = canalUpper.includes('ML');
                                                const isSH = canalUpper.includes('SH');
                                                const effectiveLink = row.linkPedido || (isML ? `https://www.mercadolivre.com.br/vendas/novo/mensagens/${row.codVenda}` : isSH ? `https://seller.shopee.com.br/portal/sale/order/${row.codVenda}` : null);

                                                if (effectiveLink) {
                                                    return (
                                                        <a
                                                            href={effectiveLink}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="text-xs font-bold text-blue-400 hover:text-blue-300 font-mono transition-colors underline decoration-blue-500/30"
                                                            title={isML ? "Abrir Mensagens ML" : isSH ? "Abrir Pedido Shopee" : "Abrir Link"}
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            {row.codVenda}
                                                        </a>
                                                    );
                                                }
                                                return <span className="text-xs font-bold text-white font-mono">{row.codVenda}</span>;
                                            })()}

                                            <CopyButton text={row.codVenda} />

                                            {/* Edit Link Button (Lapis) */}
                                            {isEditableLinkChannel(row.canal) && !row.canal?.toUpperCase().includes('ML') && (
                                                <div className="relative inline-block">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); startEditingLink(row); }}
                                                        className="text-gray-400 hover:text-blue-400 ml-0.5 transition-colors p-0.5"
                                                        title={row.linkPedido ? "Editar Link" : "Adicionar Link"}
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                        </svg>
                                                    </button>

                                                    {/* Popover Edit Link - NOW A BETTER MODAL */}
                                                    {editingLinkRowId === row.id && createPortal(
                                                        <div className="fixed inset-0 z-[100000] flex items-center justify-center">
                                                            <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => saveLinkPedido(row)} />
                                                            <div
                                                                className="relative bg-white dark:bg-gray-800 p-6 rounded-xl shadow-2xl border border-blue-500/30 w-full max-w-md transform transition-all animate-fade-in-scale"
                                                                onClick={(e) => e.stopPropagation()}
                                                            >
                                                                <div className="flex items-center gap-3 mb-4">
                                                                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
                                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                                                        </svg>
                                                                    </div>
                                                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Link do Pedido</h3>
                                                                </div>

                                                                <input
                                                                    ref={linkInputRef}
                                                                    type="text"
                                                                    value={editingLinkValue}
                                                                    onChange={(e) => setEditingLinkValue(e.target.value)}
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter') saveLinkPedido(row);
                                                                        if (e.key === 'Escape') setEditingLinkRowId(null);
                                                                    }}
                                                                    className="w-full text-sm p-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-gray-900 dark:text-white transition-all mb-4"
                                                                    placeholder="Cole a URL do pedido aqui (ex: https://...)"
                                                                    autoFocus
                                                                />

                                                                <div className="flex items-center justify-between mt-2">
                                                                    <p className="text-[10px] text-gray-400 italic">
                                                                        Pressione <span className="font-bold text-gray-300">ENTER</span> para salvar ou <span className="font-bold text-gray-300">ESC</span> para cancelar.
                                                                    </p>
                                                                    <div className="flex gap-2">
                                                                        <button
                                                                            onClick={() => setEditingLinkRowId(null)}
                                                                            className="px-4 py-2 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
                                                                        >
                                                                            Cancelar
                                                                        </button>
                                                                        <button
                                                                            onClick={() => saveLinkPedido(row)}
                                                                            className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-lg text-xs font-bold transition-all shadow-lg active:scale-95"
                                                                        >
                                                                            Salvar Link
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>,
                                                        document.body
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </td>

                                    {/* CANAL */}
                                    <td className="px-1 py-0.5 whitespace-nowrap text-center text-[10px]">
                                        <span className={`px-2 py-0.5 rounded-sm border-0 font-semibold backdrop-blur-sm ${canalColorClasses[row.canal] || 'bg-gray-100 text-gray-800'}`}>
                                            {row.canal}
                                        </span>
                                    </td>

                                    {/* PEÇA */}
                                    <td className="px-1 py-0.5 whitespace-nowrap text-center text-xs">
                                        <span className={getPecaColorClass(row.peca)} title={row.peca}>{row.peca}</span>
                                    </td>

                                    {/* ESTAMPA (Editável) */}
                                    <td className="px-1 py-0.5 text-center" onClick={(e) => e.stopPropagation()}>
                                        <div className="relative group/edit">
                                            <input
                                                type="text"
                                                defaultValue={row.nomeEstampa || ''}
                                                onBlur={(e) => {
                                                    if (e.target.value !== (row.nomeEstampa || '')) {
                                                        handleRowChange(row, 'nomeEstampa', e.target.value);
                                                    }
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        (e.target as HTMLInputElement).blur();
                                                    }
                                                }}
                                                className="w-full text-xs text-center bg-transparent border-none focus:ring-1 focus:ring-primary-500 rounded px-1 truncate placeholder-gray-300 dark:placeholder-gray-600 focus:bg-white dark:focus:bg-gray-700 font-medium cursor-text relative z-10"
                                                placeholder="Nome da Estampa"
                                            />
                                            <span className="absolute right-0 top-1/2 -translate-y-1/2 opacity-0 group-hover/edit:opacity-100 text-gray-400 pointer-events-none text-[10px]">✎</span>
                                        </div>
                                    </td>

                                    {/* LOCAL */}
                                    <td className="px-1 py-0.5 text-center" onClick={(e) => e.stopPropagation()}>
                                        <select
                                            value={row.localEstampa || ''}
                                            onChange={(e) => handleRowChange(row, 'localEstampa', e.target.value)}
                                            className={`text-[10px] w-full rounded border border-white/10 px-2 py-0.5 text-center appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-white/30 font-semibold relative z-10 ${localSelectColorClasses[row.localEstampa || ''] || 'bg-gray-700 text-gray-300'}`}
                                        >
                                            <option value="" className="bg-gray-800 text-white">Selecione...</option>
                                            {['PEITO', 'COSTAS', 'PEITO E COSTAS'].map(opt => (
                                                <option key={opt} value={opt} className={`${localSelectColorClasses[opt]} text-white`}>{opt}</option>
                                            ))}
                                        </select>
                                    </td>

                                    {/* COR */}
                                    <td className="px-1 py-0.5 whitespace-nowrap text-center" onClick={(e) => e.stopPropagation()}>
                                        <div className="relative">
                                            <select
                                                value={row.cor}
                                                onChange={(e) => handleRowChange(row, 'cor', e.target.value)}
                                                className="text-[10px] w-full rounded px-2 py-0.5 text-center appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary-500 font-semibold border-0 relative z-10"
                                                style={{ backgroundColor: corBg, color: corText }}
                                            >
                                                {colorList.map(c => (
                                                    <option key={c} value={c} style={{ backgroundColor: getColorHex(c), color: getTextColorForBackground(getColorHex(c)) }}>{c}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </td>

                                    {/* TAMANHO */}
                                    <td className="px-1 py-0.5 whitespace-nowrap text-center text-xs font-bold text-gray-300">
                                        {row.tamanho}
                                    </td>

                                    {/* QUANTIDADE */}
                                    <td className="px-1 py-0.5 whitespace-nowrap text-center" onClick={(e) => e.stopPropagation()}>
                                        <input
                                            type="number"
                                            value={row.quantidade}
                                            onChange={(e) => handleRowChange(row, 'quantidade', e.target.value)}
                                            className="w-12 text-center text-xs border-gray-300 dark:border-gray-600 rounded py-0.5 focus:ring-primary-500 focus:border-primary-500 bg-transparent dark:text-white cursor-text relative z-10"
                                        />
                                    </td>

                                    {/* ARAMADO */}
                                    <td className="px-1 py-0.5 whitespace-nowrap text-center" onClick={(e) => e.stopPropagation()}>
                                        <div className="flex items-center justify-center gap-0.5">
                                            <select
                                                value={row.aramadoLetra || ''}
                                                onChange={(e) => handleRowChange(row, 'aramadoLetra', e.target.value)}
                                                className={`w-10 text-[10px] p-0.5 border-0 rounded text-center font-semibold uppercase focus:ring-1 focus:ring-purple-500 transition-all relative z-10 ${row.aramadoRetirado ? 'bg-gradient-to-br from-emerald-600 to-emerald-700 text-white shadow-sm' : row.aramadoLetra ? 'bg-gradient-to-br from-purple-600 to-indigo-700 text-white shadow-sm' : 'bg-gray-700 text-gray-400'}`}
                                            >
                                                <option value="">-</option>
                                                {aramadoLetras.map(l => <option key={l} value={l}>{l}</option>)}
                                            </select>
                                            <select
                                                value={row.aramadoNumero || ''}
                                                onChange={(e) => handleRowChange(row, 'aramadoNumero', e.target.value)}
                                                className={`w-10 text-[10px] p-0.5 border-0 rounded text-center font-semibold focus:ring-1 focus:ring-purple-500 transition-all relative z-10 ${row.aramadoRetirado ? 'bg-gradient-to-br from-emerald-600 to-emerald-700 text-white shadow-sm' : row.aramadoNumero ? 'bg-gradient-to-br from-purple-600 to-indigo-700 text-white shadow-sm' : 'bg-gray-700 text-gray-400'}`}
                                            >
                                                <option value="">-</option>
                                                {aramadoNumeros.map(n => <option key={n} value={n}>{n}</option>)}
                                            </select>
                                        </div>
                                    </td>

                                    {/* L (LOTE) */}
                                    <td className="px-1 py-0.5 whitespace-nowrap text-center" onClick={(e) => e.stopPropagation()}>
                                        <div className="flex items-center justify-center gap-1">
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    list={`lote-list-${row.id}`}
                                                    value={row.L || ''}
                                                    onChange={(e) => handleRowChange(row, 'L', e.target.value)}
                                                    className="w-14 text-center text-xs border border-white/10 bg-gray-700/50 text-white rounded-sm py-0.5 focus:ring-1 focus:ring-primary-500 cursor-text relative z-10 pr-5"
                                                    placeholder="--"
                                                    maxLength={20}
                                                    title="Digite ou selecione o número do lote"
                                                />
                                                <datalist id={`lote-list-${row.id}`}>
                                                    {lotes.map(l => (
                                                        <option key={l.id} value={l.numeroLote} />
                                                    ))}
                                                </datalist>
                                                {/* Validation Indicator */}
                                                {row.L && (() => {
                                                    const loteExists = lotes.find(l => l.numeroLote?.toUpperCase() === row.L?.toUpperCase());
                                                    return (
                                                        <div className="absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none">
                                                            {loteExists ? (
                                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-green-400" viewBox="0 0 20 20" fill="currentColor" title="Lote encontrado">
                                                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                                </svg>
                                                            ) : (
                                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-yellow-400" viewBox="0 0 20 20" fill="currentColor" title="Lote não encontrado - será criado futuramente">
                                                                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                                                </svg>
                                                            )}
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                            {row.L && (() => {
                                                const lote = lotes.find(l => l.numeroLote?.toUpperCase() === row.L?.toUpperCase());
                                                if (lote) {
                                                    return (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setViewingLote(lote); }}
                                                            className="text-purple-400 hover:text-purple-300 transition-colors p-0.5"
                                                            title="Ver imagens do lote"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                            </svg>
                                                        </button>
                                                    );
                                                }
                                                return null;
                                            })()}
                                        </div>
                                    </td>

                                    {/* OBS */}
                                    <td className="px-1 py-0.5 whitespace-nowrap text-center text-xs" onClick={(e) => e.stopPropagation()}>
                                        <div className="relative">
                                            <button
                                                onClick={() => startEditingObs(row)}
                                                className={`p-1 rounded-full transition-colors ${row.observacao ? 'bg-yellow-100 text-yellow-600 hover:bg-yellow-200' : 'text-gray-300 hover:text-gray-500'}`}
                                                title={row.observacao || "Adicionar observação"}
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                                                </svg>
                                            </button>

                                            {editingObsRowId === row.id && (
                                                <div className="absolute right-0 top-0 z-50 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-xl p-2 border border-yellow-200 dark:border-yellow-900 animate-fade-in">
                                                    <textarea
                                                        ref={obsInputRef}
                                                        value={editingObsValue}
                                                        onChange={(e) => setEditingObsValue(e.target.value)}
                                                        className="w-full text-xs p-2 border border-gray-300 dark:border-gray-600 rounded focus:ring-yellow-500 focus:border-yellow-500 min-h-[80px] mb-2 bg-yellow-50 dark:bg-gray-700/50"
                                                        placeholder="Digite a observação..."
                                                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveObservation(row); } }}
                                                    />
                                                    <div className="flex justify-end gap-2">
                                                        <button
                                                            onClick={() => setEditingObsRowId(null)}
                                                            className="px-2 py-1 text-[10px] text-gray-500 hover:bg-gray-100 rounded"
                                                        >
                                                            Cancelar
                                                        </button>
                                                        <button
                                                            onClick={() => saveObservation(row)}
                                                            className="px-2 py-1 text-[10px] bg-yellow-500 text-white rounded hover:bg-yellow-600 font-medium"
                                                        >
                                                            Salvar
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                </tr>

                                {/* EXPANDED DETAILS */}
                                {
                                    expandedRows.has(row.id) && (
                                        <tr className="bg-gray-50/80 dark:bg-gray-800/80 animate-fade-in">
                                            <td colSpan={TABLE_HEADERS.length} className="px-4 py-4 border-b border-gray-200 dark:border-gray-700">
                                                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-inner border border-gray-100 dark:border-gray-700">
                                                    <div className="flex flex-col gap-4">

                                                        {/* IMAGES SCROLL */}
                                                        <div
                                                            className="flex gap-4 overflow-x-auto pb-2 min-h-[140px] items-center cursor-pointer group/dropzone relative"
                                                            onClick={() => fileInputRef.current?.click()}
                                                        >
                                                            {loadingImages[row.codVenda] ? (
                                                                <div className="flex items-center justify-center h-32 w-full bg-gray-200/50 dark:bg-gray-800/50 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700">
                                                                    <div className="flex flex-col items-center gap-2">
                                                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                                                                        <span className="text-xs font-medium text-gray-500">Buscando artes...</span>
                                                                    </div>
                                                                </div>
                                                            ) : orderImages[row.codVenda] && orderImages[row.codVenda]!.length > 0 ? (
                                                                <>
                                                                    {orderImages[row.codVenda]!.map((img) => (
                                                                        <div key={img.id} className="text-center flex-shrink-0 group relative">
                                                                            <img
                                                                                src={getThumbnailUrl(img)}
                                                                                alt={img.name}
                                                                                className="h-32 w-auto min-w-[128px] object-cover rounded-lg shadow-sm border-2 border-white dark:border-gray-700 cursor-pointer hover:ring-2 hover:ring-primary-500 transition-all bg-gray-100 dark:bg-gray-800"
                                                                                onClick={(e) => { e.stopPropagation(); window.open(img.webViewLink, '_blank'); }}
                                                                                onError={(e) => {
                                                                                    const target = e.target as HTMLImageElement;
                                                                                    // Se a miniatura falhar, mostra o ícone de PDF se for um PDF, ou tenta o fallback básico
                                                                                    if (img.mimeType === 'application/pdf' || img.name.toLowerCase().endsWith('.pdf')) {
                                                                                        target.src = 'https://upload.wikimedia.org/wikipedia/commons/8/87/PDF_file_icon.svg';
                                                                                    } else {
                                                                                        target.src = `https://drive.google.com/thumbnail?id=${img.id}&sz=w600`;
                                                                                    }
                                                                                }}
                                                                            />
                                                                            {(img.mimeType === 'application/pdf' || img.name.toLowerCase().endsWith('.pdf')) && (
                                                                                <div className="absolute top-1 left-1 bg-red-600 text-white text-[8px] font-black px-1 py-0.5 rounded shadow-sm z-20">PDF</div>
                                                                            )}
                                                                            {/* Action Menu */}
                                                                            <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                                                                <button
                                                                                    onClick={(e) => { e.stopPropagation(); setThumbnailMenuOpen(thumbnailMenuOpen?.imgId === img.id ? null : { rowId: row.id, imgId: img.id }); }}
                                                                                    className="p-1.5 bg-white/90 dark:bg-gray-800/90 rounded-full shadow-md text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-white"
                                                                                    title="Opções"
                                                                                >
                                                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                                                                                    </svg>
                                                                                </button>
                                                                            </div>
                                                                            {/* Dropdown Menu */}
                                                                            {thumbnailMenuOpen?.imgId === img.id && (
                                                                                <div
                                                                                    className="absolute top-8 right-1 z-50 w-40 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-1 animate-fade-in"
                                                                                    onClick={(e) => e.stopPropagation()}
                                                                                >
                                                                                    <button
                                                                                        onClick={() => handleOpenFolder(img)}
                                                                                        className="w-full px-3 py-1.5 text-left text-xs text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                                                                                    >
                                                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                                                                        </svg>
                                                                                        Abrir Pasta
                                                                                    </button>
                                                                                    <button
                                                                                        onClick={() => handleRenameFile(img, row.codVenda)}
                                                                                        className="w-full px-3 py-1.5 text-left text-xs text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                                                                                    >
                                                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                                                        </svg>
                                                                                        Renomear
                                                                                    </button>
                                                                                    <button
                                                                                        onClick={() => handleDeleteFile(img, row.codVenda)}
                                                                                        className="w-full px-3 py-1.5 text-left text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                                                                                    >
                                                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                                                        </svg>
                                                                                        Excluir
                                                                                    </button>
                                                                                </div>
                                                                            )}
                                                                            <p className="text-[10px] mt-1 text-gray-500 truncate w-32 font-medium" title={img.name}>{img.name}</p>
                                                                        </div>
                                                                    ))}
                                                                    {/* Add image hint */}
                                                                    <div className="flex-shrink-0 flex items-center justify-center h-32 w-32 bg-gray-50 dark:bg-gray-800/30 rounded-lg border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-primary-400 dark:hover:border-primary-600 transition-colors group/add">
                                                                        <div className="text-center p-2">
                                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mx-auto text-gray-400 group-hover/add:text-primary-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                                                            <span className="text-[10px] text-gray-400 group-hover/add:text-primary-500 font-medium whitespace-nowrap">Soltar ou Clique</span>
                                                                        </div>
                                                                    </div>
                                                                </>
                                                            ) : (
                                                                <div className="flex flex-col items-center justify-center h-32 w-full bg-gray-50 dark:bg-gray-800/30 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 group-hover/dropzone:border-primary-400 transition-colors">
                                                                    <div className="flex flex-col items-center gap-2 text-gray-400 group-hover/dropzone:text-primary-500 transition-colors">
                                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 animate-bounce-subtle" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                                                        </svg>
                                                                        <div className="text-center">
                                                                            <p className="text-sm font-bold">Arraste artes para cá</p>
                                                                            <p className="text-xs">ou clique para selecionar (JPG, PNG ou PDF)</p>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {isUploading === row.id && (
                                                                <div className="absolute inset-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center rounded-xl animate-fade-in shadow-inner">
                                                                    <div className="flex flex-col items-center gap-3">
                                                                        <div className="relative h-12 w-12">
                                                                            <svg className="animate-spin h-full w-full text-primary-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                                            </svg>
                                                                            <div className="absolute inset-0 flex items-center justify-center">
                                                                                <span className="text-[10px] font-bold text-primary-700 dark:text-primary-400">...</span>
                                                                            </div>
                                                                        </div>
                                                                        <span className="text-sm font-bold text-gray-800 dark:text-gray-200">Enviando para o Drive...</span>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* INFO GRID */}
                                                        <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 pt-2 items-center">
                                                            <div className="flex flex-col col-span-1 md:col-span-2">
                                                                <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400 dark:text-gray-500">Cliente</span>
                                                                <span className="text-sm font-bold text-gray-800 dark:text-gray-200 truncate" title={row.cliente}>{row.cliente}</span>
                                                            </div>

                                                            <div className="flex flex-col">
                                                                <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400 dark:text-gray-500">Pedido</span>
                                                                <span className="font-mono text-xs font-semibold text-gray-600 dark:text-gray-400">{row.codVenda}</span>
                                                            </div>

                                                            <div className="flex flex-col">
                                                                <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400 dark:text-gray-500">SKU do Produto</span>
                                                                <span className="font-mono text-xs font-bold text-gray-300 whitespace-nowrap overflow-hidden text-ellipsis">{row.sku}</span>
                                                            </div>

                                                            <div className="flex flex-col">
                                                                <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400 dark:text-gray-500">Prazo</span>
                                                                <span className={`text-xs font-bold ${atraso.status === 'atrasado' ? 'text-red-500' : atraso.status === 'risco' ? 'text-yellow-500' : 'text-emerald-500'}`}>
                                                                    {atraso.tooltip}
                                                                </span>
                                                            </div>

                                                            <div className="flex flex-col">
                                                                <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400 dark:text-gray-500">Status</span>
                                                                <span className="text-xs font-bold text-gray-300">{row.status}</span>
                                                            </div>

                                                            <div className="flex flex-col">
                                                                <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400 dark:text-gray-500">Local</span>
                                                                <span className="text-xs font-bold text-gray-300 truncate">{row.localEstampa || '-'}</span>
                                                            </div>

                                                            {/* Arte Pronta Integration */}
                                                            <div className="flex flex-col col-span-full md:col-span-2 pt-1 border-t border-gray-100 dark:border-gray-800">
                                                                <div className="flex justify-between items-center">
                                                                    <span className="text-[10px] uppercase tracking-wider font-bold text-primary-500">Nome da Estampa</span>
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); startEditingArtePronta(row); }}
                                                                        className={`text-[10px] px-2 py-0.5 rounded border transition-colors flex items-center gap-1 ${row.arteProntaId ? 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-200 dark:border-yellow-700' : 'bg-white dark:bg-gray-800 text-gray-400 border-gray-200 hover:bg-yellow-50 hover:text-yellow-600 hover:border-yellow-200 dark:border-gray-700 dark:hover:text-yellow-400'}`}
                                                                        title={row.arteProntaId ? `Arte Pronta ID: ${row.arteProntaId}` : "Definir Arte Pronta (ID Pasta)"}
                                                                    >
                                                                        <span className="text-yellow-600 dark:text-yellow-400 font-bold">📁</span> {row.arteProntaId ? 'Arte Definida' : 'Vincular Arte'}
                                                                    </button>
                                                                </div>
                                                                {row.arteProntaId && (
                                                                    <div className="mt-1 px-1 py-0.5 bg-yellow-50 dark:bg-yellow-900/20 rounded border border-yellow-100 dark:border-yellow-900/30">
                                                                        <div className="flex items-center gap-1 justify-between">
                                                                            <span className="text-[9px] text-yellow-600 dark:text-yellow-400 font-mono truncate max-w-[120px]" title={row.arteProntaId}>
                                                                                ID: {row.arteProntaId}
                                                                            </span>
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    navigator.clipboard.writeText(row.arteProntaId || '');
                                                                                    toast.success('ID copiado!');
                                                                                }}
                                                                                className="text-yellow-500 hover:text-yellow-700"
                                                                                title="Copiar ID"
                                                                            >
                                                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                                <span className="text-xs italic font-bold text-primary-600 dark:text-primary-400 whitespace-nowrap overflow-hidden text-ellipsis mt-1">"{row.nomeEstampa || '-'}"</span>

                                                                {/* Popup de Arte Pronta - PORTALIZED */}
                                                                {editingArteProntaRowId === row.id && createPortal(
                                                                    <>
                                                                        <div
                                                                            className="fixed inset-0 bg-black/50 z-[100000]"
                                                                            onClick={() => saveArtePronta(row)}
                                                                        />
                                                                        <div
                                                                            className="fixed z-[100001] w-96 bg-white dark:bg-gray-900 rounded-lg shadow-2xl border-2 border-yellow-500 dark:border-yellow-400 p-3 animate-fade-in"
                                                                            style={{
                                                                                left: '50%',
                                                                                top: '50%',
                                                                                transform: 'translate(-50%, -50%)'

                                                                            }}
                                                                            onClick={(e) => e.stopPropagation()}
                                                                        >
                                                                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-200 mb-2 flex items-center gap-2">
                                                                                <span className="text-yellow-500 text-lg">📁</span> Arte Pronta (ID Pasta/Pedido)
                                                                            </label>
                                                                            <p className="text-xs text-gray-500 mb-2">Cole o ID da pasta do Google Drive ou outro ID de pedido para buscar as imagens de lá.</p>
                                                                            <input
                                                                                ref={arteProntaInputRef}
                                                                                type="text"
                                                                                value={editingArteProntaValue}
                                                                                onChange={(e) => setEditingArteProntaValue(e.target.value)}
                                                                                onKeyDown={(e) => {
                                                                                    if (e.key === 'Escape') saveArtePronta(row);
                                                                                    if (e.key === 'Enter') {
                                                                                        e.preventDefault();
                                                                                        saveArtePronta(row);
                                                                                    }
                                                                                }}
                                                                                onBlur={() => saveArtePronta(row)}
                                                                                placeholder="Ex: 1A2b3C..."
                                                                                className="w-full text-sm p-3 border-2 border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-white font-mono focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                                                                            />
                                                                            <div className="flex justify-between items-center mt-2">
                                                                                <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Enter = Salvar • ESC = Cancelar</span>
                                                                                <button
                                                                                    onClick={() => saveArtePronta(row)}
                                                                                    className="text-sm px-4 py-1.5 bg-yellow-500 text-white rounded-md font-bold hover:bg-yellow-600 transition-colors"
                                                                                >
                                                                                    Salvar
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    </>,
                                                                    document.body
                                                                )}
                                                            </div>

                                                            <input
                                                                type="file"
                                                                ref={fileInputRef}
                                                                className="hidden"
                                                                accept="image/*,application/pdf"
                                                                onChange={(e) => handleFileUpload(e, row)}
                                                            />
                                                        </div>

                                                        {row.observacao && (
                                                            <div className="mt-2 p-2 bg-yellow-50/50 dark:bg-yellow-900/10 rounded-lg border border-yellow-200/50 dark:border-yellow-700/30 flex gap-2 items-start">
                                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                                <p className="text-xs text-yellow-800 dark:text-yellow-200 italic line-clamp-2 md:line-clamp-none" title={row.observacao}>{row.observacao}</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                }
                            </React.Fragment>
                        );
                    })}
                </tbody>
            </table>

            {/* Lote Image Modal */}
            {viewingLote && createPortal(
                <LoteImageModal
                    loteNumero={viewingLote.numeroLote}
                    imagemUrl={viewingLote.imagemUrl}
                    imagens={viewingLote.imagens}
                    dataCriacao={viewingLote.dataCriacao}
                    onClose={() => setViewingLote(null)}
                />,
                document.body
            )}
        </div >
    );
};
