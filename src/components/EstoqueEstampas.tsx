import * as React from 'react';
import { supabase } from '../services/supabaseClient';
import { uploadFileToDrive, findOrCreateFolder } from '../services/googleDriveService';
import { saveImageMapping } from '../services/supabaseService';
import toast from 'react-hot-toast';

interface InventoryItem {
    id: number;
    sku: string;
    quantity: number;
    image_url: string;
    created_at: string;
}

export const EstoqueEstampas: React.FC = () => {
    const [items, setItems] = React.useState<InventoryItem[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [newItem, setNewItem] = React.useState({ sku: '', quantity: 0, imageFile: null as File | null });
    const [editingItem, setEditingItem] = React.useState<InventoryItem | null>(null);
    const [uploading, setUploading] = React.useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const editFileInputRef = React.useRef<HTMLInputElement>(null);

    React.useEffect(() => {
        fetchInventory();
    }, []);

    const fetchInventory = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('printing_inventory')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setItems(data || []);
        } catch (error) {
            console.error('Error fetching inventory:', error);
            toast.error('Erro ao carregar estoque');
        } finally {
            setLoading(false);
        }
    };

    const handleAddItem = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newItem.sku) {
            toast.error('SKU é obrigatório');
            return;
        }

        try {
            setUploading(true);
            let imageUrl = '';

            if (newItem.imageFile) {
                // 1. Ensure "Estampa" folder exists
                const mainRootId = localStorage.getItem('googleDrivePublicFolderId') || '11lPRLR2oHxhPrkg4etlNyeTawZvDBZxk';
                const estampaFolderId = await findOrCreateFolder('Estampa', mainRootId);
                if (!estampaFolderId) throw new Error('Could not create/find Estampa folder');

                // 2. Ensure SKU specific folder exists
                const skuFolderId = await findOrCreateFolder(newItem.sku, estampaFolderId);

                // 3. Upload file
                const uploadedFile = await uploadFileToDrive(newItem.imageFile, skuFolderId);
                imageUrl = uploadedFile.webViewLink;
            }

            // 4. Insert into Supabase
            const { error } = await supabase
                .from('printing_inventory')
                .insert([{ sku: newItem.sku, quantity: newItem.quantity, image_url: imageUrl }]);

            if (error) throw error;

            // 5. Sync with Imagens screen (image_mappings)
            if (imageUrl) {
                await saveImageMapping(newItem.sku, imageUrl);
            }

            toast.success('Item adicionado com sucesso');
            setNewItem({ sku: '', quantity: 0, imageFile: null });
            if (fileInputRef.current) fileInputRef.current.value = '';
            fetchInventory();

        } catch (error) {
            console.error('Error adding item:', error);
            toast.error('Erro ao adicionar item');
        } finally {
            setUploading(false);
        }
    };

    const handleUpdateItem = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingItem || !editingItem.sku) return;

        try {
            setUploading(true);
            let imageUrl = editingItem.image_url;

            // If a new file is selected during edit
            if (editFileInputRef.current?.files?.length) {
                const file = editFileInputRef.current.files[0];
                const mainRootId = localStorage.getItem('googleDrivePublicFolderId') || '11lPRLR2oHxhPrkg4etlNyeTawZvDBZxk';
                const estampaFolderId = await findOrCreateFolder('Estampa', mainRootId);
                if (estampaFolderId) {
                    const skuFolderId = await findOrCreateFolder(editingItem.sku, estampaFolderId);
                    const uploadedFile = await uploadFileToDrive(file, skuFolderId);
                    imageUrl = uploadedFile.webViewLink;
                }
            }

            const { error } = await supabase
                .from('printing_inventory')
                .update({ sku: editingItem.sku, quantity: editingItem.quantity, image_url: imageUrl })
                .eq('id', editingItem.id);

            if (error) throw error;

            // Sync with Imagens screen
            if (imageUrl && imageUrl !== editingItem.image_url) {
                await saveImageMapping(editingItem.sku, imageUrl);
            }

            toast.success('Item atualizado');
            setEditingItem(null);
            fetchInventory();
        } catch (error) {
            console.error('Error updating item:', error);
            toast.error('Erro ao atualizar item');
        } finally {
            setUploading(false);
        }
    };

    const handleDeleteItem = async (id: number) => {
        if (!confirm('Tem certeza que deseja excluir este item?')) return;

        try {
            const { error } = await supabase
                .from('printing_inventory')
                .delete()
                .eq('id', id);

            if (error) throw error;
            toast.success('Item excluído');
            setItems(prev => prev.filter(item => item.id !== id));
        } catch (error) {
            console.error('Error deleting item:', error);
            toast.error('Erro ao excluir item');
        }
    };

    return (
        <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
            <h2 className="text-xl font-bold mb-6 text-gray-800 dark:text-white flex items-center gap-2">
                <span>📦</span> Controle de Estoque de Estampas
            </h2>

            {/* Add New Item Form */}
            <form onSubmit={handleAddItem} className="mb-8 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wider">Adicionar Novo Item</h3>
                <div className="flex flex-wrap gap-4 items-end">
                    <div className="w-full sm:w-1/4">
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">SKU</label>
                        <input
                            type="text"
                            value={newItem.sku}
                            onChange={(e) => setNewItem({ ...newItem, sku: e.target.value })}
                            className="w-full p-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:ring-primary-500 focus:border-primary-500"
                            placeholder="Ex: EST-001"
                        />
                    </div>
                    <div className="w-full sm:w-1/4">
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Quantidade</label>
                        <input
                            type="number"
                            value={newItem.quantity}
                            onChange={(e) => setNewItem({ ...newItem, quantity: Number(e.target.value) })}
                            className="w-full p-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:ring-primary-500 focus:border-primary-500"
                        />
                    </div>
                    <div className="w-full sm:w-1/3">
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Imagem (Opcional)</label>
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={(e) => setNewItem({ ...newItem, imageFile: e.target.files ? e.target.files[0] : null })}
                            className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100 dark:file:bg-primary-900/50 dark:file:text-primary-300"
                            accept="image/*"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={uploading}
                        className={`px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-md font-medium text-sm transition-colors flex items-center gap-2 ${uploading ? 'opacity-70 cursor-not-allowed' : ''}`}
                    >
                        {uploading ? (
                            <>
                                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Salvando...
                            </>
                        ) : (
                            <>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                                </svg>
                                Adicionar
                            </>
                        )}
                    </button>
                </div>
            </form>

            {/* Edit Modal / Form would be better, but inline for now or reused form */}
            {editingItem && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-md">
                        <h3 className="text-lg font-bold mb-4 dark:text-white">Editar Item</h3>
                        <form onSubmit={handleUpdateItem}>
                            <div className="mb-4">
                                <label className="block text-sm font-medium mb-1 dark:text-gray-300">SKU</label>
                                <input
                                    type="text"
                                    value={editingItem.sku}
                                    onChange={e => setEditingItem({ ...editingItem, sku: e.target.value })}
                                    className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                />
                            </div>
                            <div className="mb-4">
                                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Quantidade</label>
                                <input
                                    type="number"
                                    value={editingItem.quantity}
                                    onChange={e => setEditingItem({ ...editingItem, quantity: Number(e.target.value) })}
                                    className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                />
                            </div>
                            <div className="mb-6">
                                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Nova Imagem (Opcional)</label>
                                <input
                                    type="file"
                                    ref={editFileInputRef}
                                    className="w-full text-sm text-gray-500"
                                    accept="image/*"
                                />
                            </div>
                            <div className="flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setEditingItem(null)}
                                    className="px-4 py-2 text-gray-600 hover:text-gray-800 dark:text-gray-300"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={uploading}
                                    className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700"
                                >
                                    {uploading ? 'Salvando...' : 'Salvar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Inventory List */}
            {loading ? (
                <div className="text-center py-10">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600 mx-auto"></div>
                    <p className="mt-2 text-gray-500 text-sm">Carregando estoque...</p>
                </div>
            ) : items.length === 0 ? (
                <div className="text-center py-10 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-dashed border-gray-300 dark:border-gray-600">
                    <p className="text-gray-500 dark:text-gray-400">Nenhum item no estoque.</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-100 dark:bg-gray-700 text-xs text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                                <th className="p-3 font-bold rounded-tl-lg">Imagem</th>
                                <th className="p-3 font-bold">SKU</th>
                                <th className="p-3 font-bold text-center">Quantidade</th>
                                <th className="p-3 font-bold text-right rounded-tr-lg">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {items.map((item) => (
                                <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                    <td className="p-3">
                                        {item.image_url ? (
                                            <div className="h-10 w-10 relative group">
                                                <img src={item.image_url} alt={item.sku} className="h-10 w-10 object-cover rounded-md border border-gray-200 dark:border-gray-600" />
                                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-md flex items-center justify-center">
                                                    <a href={item.image_url} target="_blank" rel="noopener noreferrer" className="text-white">
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                        </svg>
                                                    </a>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="h-10 w-10 bg-gray-100 dark:bg-gray-700 rounded-md flex items-center justify-center text-gray-400">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                </svg>
                                            </div>
                                        )}
                                    </td>
                                    <td className="p-3 font-mono text-sm font-medium text-gray-800 dark:text-gray-200">{item.sku}</td>
                                    <td className="p-3 text-center">
                                        <span className={`inline-flex items-center justify-center px-2 py-1 rounded-full text-xs font-bold ${item.quantity > 0 ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200'}`}>
                                            {item.quantity} un
                                        </span>
                                    </td>
                                    <td className="p-3 text-right">
                                        <button
                                            onClick={() => setEditingItem(item)}
                                            className="text-gray-400 hover:text-blue-600 transition-colors p-1 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20 mr-2"
                                            title="Editar item"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                            </svg>
                                        </button>
                                        <button
                                            onClick={() => handleDeleteItem(item.id)}
                                            className="text-gray-400 hover:text-red-600 transition-colors p-1 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20"
                                            title="Excluir item"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};
