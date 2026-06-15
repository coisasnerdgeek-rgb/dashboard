import React from 'react';
import { PhoneCaseModel } from '../types';

interface ModelosCapinhasProps {
    phoneCaseModels: Record<string, PhoneCaseModel[]>;
    onAddBrand: (brand: string) => void;
    onDeleteBrand: (brand: string) => void;
    onRenameBrand: (oldBrand: string, newBrand: string) => void;
    onAddModel: (brand: string, model: string) => void;
    onDeleteModel: (brand: string, model: string) => void;
    onToggleStock: (brand: string, model: string) => void;
    onEditModel: (oldBrand: string, oldName: string, newBrand: string, newName: string) => void;
}

const ModelosCapinhas: React.FC<ModelosCapinhasProps> = ({
    phoneCaseModels,
    onAddBrand,
    onDeleteBrand,
    onRenameBrand,
    onAddModel,
    onDeleteModel,
    onToggleStock,
    onEditModel
}) => {
    const [newBrand, setNewBrand] = React.useState('');
    const [newModel, setNewModel] = React.useState('');
    const [selectedBrand, setSelectedBrand] = React.useState<string | null>(null);
    const [searchTerm, setSearchTerm] = React.useState('');
    const [showConfirmModal, setShowConfirmModal] = React.useState<{ type: 'brand' | 'model', brand: string, model?: string } | null>(null);
    const [editingBrand, setEditingBrand] = React.useState<string | null>(null);
    const [editedBrandName, setEditedBrandName] = React.useState('');
    const [searchTermModels, setSearchTermModels] = React.useState('');
    const [universalSearch, setUniversalSearch] = React.useState('');
    const [editModalOpen, setEditModalOpen] = React.useState(false);
    const [editingModel, setEditingModel] = React.useState<{ brand: string; name: string } | null>(null);
    const [editModelName, setEditModelName] = React.useState('');
    const [editModelBrand, setEditModelBrand] = React.useState('');

    const handleAddBrand = () => {
        if (newBrand.trim()) {
            onAddBrand(newBrand.trim().toUpperCase());
            setNewBrand('');
        }
    };

    const handleAddModel = () => {
        if (selectedBrand && newModel.trim()) {
            onAddModel(selectedBrand, newModel.trim().toUpperCase());
            setNewModel('');
        }
    };

    const confirmDelete = () => {
        if (showConfirmModal) {
            if (showConfirmModal.type === 'brand') {
                onDeleteBrand(showConfirmModal.brand);
                if (selectedBrand === showConfirmModal.brand) setSelectedBrand(null);
            } else if (showConfirmModal.type === 'model' && showConfirmModal.model) {
                onDeleteModel(showConfirmModal.brand, showConfirmModal.model);
            }
            setShowConfirmModal(null);
        }
    };

    const startRenaming = (brand: string) => {
        setEditingBrand(brand);
        setEditedBrandName(brand);
    };

    const finishRenaming = () => {
        if (editingBrand && editedBrandName.trim() && editedBrandName !== editingBrand) {
            onRenameBrand(editingBrand, editedBrandName.trim().toUpperCase());
        }
        setEditingBrand(null);
        setEditedBrandName('');
    };

    const openEditModelModal = (brand: string, modelName: string) => {
        setEditingModel({ brand, name: modelName });
        setEditModelName(modelName);
        setEditModelBrand(brand);
        setEditModalOpen(true);
    };

    const handleSaveEditModel = () => {
        if (editingModel && editModelName.trim() && editModelBrand) {
            onEditModel(editingModel.brand, editingModel.name, editModelBrand, editModelName.trim().toUpperCase());
            setEditModalOpen(false);
            setEditingModel(null);
        }
    };

    const filteredBrands = Object.keys(phoneCaseModels).filter(brand =>
        brand.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const availableBrands = Object.keys(phoneCaseModels).sort();

    const getUniversalSearchResults = () => {
        if (!universalSearch.trim()) return null;
        const results: { brand: string, model: PhoneCaseModel }[] = [];
        Object.entries(phoneCaseModels as Record<string, PhoneCaseModel[]>).forEach(([brand, models]) => {
            (models || []).forEach(model => {
                if (model.name.toLowerCase().includes(universalSearch.toLowerCase()) ||
                    brand.toLowerCase().includes(universalSearch.toLowerCase())) {
                    results.push({ brand, model });
                }
            });
        });
        return results.sort((a, b) => a.model.name.localeCompare(b.model.name, undefined, { numeric: true }));
    };

    const universalResults = getUniversalSearchResults();

    return (
        <div className="space-y-6">
            {/* Universal Search */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <input
                        type="text"
                        value={universalSearch}
                        onChange={(e) => setUniversalSearch(e.target.value)}
                        placeholder="Busca Universal de Modelos (todas as marcas)..."
                        className="block w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg leading-5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm transition-all"
                    />
                    {universalSearch && (
                        <button
                            onClick={() => setUniversalSearch('')}
                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                        >
                            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                        </button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Brands List */}
                <div className="md:col-span-1 bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                    <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-white">Marcas</h3>
                    <div className="flex gap-2 mb-4">
                        <input
                            type="text"
                            value={newBrand}
                            onChange={(e) => setNewBrand(e.target.value)}
                            placeholder="Nova Marca"
                            className="flex-1 p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        />
                        <button
                            onClick={handleAddBrand}
                            className="bg-primary-600 text-white px-4 py-2 rounded hover:bg-primary-700"
                        >
                            Adicionar
                        </button>
                    </div>
                    <div className="mb-4">
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Buscar Marca..."
                            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        />
                    </div>
                    <ul className="space-y-2 max-h-[60vh] overflow-y-auto">
                        {filteredBrands.map(brand => (
                            <li
                                key={brand}
                                className={`flex justify-between items-center p-2 rounded cursor-pointer ${selectedBrand === brand ? 'bg-primary-50 dark:bg-primary-900/30 border border-primary-500' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                                onClick={() => setSelectedBrand(brand)}
                            >
                                {editingBrand === brand ? (
                                    <input
                                        type="text"
                                        value={editedBrandName}
                                        onChange={(e) => setEditedBrandName(e.target.value)}
                                        onBlur={finishRenaming}
                                        onKeyDown={(e) => e.key === 'Enter' && finishRenaming()}
                                        autoFocus
                                        className="bg-white dark:bg-gray-700 border rounded p-1 w-full"
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                ) : (
                                    <span className="font-medium text-gray-800 dark:text-gray-200">{brand}</span>
                                )}
                                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                                    <button
                                        onClick={() => startRenaming(brand)}
                                        className="text-gray-400 hover:text-blue-500 p-1"
                                        title="Renomear"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                        </svg>
                                    </button>
                                    <button
                                        onClick={() => setShowConfirmModal({ type: 'brand', brand })}
                                        className="text-gray-400 hover:text-red-500 p-1"
                                        title="Excluir"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Models List */}
                <div className="md:col-span-2 bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                    {universalSearch.trim() ? (
                        <>
                            <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-white">Resultados da Busca Universal ({universalResults?.length})</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[60vh] overflow-y-auto">
                                {universalResults?.map(({ brand, model }) => (
                                    <div key={`${brand}-${model.name}`} className={`flex flex-col p-3 rounded border ${model.inStock ? 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'}`}>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-primary-600 dark:text-primary-400">{brand}</span>
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => openEditModelModal(brand, model.name)}
                                                    className="text-gray-400 hover:text-blue-500 p-2 sm:p-1"
                                                    title="Editar"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                    </svg>
                                                </button>
                                                <button
                                                    onClick={() => onToggleStock(brand, model.name)}
                                                    className={`p-2 sm:p-1 rounded-full ${model.inStock ? 'text-green-500 hover:bg-green-100' : 'text-red-500 hover:bg-red-100'}`}
                                                >
                                                    {model.inStock ? (
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                        </svg>
                                                    ) : (
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                                        </svg>
                                                    )}
                                                </button>
                                                <button
                                                    onClick={() => setShowConfirmModal({ type: 'model', brand: brand, model: model.name })}
                                                    className="text-gray-400 hover:text-red-500 p-2 sm:p-1"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>
                                        <span className={`font-medium ${model.inStock ? 'text-gray-800 dark:text-gray-200' : 'text-red-600 dark:text-red-400 line-through'}`}>
                                            {model.name}
                                        </span>
                                    </div>
                                ))}
                                {universalResults?.length === 0 && (
                                    <p className="col-span-full text-center text-gray-500 py-8">Nenhum modelo encontrado na busca universal.</p>
                                )}
                            </div>
                        </>
                    ) : selectedBrand ? (
                        <>
                            <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-white">Modelos: {selectedBrand}</h3>
                            <div className="flex gap-2 mb-4">
                                <input
                                    type="text"
                                    value={newModel}
                                    onChange={(e) => setNewModel(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddModel()}
                                    placeholder="Novo Modelo"
                                    className="flex-1 p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                />
                                <button
                                    onClick={handleAddModel}
                                    className="bg-primary-600 text-white px-4 py-2 rounded hover:bg-primary-700"
                                >
                                    Adicionar
                                </button>
                            </div>
                            <div className="mb-4">
                                <input
                                    type="text"
                                    value={searchTermModels}
                                    onChange={(e) => setSearchTermModels(e.target.value)}
                                    placeholder="Buscar nesta marca..."
                                    className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[60vh] overflow-y-auto">
                                {(phoneCaseModels[selectedBrand] || [])
                                    .filter(m => m.name.toLowerCase().includes(searchTermModels.toLowerCase()))
                                    .map(model => (
                                        <div key={model.name} className={`flex items-center justify-between p-3 rounded border ${model.inStock ? 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'}`}>
                                            <span className={`font-medium ${model.inStock ? 'text-gray-800 dark:text-gray-200' : 'text-red-600 dark:text-red-400 line-through'}`}>
                                                {model.name}
                                            </span>
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => openEditModelModal(selectedBrand, model.name)}
                                                    className="text-gray-400 hover:text-blue-500 p-2 sm:p-1"
                                                    title="Editar"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                    </svg>
                                                </button>
                                                <button
                                                    onClick={() => onToggleStock(selectedBrand, model.name)}
                                                    className={`p-2 sm:p-1 rounded-full ${model.inStock ? 'text-green-500 hover:bg-green-100 dark:hover:bg-green-900/30' : 'text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30'}`}
                                                    title={model.inStock ? "Marcar como Esgotado" : "Marcar como Em Estoque"}
                                                >
                                                    {model.inStock ? (
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                        </svg>
                                                    ) : (
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                                        </svg>
                                                    )}
                                                </button>
                                                <button
                                                    onClick={() => setShowConfirmModal({ type: 'model', brand: selectedBrand, model: model.name })}
                                                    className="text-gray-400 hover:text-red-500 p-2 sm:p-1"
                                                    title="Excluir"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                {(phoneCaseModels[selectedBrand] || []).length === 0 && (
                                    <p className="col-span-full text-center text-gray-500 py-8">Nenhum modelo cadastrado.</p>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-gray-500">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                            <p className="text-xl">Selecione uma marca para gerenciar os modelos</p>
                        </div>
                    )}
                </div>

                {/* Confirmation Modal */}
                {showConfirmModal && (
                    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4">
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-sm w-full shadow-xl">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Confirmar Exclusão</h3>
                            <p className="text-gray-600 dark:text-gray-300 mb-6">
                                Tem certeza que deseja excluir
                                {showConfirmModal.type === 'brand' ? ` a marca "${showConfirmModal.brand}" e todos os seus modelos?` : ` o modelo "${showConfirmModal.model}"?`}
                            </p>
                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={() => setShowConfirmModal(null)}
                                    className="px-4 py-2 rounded text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={confirmDelete}
                                    className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700"
                                >
                                    Excluir
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Edit Model Modal */}
                {editModalOpen && (
                    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4">
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-sm w-full shadow-xl">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Editar Modelo</h3>

                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nome do Modelo</label>
                                <input
                                    type="text"
                                    value={editModelName}
                                    onChange={(e) => setEditModelName(e.target.value)}
                                    className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                />
                            </div>

                            <div className="mb-6">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Marca</label>
                                <select
                                    value={editModelBrand}
                                    onChange={(e) => setEditModelBrand(e.target.value)}
                                    className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                >
                                    {availableBrands.map(brand => (
                                        <option key={brand} value={brand}>{brand}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={() => setEditModalOpen(false)}
                                    className="px-4 py-2 rounded text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSaveEditModel}
                                    className="px-4 py-2 rounded bg-primary-600 text-white hover:bg-primary-700"
                                >
                                    Salvar
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ModelosCapinhas;
