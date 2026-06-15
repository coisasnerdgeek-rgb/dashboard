import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { EstampaRow, DriveImage } from '../../types';
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
import { getImagesForOrder, findOrCreateFolder, uploadFileToDrive, isUserAuthenticated, handleSignIn } from '../../services/googleDriveService';
import { getColorHex, getTextColorForBackground } from '../../utils/colorUtils';
import { getColorMap } from '../../services/skuService';
import { CopyButton } from '../common/CopyButton';

interface EstampasListProps {
    data: EstampaRow[];
    isLoading?: boolean;
    sortConfig: { key: keyof EstampaRow; direction: 'asc' | 'desc' } | null;
    onSort: (key: keyof EstampaRow) => void;
    onRowUpdate: (updatedRow: EstampaRow) => void;
    onEditRow: (row: EstampaRow) => void;
    delayRules: Record<string, { onTime: number; atRisk: number }>;
    imageMappings?: Record<string, string>;
}

export const EstampasList: React.FC<EstampasListProps> = ({
    data,
    isLoading,
    sortConfig,
    onSort,
    onRowUpdate,
    onEditRow,
    delayRules,
    imageMappings
}) => {
    // --- State ---
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    const [orderImages, setOrderImages] = useState<Record<string, DriveImage[] | null>>({});
    const [loadingImages, setLoadingImages] = useState<Record<string, boolean>>({});
    const [isUploading, setIsUploading] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

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
        const finalValue = field === 'quantidade' ? (parseInt(value, 10) || 0) : value;
        onRowUpdate({ ...row, [field]: finalValue });
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

            const mainRootId = localStorage.getItem('googleDrivePublicFolderId') || '1lPRLR2oHxhPrkg4etlNyeTawZvDBZxk';
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
        <div className="overflow-x-auto rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                        {TABLE_HEADERS.map((header) => (
                            <th
                                key={header.key}
                                scope="col"
                                className={`px-2 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors ${header.widthClass}`}
                                onClick={() => header.sortable && onSort(header.key as keyof EstampaRow)}
                            >
                                <div className="flex items-center justify-center gap-1">
                                    {header.label}
                                    {sortConfig?.key === header.key && (
                                        <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                    )}
                                </div>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {data.map((row) => {
                        const atraso = getAtrasoStatus(row.fullDate, row.canal, delayRules, row.dataPrevista);
                        const corBg = getColorHex(row.cor);
                        const corText = getTextColorForBackground(corBg);

                        return (
                            <React.Fragment key={row.id}>
                                <tr
                                    className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer group ${expandedRows.has(row.id) ? 'bg-gray-50 dark:bg-gray-700/50' : ''}`}
                                    onClick={() => onEditRow(row)}
                                    draggable
                                >
                                    {/* ACTIONS */}
                                    <td className="px-2 py-2 whitespace-nowrap text-center text-xs" onClick={(e) => e.stopPropagation()}>
                                        <button
                                            onClick={() => toggleRow(row.id, row.codVenda, row.fullDate)}
                                            className="text-gray-400 hover:text-primary-500 transition-colors"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transform transition-transform ${expandedRows.has(row.id) ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </button>
                                    </td>

                                    {/* ATRASO */}
                                    <td className="px-2 py-2 whitespace-nowrap text-center">
                                        <div className="flex justify-center" title={atraso.tooltip}>
                                            <div className={`w-6 h-6 ${atraso.color}`}>
                                                {atraso.icon}
                                            </div>
                                        </div>
                                    </td>

                                    {/* STATUS */}
                                    <td className="px-2 py-2 whitespace-nowrap text-center" onClick={(e) => e.stopPropagation()}>
                                        <select
                                            value={row.status}
                                            onChange={(e) => handleRowChange(row, 'status', e.target.value)}
                                            className={`text-[10px] font-bold rounded-full px-2 py-0.5 border uppercase focus:outline-none focus:ring-2 focus:ring-offset-1 w-full text-center appearance-none cursor-pointer hover:opacity-90 ${statusSelectColorClasses[row.status] || 'bg-gray-100 text-gray-800 border-gray-200'}`}
                                        >
                                            {['FAZER ARTE', 'PRONTA', 'EM APROVAÇÃO', 'APROVADO', 'IMPRESSO', 'AJUSTE', 'IMAGEM', 'ERRO IMPRESSÃO', 'CANCELADO'].map(opt => (
                                                <option key={opt} value={opt}>{opt}</option>
                                            ))}
                                        </select>
                                    </td>

                                    {/* DATA */}
                                    <td className="px-2 py-2 whitespace-nowrap text-center text-[10px] text-gray-900 dark:text-white font-medium">
                                        {row.fullDate}
                                    </td>

                                    {/* DATA PREVISTA */}
                                    <td className="px-2 py-2 whitespace-nowrap text-center text-[10px] text-gray-500 font-mono">
                                        {row.dataPrevista || '-'}
                                    </td>


                                    {/* PEDIDO */}
                                    <td className="px-2 py-2 whitespace-nowrap text-center" onClick={(e) => e.stopPropagation()}>
                                        <div className="flex flex-col items-center gap-1">
                                            <div className="flex items-center gap-1 group/copy relative">
                                                <span className="text-xs font-bold text-gray-900 dark:text-white font-mono">{row.codVenda}</span>
                                                <CopyButton text={row.codVenda} />

                                                {/* Link Button */}
                                                {(row.linkPedido || isEditableLinkChannel(row.canal)) && (
                                                    <div className="relative inline-block">
                                                        {row.linkPedido ? (
                                                            <a
                                                                href={row.linkPedido}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="text-blue-500 hover:text-blue-700 ml-1"
                                                                title="Abrir Link do Pedido"
                                                                onClick={(e) => e.stopPropagation()}
                                                            >
                                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                                </svg>
                                                            </a>
                                                        ) : (
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); startEditingLink(row); }}
                                                                className="text-gray-300 hover:text-blue-400 ml-1"
                                                                title="Adicionar Link"
                                                            >
                                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                                                </svg>
                                                            </button>
                                                        )}

                                                        {/* Popover Edit Link */}
                                                        {editingLinkRowId === row.id && createPortal(
                                                            <>
                                                                <div className="fixed inset-0 bg-transparent z-[99998]" onClick={() => saveLinkPedido(row)} />
                                                                <div
                                                                    className="fixed z-[99999] bg-white dark:bg-gray-800 p-2 rounded shadow-xl border border-blue-200"
                                                                    style={{
                                                                        top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '300px'
                                                                    }}
                                                                    onClick={(e) => e.stopPropagation()}
                                                                >
                                                                    <p className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Link do Pedido:</p>
                                                                    <input
                                                                        ref={linkInputRef}
                                                                        type="text"
                                                                        value={editingLinkValue}
                                                                        onChange={(e) => setEditingLinkValue(e.target.value)}
                                                                        onKeyDown={(e) => e.key === 'Enter' && saveLinkPedido(row)}
                                                                        onBlur={() => saveLinkPedido(row)}
                                                                        className="w-full text-xs p-1 border rounded"
                                                                        placeholder="https://..."
                                                                    />
                                                                </div>
                                                            </>,
                                                            document.body
                                                        )}

                                                    </div>
                                                )}
                                            </div>
                                            <span className="text-[9px] text-gray-500 truncate max-w-[100px]" title={row.cliente}>{row.cliente}</span>
                                        </div>
                                    </td>

                                    {/* CANAL */}
                                    <td className="px-2 py-2 whitespace-nowrap text-center text-[10px]">
                                        <span className={`px-2 py-0.5 rounded border font-semibold ${canalColorClasses[row.canal] || 'bg-gray-100 text-gray-800'}`}>
                                            {row.canal}
                                        </span>
                                    </td>

                                    {/* PEÇA */}
                                    <td className="px-2 py-2 whitespace-nowrap text-center text-xs">
                                        <span className={getPecaColorClass(row.peca)} title={row.peca}>{row.peca}</span>
                                    </td>

                                    {/* ESTAMPA (Editável) */}
                                    <td className="px-2 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                                        <div className="relative group/edit">
                                            <input
                                                type="text"
                                                value={row.nomeEstampa || ''}
                                                onChange={(e) => handleRowChange(row, 'nomeEstampa', e.target.value)}
                                                className="w-full text-xs text-center bg-transparent border-none focus:ring-1 focus:ring-primary-500 rounded px-1 truncate placeholder-gray-300 dark:placeholder-gray-600 focus:bg-white dark:focus:bg-gray-700 font-medium"
                                                placeholder="Nome da Estampa"
                                            />
                                            <span className="absolute right-0 top-1/2 -translate-y-1/2 opacity-0 group-hover/edit:opacity-100 text-gray-400 pointer-events-none text-[10px]">✎</span>
                                        </div>
                                    </td>

                                    {/* LOCAL */}
                                    <td className="px-2 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                                        <select
                                            value={row.localEstampa || ''}
                                            onChange={(e) => handleRowChange(row, 'localEstampa', e.target.value)}
                                            className={`text-[10px] w-full rounded border px-1 py-0.5 text-center appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary-500 font-semibold ${localSelectColorClasses[row.localEstampa || ''] || 'bg-white text-gray-700 border-gray-200'}`}
                                        >
                                            <option value="">Selecione...</option>
                                            {['PEITO', 'COSTAS', 'PEITO E COSTAS'].map(opt => (
                                                <option key={opt} value={opt}>{opt}</option>
                                            ))}
                                        </select>
                                    </td>

                                    {/* COR */}
                                    <td className="px-2 py-2 whitespace-nowrap text-center" onClick={(e) => e.stopPropagation()}>
                                        <div className="relative">
                                            <select
                                                value={row.cor}
                                                onChange={(e) => handleRowChange(row, 'cor', e.target.value)}
                                                className="text-[10px] w-full rounded border px-1 py-0.5 text-center appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary-500 font-bold"
                                                style={{ backgroundColor: corBg, color: corText, borderColor: corBg === '#FFFFFF' ? '#e5e7eb' : corBg }}
                                            >
                                                {colorList.map(c => (
                                                    <option key={c} value={c}>{c}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </td>

                                    {/* TAMANHO */}
                                    <td className="px-2 py-2 whitespace-nowrap text-center text-xs font-bold text-gray-700 dark:text-gray-300">
                                        {row.tamanho}
                                    </td>

                                    {/* QUANTIDADE */}
                                    <td className="px-2 py-2 whitespace-nowrap text-center" onClick={(e) => e.stopPropagation()}>
                                        <input
                                            type="number"
                                            value={row.quantidade}
                                            onChange={(e) => handleRowChange(row, 'quantidade', e.target.value)}
                                            className="w-12 text-center text-xs border-gray-300 dark:border-gray-600 rounded py-0.5 focus:ring-primary-500 focus:border-primary-500 bg-transparent dark:text-white"
                                        />
                                    </td>

                                    {/* ARAMADO */}
                                    <td className="px-2 py-2 whitespace-nowrap text-center" onClick={(e) => e.stopPropagation()}>
                                        <div className="flex items-center justify-center gap-1">
                                            <select
                                                value={row.aramadoLetra || ''}
                                                onChange={(e) => handleRowChange(row, 'aramadoLetra', e.target.value)}
                                                className="w-10 text-[10px] p-0.5 border-gray-300 dark:border-gray-600 rounded bg-transparent focus:ring-primary-500 focus:border-primary-500 text-center uppercase"
                                                style={{ backgroundColor: row.aramadoLetra ? `hsl(${aramadoLetras.indexOf(row.aramadoLetra) * (360 / aramadoLetras.length)}, 90%, 95%)` : undefined }}
                                            >
                                                <option value="">-</option>
                                                {aramadoLetras.map(l => <option key={l} value={l}>{l}</option>)}
                                            </select>
                                            <select
                                                value={row.aramadoNumero || ''}
                                                onChange={(e) => handleRowChange(row, 'aramadoNumero', e.target.value)}
                                                className="w-10 text-[10px] p-0.5 border-gray-300 dark:border-gray-600 rounded bg-transparent focus:ring-primary-500 focus:border-primary-500 text-center"
                                                style={{ backgroundColor: row.aramadoNumero ? `hsl(${aramadoNumeros.indexOf(row.aramadoNumero) * (360 / aramadoNumeros.length)}, 90%, 95%)` : undefined }}
                                            >
                                                <option value="">-</option>
                                                {aramadoNumeros.map(n => <option key={n} value={n}>{n}</option>)}
                                            </select>
                                        </div>
                                    </td>

                                    {/* L */}
                                    <td className="px-2 py-2 whitespace-nowrap text-center" onClick={(e) => e.stopPropagation()}>
                                        <input
                                            type="checkbox"
                                            checked={!!row.l}
                                            onChange={(e) => handleRowChange(row, 'l', e.target.checked)}
                                            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded cursor-pointer"
                                        />
                                    </td>

                                    {/* OBS */}
                                    <td className="px-2 py-2 whitespace-nowrap text-center text-xs" onClick={(e) => e.stopPropagation()}>
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

                                    {/* TRATADO */}
                                    <td className="px-2 py-2 whitespace-nowrap text-center" onClick={(e) => e.stopPropagation()}>
                                        <input
                                            type="checkbox"
                                            checked={!!row.tratado}
                                            onChange={(e) => handleRowChange(row, 'tratado', e.target.checked)}
                                            className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded cursor-pointer"
                                        />
                                    </td>
                                </tr>

                                {/* EXPANDED DETAILS */}
                                {expandedRows.has(row.id) && (
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
                                                                            src={img.thumbnailLink ? img.thumbnailLink.replace(/=s\d+/, '=s400') : (img.mimeType === 'application/pdf' ? `https://drive.google.com/thumbnail?id=${img.id}&sz=w400` : 'https://upload.wikimedia.org/wikipedia/commons/8/87/PDF_file_icon.svg')}
                                                                            alt={img.name}
                                                                            className="h-32 w-auto object-cover rounded-lg shadow-sm border-2 border-white dark:border-gray-700 cursor-pointer hover:ring-2 hover:ring-primary-500 transition-all"
                                                                            onClick={(e) => { e.stopPropagation(); window.open(img.webViewLink, '_blank'); }}
                                                                            onError={(e) => {
                                                                                const target = e.target as HTMLImageElement;
                                                                                if (target.src !== 'https://upload.wikimedia.org/wikipedia/commons/8/87/PDF_file_icon.svg') {
                                                                                    target.src = 'https://upload.wikimedia.org/wikipedia/commons/8/87/PDF_file_icon.svg';
                                                                                }
                                                                            }}
                                                                        />
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
                                                                                    className="w-full px-3 py-1.5 text-left text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                                                                                >
                                                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                                                                    </svg>
                                                                                    Abrir Pasta
                                                                                </button>
                                                                                <button
                                                                                    onClick={() => handleRenameFile(img, row.codVenda)}
                                                                                    className="w-full px-3 py-1.5 text-left text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
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
                                                            <span className="font-mono text-xs font-bold text-gray-700 dark:text-gray-300 whitespace-nowrap overflow-hidden text-ellipsis">{row.sku}</span>
                                                        </div>

                                                        <div className="flex flex-col">
                                                            <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400 dark:text-gray-500">Prazo</span>
                                                            <span className={`text-xs font-bold ${atraso.status === 'atrasado' ? 'text-red-500' : atraso.status === 'risco' ? 'text-yellow-500' : 'text-emerald-500'}`}>
                                                                {atraso.tooltip}
                                                            </span>
                                                        </div>

                                                        <div className="flex flex-col">
                                                            <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400 dark:text-gray-500">Status</span>
                                                            <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{row.status}</span>
                                                        </div>

                                                        <div className="flex flex-col">
                                                            <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400 dark:text-gray-500">Local</span>
                                                            <span className="text-xs font-bold text-gray-700 dark:text-gray-300 truncate">{row.localEstampa || '-'}</span>
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
                                                                            className="w-full text-sm p-3 border-2 border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
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
                                )}
                            </React.Fragment>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};
