
import * as React from 'react';
import { parseSpreadsheet } from '../services/spreadsheetService';
import { ImageCategory } from '../types';
import ImagemDashboard from './ImagemDashboard';

interface ImagemProps {
    onImageUpload: (newMappings: Record<string, string>) => void;
    imageMappings: Record<string, string>;
    imageCategories: ImageCategory[];
    onAddCategory: (category: ImageCategory) => void;
    onDeleteCategory: (categoryId: string) => void;
    imageCategoryAssignments: Record<string, string | null>;
    onAssignImageToCategory: (imageId: string, categoryId: string | null) => void;
    onRenameCategory: (categoryId: string, newName: string) => void;
    onBulkAssignImagesToCategory: (assignments: Record<string, string | null>) => void;
    filteredOrders?: any[];
    activeTab?: 'dashboard' | 'gerenciar';
    onDeleteImage: (imageIds: string[]) => void;
}

const Imagem: React.FC<ImagemProps> = ({
    onImageUpload,
    imageMappings,
    imageCategories,
    onAddCategory,
    onDeleteCategory,
    onRenameCategory,
    imageCategoryAssignments,
    onAssignImageToCategory,
    onBulkAssignImagesToCategory,
    filteredOrders = [],
    activeTab: propActiveTab,
    onDeleteImage
}) => {
    const [activeTab, setActiveTab] = React.useState<'dashboard' | 'gerenciar'>('dashboard');
    const [isLoading, setIsLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [isDragging, setIsDragging] = React.useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    // Sync activeTab prop with state
    React.useEffect(() => {
        if (propActiveTab && (propActiveTab === 'dashboard' || propActiveTab === 'gerenciar')) {
            setActiveTab(propActiveTab);
        }
    }, [propActiveTab]);

    // Read activeTab from localStorage (set by ViewSwitcher dropdown)
    React.useEffect(() => {
        const savedTab = localStorage.getItem('imagem_activeTab');
        if (savedTab && (savedTab === 'dashboard' || savedTab === 'gerenciar')) {
            setActiveTab(savedTab);
            // Clear after reading
            localStorage.removeItem('imagem_activeTab');
        }
    }, []);

    // New state for features
    const [searchTerm, setSearchTerm] = React.useState('');
    const [selectedCategoryId, setSelectedCategoryId] = React.useState<string | null>('all'); // 'all', 'uncategorized', or a categoryId
    const [selectedImageIds, setSelectedImageIds] = React.useState<Set<string>>(new Set());
    const [newCategoryName, setNewCategoryName] = React.useState('');
    const [newSubcategoryParent, setNewSubcategoryParent] = React.useState<string | null>(null); // For creating subcategories
    const [expandedCategories, setExpandedCategories] = React.useState<Set<string>>(new Set()); // Track expanded categories

    const [lastSelectedId, setLastSelectedId] = React.useState<string | null>(null);
    const [isSelecting, setIsSelecting] = React.useState(false);
    const [selectionStart, setSelectionStart] = React.useState<{ x: number, y: number } | null>(null);
    const [selectionEnd, setSelectionEnd] = React.useState<{ x: number, y: number } | null>(null);
    const containerRef = React.useRef<HTMLDivElement>(null);
    const [editingCategoryId, setEditingCategoryId] = React.useState<string | null>(null);
    const [editingCategoryName, setEditingCategoryName] = React.useState('');
    const [showOnlyMatch, setShowOnlyMatch] = React.useState(false);

    const filteredOrderIds = React.useMemo(() => {
        // Extract all unique SKUs from filtered orders
        const skus = new Set<string>();
        filteredOrders.forEach(order => {
            // Get SKU from order - try common field names
            const sku = String(order['SKU'] || order['sku'] || order['Produto'] || order['produto'] || '').trim();
            if (sku) {
                skus.add(sku);
            }
        });
        return skus;
    }, [filteredOrders]);

    const handleFileUpload = async (files: FileList) => {
        setIsLoading(true);
        setError(null);
        const newMappings: Record<string, string> = {};
        let anyError: string | null = null;

        for (const file of Array.from(files)) {
            try {
                const { data: fileData, headers: fileHeaders } = await parseSpreadsheet(file);
                const orderIdHeader = fileHeaders.find(h => h.toLowerCase().includes('venda') || h.toLowerCase().includes('pedido') || h.toLowerCase().includes('ordem')) || fileHeaders[0];
                const imageUrlHeader = fileHeaders.find(h => h.toLowerCase().includes('imagem') || h.toLowerCase().includes('url') || h.toLowerCase().includes('link')) || fileHeaders[1];

                if (!orderIdHeader || !imageUrlHeader) throw new Error("Planilha deve conter colunas para ID do Pedido e URL da Imagem.");

                fileData.forEach(row => {
                    const orderId = String(row[orderIdHeader] ?? '').trim();
                    const imageUrl = String(row[imageUrlHeader] ?? '').trim();
                    if (orderId && imageUrl) newMappings[orderId] = imageUrl;
                });

            } catch (err) {
                const message = err instanceof Error ? err.message : 'Ocorreu um erro desconhecido.';
                anyError = (anyError ? anyError + '\n' : '') + `Erro no arquivo ${file.name}: ${message}`;
            }
        }

        if (Object.keys(newMappings).length > 0) onImageUpload(newMappings);
        if (anyError) setError(anyError);
        setIsLoading(false);
    };

    // Drag & Drop Handlers
    const handleDragEnter = React.useCallback((e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }, []);
    const handleDragLeave = React.useCallback((e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }, []);
    const handleDragOver = React.useCallback((e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); }, []);
    const handleDrop = React.useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) handleFileUpload(e.dataTransfer.files);
    }, [handleFileUpload]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            handleFileUpload(e.target.files);
            e.target.value = '';
        }
    };

    const triggerFileUpload = () => fileInputRef.current?.click();

    // Feature Handlers
    const handleCreateCategory = () => {
        const name = newCategoryName.trim();
        if (name && !imageCategories.some(c => c.name.toLowerCase() === name.toLowerCase() && c.parentId === newSubcategoryParent)) {
            const newCategory: ImageCategory = {
                id: `cat-${Date.now()}`,
                name,
                parentId: newSubcategoryParent || null
            };
            onAddCategory(newCategory);
            setNewCategoryName('');
            setNewSubcategoryParent(null);
        }
    };

    const handleDeleteCategory = (categoryId: string) => {
        onDeleteCategory(categoryId);
    };

    const handleStartRename = (category: ImageCategory) => {
        setEditingCategoryId(category.id);
        setEditingCategoryName(category.name);
    };

    const handleFinishRename = async () => {
        if (editingCategoryId && editingCategoryName.trim()) {
            onRenameCategory(editingCategoryId, editingCategoryName.trim());
            setEditingCategoryId(null);
            setEditingCategoryName('');
        } else {
            setEditingCategoryId(null);
        }
    };

    const handleImageSelection = (e: React.MouseEvent, imageId: string) => {
        e.stopPropagation(); // Prevent container click
        const newSelection = new Set(selectedImageIds);

        if (e.shiftKey && lastSelectedId) {
            const currentIndex = imagesToDisplay.indexOf(imageId);
            const lastIndex = imagesToDisplay.indexOf(lastSelectedId);

            if (currentIndex !== -1 && lastIndex !== -1) {
                const start = Math.min(currentIndex, lastIndex);
                const end = Math.max(currentIndex, lastIndex);

                for (let i = start; i <= end; i++) {
                    newSelection.add(imagesToDisplay[i]);
                }
            }
        } else if (e.ctrlKey || e.metaKey) {
            if (newSelection.has(imageId)) {
                newSelection.delete(imageId);
            } else {
                newSelection.add(imageId);
            }
            setLastSelectedId(imageId);
        } else {
            // Normal click - select only this one (or toggle if already selected? usually normal click selects only one)
            // But for bulk actions, maybe toggle is better? Let's stick to standard: click selects one and clears others unless ctrl is held.
            // Wait, user asked for shift click.
            if (newSelection.has(imageId) && newSelection.size === 1) {
                newSelection.delete(imageId);
                setLastSelectedId(null);
            } else {
                newSelection.clear();
                newSelection.add(imageId);
                setLastSelectedId(imageId);
            }
        }

        setSelectedImageIds(newSelection);
    };

    const handleMoveSelectedToCategory = (categoryId: string | null) => {
        const assignments: Record<string, string | null> = {};
        selectedImageIds.forEach(id => {
            assignments[id] = categoryId;
        });
        onBulkAssignImagesToCategory(assignments);
        setSelectedImageIds(new Set());
        setLastSelectedId(null);
    };

    const handleImageDragStart = (e: React.DragEvent<HTMLDivElement>, imageId: string) => {
        e.dataTransfer.setData('text/plain', imageId);
        e.dataTransfer.effectAllowed = 'move';
        // If dragging a selected item, don't clear selection. If dragging an unselected item, select it.
        if (!selectedImageIds.has(imageId)) {
            setSelectedImageIds(new Set([imageId]));
        }
    };

    const handleCategoryDrop = (e: React.DragEvent<HTMLLIElement>, categoryId: string | null) => {
        e.preventDefault();
        const imageId = e.dataTransfer.getData('text/plain');

        if (selectedImageIds.size > 0 && selectedImageIds.has(imageId)) {
            // Move all selected
            handleMoveSelectedToCategory(categoryId);
        } else if (imageId) {
            onAssignImageToCategory(imageId, categoryId);
        }
        e.currentTarget.classList.remove('bg-primary-100', 'dark:bg-primary-900/20');
    };

    const handleCategoryDragOver = (e: React.DragEvent<HTMLLIElement>) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        e.currentTarget.classList.add('bg-primary-100', 'dark:bg-primary-900/20');
    };

    const handleCategoryDragLeave = (e: React.DragEvent<HTMLLIElement>) => {
        e.currentTarget.classList.remove('bg-primary-100', 'dark:bg-primary-900/20');
    };


    const { uncategorized, ...imagesByCategory } = React.useMemo(() => {
        const allImages = Object.keys(imageMappings);
        const grouped: Record<string, string[]> = { uncategorized: [] };
        imageCategories.forEach(c => grouped[c.id] = []);

        allImages.forEach(id => {
            const catId = imageCategoryAssignments[id];
            if (catId && grouped[catId]) {
                grouped[catId].push(id);
            } else {
                grouped.uncategorized.push(id);
            }
        });
        return grouped;
    }, [imageMappings, imageCategories, imageCategoryAssignments]);

    // Organize categories into hierarchical tree structure
    const categoryTree = React.useMemo(() => {
        const rootCategories = imageCategories.filter(c => !c.parentId);
        const getChildren = (parentId: string) => imageCategories.filter(c => c.parentId === parentId);
        const hasChildren = (catId: string) => imageCategories.some(c => c.parentId === catId);

        return { rootCategories, getChildren, hasChildren };
    }, [imageCategories]);

    const imagesToDisplay = React.useMemo(() => {
        let list: string[] = [];
        if (selectedCategoryId === 'all') {
            list = Object.keys(imageMappings);
        } else if (selectedCategoryId === 'uncategorized') {
            list = uncategorized;
        } else if (selectedCategoryId && imagesByCategory[selectedCategoryId]) {
            list = imagesByCategory[selectedCategoryId];
        }

        if (showOnlyMatch) {
            list = list.filter(id => filteredOrderIds.has(id));
        }

        if (searchTerm) {
            const lowerSearch = searchTerm.toLowerCase();
            list = list.filter(id => id.toLowerCase().includes(lowerSearch));
        }

        // Filter out Google Drive images (as requested by user)
        list = list.filter(id => {
            const url = imageMappings[id];
            if (!url) return false;
            if (url.includes('drive.google.com') || url.includes('googleusercontent.com')) return false;
            return true;
        });

        return list;
    }, [selectedCategoryId, imageMappings, uncategorized, imagesByCategory, searchTerm, showOnlyMatch, filteredOrderIds]);

    // Box Selection Logic
    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.target === containerRef.current || (e.target as HTMLElement).classList.contains('grid-container')) {
            setIsSelecting(true);
            const rect = containerRef.current?.getBoundingClientRect();
            if (rect) {
                setSelectionStart({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                setSelectionEnd({ x: e.clientX - rect.left, y: e.clientY - rect.top });
            }
            // Clear selection if not holding shift/ctrl
            if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
                setSelectedImageIds(new Set());
            }
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isSelecting && selectionStart && containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            setSelectionEnd({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        }
    };

    const handleMouseUp = () => {
        if (isSelecting && selectionStart && selectionEnd && containerRef.current) {
            // Calculate selected items
            const selectionRect = {
                left: Math.min(selectionStart.x, selectionEnd.x),
                top: Math.min(selectionStart.y, selectionEnd.y),
                right: Math.max(selectionStart.x, selectionEnd.x),
                bottom: Math.max(selectionStart.y, selectionEnd.y)
            };

            const newSelection = new Set(selectedImageIds);
            const items = containerRef.current.querySelectorAll('[data-image-id]');

            items.forEach(item => {
                const itemRect = item.getBoundingClientRect();
                const containerRect = containerRef.current!.getBoundingClientRect();

                const relativeItem = {
                    left: itemRect.left - containerRect.left,
                    top: itemRect.top - containerRect.top,
                    right: itemRect.right - containerRect.left,
                    bottom: itemRect.bottom - containerRect.top
                };

                if (
                    relativeItem.left < selectionRect.right &&
                    relativeItem.right > selectionRect.left &&
                    relativeItem.top < selectionRect.bottom &&
                    relativeItem.bottom > selectionRect.top
                ) {
                    const id = item.getAttribute('data-image-id');
                    if (id) newSelection.add(id);
                }
            });

            setSelectedImageIds(newSelection);
        }
        setIsSelecting(false);
        setSelectionStart(null);
        setSelectionEnd(null);
    };


    // Recursive component for rendering category tree
    const CategoryTreeItem: React.FC<{ category: ImageCategory; level?: number }> = ({ category, level = 0 }) => {
        const children = categoryTree.getChildren(category.id);
        const hasKids = children.length > 0;
        const isExpanded = expandedCategories.has(category.id);
        const count = imagesByCategory[category.id]?.length || 0;

        const toggleExpand = (e: React.MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            setExpandedCategories(prev => {
                const next = new Set(prev);
                if (next.has(category.id)) {
                    next.delete(category.id);
                } else {
                    next.add(category.id);
                }
                return next;
            });
        };

        return (
            <>
                <li className="group">
                    <div
                        onDrop={(e) => handleCategoryDrop(e, category.id)}
                        onDragOver={handleCategoryDragOver}
                        onDragLeave={handleCategoryDragLeave}
                        className={`flex items-center transition-colors ${level > 0 ? 'pl-6' : ''}`}
                    >
                        <div className={`flex-grow flex justify-between items-center px-3 py-2 text-sm font-medium rounded-md ${selectedCategoryId === category.id ? 'bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
                            <a
                                href="#"
                                onClick={(e) => { e.preventDefault(); setSelectedCategoryId(category.id); }}
                                className="flex-grow truncate flex items-center gap-2"
                            >
                                {hasKids && (
                                    <button onClick={toggleExpand} className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded">
                                        <svg className={`h-3 w-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                                        </svg>
                                    </button>
                                )}
                                <span className={hasKids ? '' : 'ml-5'}>{category.name}</span>
                            </a>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => {
                                        setNewSubcategoryParent(category.id);
                                        setNewCategoryName('');
                                    }}
                                    className="p-1 text-gray-400 hover:text-primary-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                    title="Nova subcategoria"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                                    </svg>
                                </button>
                                <span className={`px-2 py-0.5 rounded-full text-xs ${selectedCategoryId === category.id ? 'bg-primary-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200'}`}>{count}</span>
                            </div>
                        </div>
                        <button onClick={() => handleDeleteCategory(category.id)} className="ml-2 p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" /></svg>
                        </button>
                    </div>
                </li>
                {isExpanded && children.map(child => (
                    <CategoryTreeItem key={child.id} category={child} level={level + 1} />
                ))}
            </>
        );
    };

    const CategoryItem: React.FC<{ id: string | null, name: string, count: number, isEditable?: boolean, category?: ImageCategory }> = ({ id, name, count, isEditable, category }) => {
        const catId = id || 'uncategorized';

        if (isEditable && category && editingCategoryId === category.id) {
            return (
                <li className="px-3 py-2">
                    <input
                        autoFocus
                        type="text"
                        value={editingCategoryName}
                        onChange={e => setEditingCategoryName(e.target.value)}
                        onBlur={handleFinishRename}
                        onKeyDown={e => e.key === 'Enter' && handleFinishRename()}
                        className="w-full px-2 py-1 text-sm rounded-md border border-primary-500 focus:ring-2 focus:ring-primary-500"
                    />
                </li>
            );
        }

        return (
            <li
                onDrop={(e) => handleCategoryDrop(e, id)}
                onDragOver={handleCategoryDragOver}
                onDragLeave={handleCategoryDragLeave}
                className="transition-colors group/item"
            >
                <div className={`flex justify-between items-center px-3 py-2 text-sm font-medium rounded-md ${selectedCategoryId === catId ? 'bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
                    <a
                        href="#"
                        onClick={(e) => { e.preventDefault(); setSelectedCategoryId(catId); }}
                        className="flex-grow truncate flex items-center gap-2"
                    >
                        <span className="truncate">{name}</span>
                    </a>
                    <div className="flex items-center gap-2">
                        {isEditable && category && (
                            <button
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleStartRename(category);
                                }}
                                className="p-1 text-gray-400 hover:text-primary-600 opacity-0 group-hover/item:opacity-100 transition-opacity"
                                title="Renomear"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                </svg>
                            </button>
                        )}
                        <span className={`px-2 py-0.5 rounded-full text-xs ${selectedCategoryId === catId ? 'bg-primary-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200'}`}>{count}</span>
                    </div>
                </div>
            </li>
        );
    };

    return (
        <div className="animate-fade-in-scale">
            <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
                <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                    <button
                        onClick={() => setActiveTab('dashboard')}
                        className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'dashboard' ? 'border-primary-500 text-primary-600 dark:text-primary-400' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:hover:text-gray-300 dark:hover:border-gray-600'}`}
                    >
                        Dashboard
                    </button>
                    <button
                        onClick={() => setActiveTab('gerenciar')}
                        className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'gerenciar' ? 'border-primary-500 text-primary-600 dark:text-primary-400' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:hover:text-gray-300 dark:hover:border-gray-600'}`}
                    >
                        Gerenciar Imagens
                    </button>
                </nav>
            </div>

            {activeTab === 'dashboard' && (
                <ImagemDashboard
                    imageMappings={imageMappings}
                    imageCategories={imageCategories}
                    imageCategoryAssignments={imageCategoryAssignments}
                />
            )}

            {activeTab === 'gerenciar' && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} multiple className="hidden" accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" />

                    {/* Sidebar */}
                    <aside className="md:col-span-1 space-y-4 sticky top-[140px] h-fit">
                        <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border dark:border-gray-700 max-h-[calc(100vh-200px)] overflow-y-auto">
                            <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-2 px-1">Categorias</h3>
                            <ul className="space-y-1">
                                <CategoryItem id="all" name="Todas as Imagens" count={Object.keys(imageMappings).length} />
                                <CategoryItem id={null} name="Não Categorizadas" count={uncategorized.length} />
                                {categoryTree.rootCategories.map(cat => (
                                    <CategoryTreeItem key={cat.id} category={cat} />
                                ))}
                            </ul>
                            <div className="mt-4 pt-4 border-t dark:border-gray-700">
                                {newSubcategoryParent && (
                                    <div className="mb-3 text-xs text-gray-500 dark:text-gray-400">
                                        Subcategoria de: <strong>{imageCategories.find(c => c.id === newSubcategoryParent)?.name}</strong>
                                        <button onClick={() => setNewSubcategoryParent(null)} className="ml-2 text-red-500 hover:text-red-700">✕</button>
                                    </div>
                                )}
                                <div className="flex gap-2">
                                    <input type="text" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreateCategory()} placeholder={newSubcategoryParent ? "Nova subcategoria..." : "Nova categoria..."} className="flex-grow w-full px-3 py-1.5 text-sm rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:ring-1 focus:ring-primary-500 focus:border-primary-500" />
                                    <button onClick={handleCreateCategory} className="px-3 py-1.5 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 text-xs font-semibold rounded-md hover:bg-gray-300 dark:hover:bg-gray-500">Criar</button>
                                </div>
                            </div>
                        </div>
                        <div
                            onDragEnter={handleDragEnter} onDragLeave={handleDragLeave} onDragOver={handleDragOver} onDrop={handleDrop}
                            className={`relative block w-full rounded-lg border-2 border-dashed p-6 text-center transition-colors duration-200 ${isDragging ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'}`}
                        >
                            <svg className="mx-auto h-10 w-10 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48"><path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                                Arraste e solte ou{' '}
                                <button onClick={triggerFileUpload} className="font-medium text-primary-600 hover:text-primary-500 focus:outline-none">
                                    clique para carregar
                                </button>
                            </p>
                        </div>
                    </aside>

                    {/* Main Content */}
                    <main
                        onDragEnter={handleDragEnter} onDragLeave={handleDragLeave} onDragOver={handleDragOver} onDrop={handleDrop}
                        className={`md:col-span-3 rounded-lg transition-colors duration-200 ${isDragging ? 'ring-4 ring-primary-500 ring-offset-4 dark:ring-offset-gray-900' : ''}`}
                    >
                        <div className="relative mb-4 sticky top-[140px] z-20 bg-white dark:bg-gray-900 py-3">
                            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" /></svg>
                            </div>
                            <input type="search" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Buscar por ID do pedido..." className="block w-full h-11 pl-10 pr-48 py-2 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 rounded-lg transition-all" />
                            <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                                <button
                                    onClick={() => setShowOnlyMatch(!showOnlyMatch)}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all ${showOnlyMatch ? 'bg-primary-600 text-white shadow-md' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'}`}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${showOnlyMatch ? 'animate-pulse' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                                    </svg>
                                    SKU-MATCH: {showOnlyMatch ? 'ATIVO' : 'DESATIVADO'}
                                </button>
                            </div>
                        </div>

                        {selectedImageIds.size > 0 && (
                            <div className="flex items-center gap-4 p-2 mb-4 bg-primary-100 dark:bg-primary-900/50 rounded-lg animate-fade-in-scale sticky top-44 z-10 shadow-md">
                                <span className="font-semibold text-sm text-primary-800 dark:text-primary-200">{selectedImageIds.size} selecionada(s)</span>
                                <select onChange={e => handleMoveSelectedToCategory(e.target.value === 'uncategorized' ? null : e.target.value)} className="w-48 p-1.5 text-sm rounded-md bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:ring-1 focus:ring-primary-500">
                                    <option>Mover para...</option>
                                    <option value="uncategorized">Não Categorizadas</option>
                                    <option disabled>---</option>
                                    {imageCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                                <button
                                    onClick={() => {
                                        if (confirm(`Tem certeza que deseja deletar ${selectedImageIds.size} imagem(ns)?`)) {
                                            onDeleteImage(Array.from(selectedImageIds));
                                            setSelectedImageIds(new Set());
                                        }
                                    }}
                                    className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-full"
                                    title="Deletar Selecionadas"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" /></svg>
                                </button>
                                <button onClick={() => setSelectedImageIds(new Set())} className="ml-auto p-1.5 text-primary-700 dark:text-primary-300 hover:bg-black/10 rounded-full">
                                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                        )}

                        <div
                            ref={containerRef}
                            onMouseDown={handleMouseDown}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                            onMouseLeave={handleMouseUp}
                            className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 rounded-lg transition-colors p-1 relative grid-container select-none`}
                        >
                            {isSelecting && selectionStart && selectionEnd && (
                                <div
                                    className="absolute bg-primary-500/20 border border-primary-500 z-30 pointer-events-none"
                                    style={{
                                        left: Math.min(selectionStart.x, selectionEnd.x),
                                        top: Math.min(selectionStart.y, selectionEnd.y),
                                        width: Math.abs(selectionEnd.x - selectionStart.x),
                                        height: Math.abs(selectionEnd.y - selectionStart.y)
                                    }}
                                />
                            )}

                            {imagesToDisplay.map(orderId => (
                                <div
                                    key={orderId}
                                    data-image-id={orderId}
                                    draggable="true"
                                    onDragStart={(e) => handleImageDragStart(e, orderId)}
                                    onClick={(e) => handleImageSelection(e, orderId)}
                                    className={`group relative border dark:border-gray-700 rounded-lg overflow-hidden shadow-sm aspect-square cursor-pointer transition-all duration-200 ${selectedImageIds.has(orderId) ? 'ring-4 ring-primary-500 scale-95' : 'hover:scale-105'}`}
                                >
                                    <img src={imageMappings[orderId]} alt={`Imagem para ${orderId}`} className="h-full w-full object-cover pointer-events-none" onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/150/FF0000/FFFFFF?text=Erro'; }} />
                                    <div className={`absolute inset-0 bg-black/50 transition-opacity flex items-center justify-center ${selectedImageIds.has(orderId) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                                        {selectedImageIds.has(orderId) ? (
                                            <div className="h-8 w-8 rounded-full bg-primary-600 text-white flex items-center justify-center">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                            </div>
                                        ) : (
                                            <div className="flex gap-2">
                                                <div className="h-8 w-8 rounded-full border-2 border-white/50 bg-black/30"></div>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (confirm('Deletar esta imagem?')) {
                                                            onDeleteImage([orderId]);
                                                        }
                                                    }}
                                                    className="h-8 w-8 rounded-full bg-red-600 text-white flex items-center justify-center hover:bg-red-700 transition-colors"
                                                    title="Deletar"
                                                >
                                                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" /></svg>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                                        <p className="text-white text-xs font-mono truncate" title={orderId}>{orderId}</p>
                                    </div>
                                </div>
                            ))}
                            {imagesToDisplay.length === 0 && (
                                <div className="col-span-full text-center py-16 text-gray-500 dark:text-gray-400">
                                    <p>Nenhuma imagem encontrada.</p>
                                </div>
                            )}
                        </div>
                    </main>
                </div>
            )}
        </div>
    );
};

export default Imagem;
