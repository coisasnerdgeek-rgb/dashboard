import React, { useState, useEffect } from 'react';
import { MarketplaceFee } from '../types';
import { getMarketplaceFees, saveMarketplaceFee, initializeMarketplaceFees } from '../services/marketplaceService';
import toast from 'react-hot-toast';

interface FeeTier {
    max: number;
    value: number;
}

const TaxasMarketplace: React.FC = () => {
    const [fees, setFees] = useState<MarketplaceFee[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<Partial<MarketplaceFee>>({});

    // Advanced Rules State
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [tiers, setTiers] = useState<FeeTier[]>([]);
    const [freeShippingThreshold, setFreeShippingThreshold] = useState<number | ''>('');

    useEffect(() => {
        loadFees();
    }, []);

    const loadFees = async () => {
        setLoading(true);
        try {
            await initializeMarketplaceFees(); // Ensure defaults exist if empty
            const data = await getMarketplaceFees();
            setFees(data.sort((a, b) => a.name.localeCompare(b.name)));
        } catch (error) {
            console.error('Error loading fees:', error);
            toast.error('Erro ao carregar taxas');
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (fee: MarketplaceFee) => {
        setEditingId(fee.id || fee.marketplace);
        setEditForm({ ...fee });

        // Parse advanced rules
        const rules = fee.rules_json || {};
        setTiers(Array.isArray(rules.fixed_fee_tiers) ? rules.fixed_fee_tiers : []);
        setFreeShippingThreshold(rules.free_shipping_threshold ?? '');
        setShowAdvanced(false);
    };

    const handleCancel = () => {
        setEditingId(null);
        setEditForm({});
        setTiers([]);
        setFreeShippingThreshold('');
        setShowAdvanced(false);
    };

    const handleSave = async () => {
        if (!editForm.marketplace) return;

        try {
            const updatedRules = {
                ...(editForm.rules_json || {}),
                fixed_fee_tiers: tiers.length > 0 ? tiers : undefined,
                free_shipping_threshold: freeShippingThreshold === '' ? undefined : Number(freeShippingThreshold)
            };

            const updatedFee = {
                ...editForm,
                rules_json: updatedRules
            } as MarketplaceFee;

            // Optimistic update
            setFees(prev => prev.map(f => (f.id === updatedFee.id || f.marketplace === updatedFee.marketplace) ? updatedFee : f));
            setEditingId(null);

            await saveMarketplaceFee(updatedFee);
            toast.success('Taxa atualizada com sucesso!');
            loadFees();
        } catch (error) {
            console.error('Error saving fee:', error);
            toast.error('Erro ao salvar taxa');
            loadFees();
        }
    };

    const handleChange = (field: keyof MarketplaceFee, value: any) => {
        setEditForm(prev => ({ ...prev, [field]: value }));
    };

    const handleAddTier = () => {
        setTiers(prev => [...prev, { max: 0, value: 0 }]);
    };

    const handleRemoveTier = (index: number) => {
        setTiers(prev => prev.filter((_, i) => i !== index));
    };

    const handleTierChange = (index: number, field: keyof FeeTier, value: number) => {
        const newTiers = [...tiers];
        newTiers[index] = { ...newTiers[index], [field]: value };
        setTiers(newTiers);
    };

    if (loading) {
        return <div className="p-8 text-center text-gray-500">Carregando taxas...</div>;
    }

    return (
        <div className="p-6 bg-white dark:bg-[#1e293b] rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">Taxas de Marketplace</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                Gerencie as taxas e comissões para cada canal de venda. Configure faixas de preço para taxas fixas variáveis (ex: Mercado Livre).
            </p>

            <div className="space-y-4">
                {fees.map((fee) => {
                    const isEditing = editingId === (fee.id || fee.marketplace);

                    if (isEditing) {
                        return (
                            <div key={fee.marketplace} className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                                <h3 className="font-bold text-lg mb-4 text-blue-900 dark:text-blue-100">Editando {fee.name}</h3>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Comissão (%)</label>
                                        <input
                                            type="number"
                                            step="0.1"
                                            value={editForm.commission_percent ?? 0}
                                            onChange={(e) => handleChange('commission_percent', parseFloat(e.target.value))}
                                            className="w-full p-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Taxa Fixa Base (R$)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={editForm.fixed_fee ?? 0}
                                            onChange={(e) => handleChange('fixed_fee', parseFloat(e.target.value))}
                                            className="w-full p-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Imposto (%)</label>
                                        <input
                                            type="number"
                                            step="0.1"
                                            value={editForm.tax_rate ?? 0}
                                            onChange={(e) => handleChange('tax_rate', parseFloat(e.target.value))}
                                            className="w-full p-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                                        />
                                    </div>
                                </div>

                                <div className="mb-4">
                                    <button
                                        onClick={() => setShowAdvanced(!showAdvanced)}
                                        className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                                    >
                                        {showAdvanced ? '🔽 Ocultar Regras Avançadas' : '▶️ Mostrar Regras Avançadas (Tiers, Frete)'}
                                    </button>
                                </div>

                                {showAdvanced && (
                                    <div className="bg-white dark:bg-gray-800 p-4 rounded border border-gray-200 dark:border-gray-700 animate-fadeIn">
                                        <div className="grid grid-cols-2 gap-4 mb-4">
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Limite Frete Grátis (R$)</label>
                                                <input
                                                    type="number"
                                                    placeholder="Ex: 79.00"
                                                    value={freeShippingThreshold}
                                                    onChange={(e) => setFreeShippingThreshold(e.target.value === '' ? '' : parseFloat(e.target.value))}
                                                    className="w-full p-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                                                />
                                                <p className="text-xs text-gray-500 mt-1">Acima deste valor, regras de frete podem mudar.</p>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Teto Máximo Comissão (R$)</label>
                                                <input
                                                    type="number"
                                                    placeholder="Ex: 100.00"
                                                    value={maxCommission}
                                                    onChange={(e) => setMaxCommission(e.target.value === '' ? '' : parseFloat(e.target.value))}
                                                    className="w-full p-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                                                />
                                                <p className="text-xs text-gray-500 mt-1">Valor máximo que será cobrado de comissão por item (Ex: Shopee R$ 100).</p>
                                            </div>
                                        </div>

                                        <div className="mb-2">
                                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                                                Faixas de Taxa Fixa (Tiers)
                                                <span className="block text-gray-500 font-normal">Ex: Até R$ 29,99 cobra R$ 6,00.</span>
                                            </label>

                                            {tiers.length === 0 && (
                                                <p className="text-sm text-gray-500 italic mb-2">Nenhuma faixa configurada.</p>
                                            )}

                                            {tiers.map((tier, index) => (
                                                <div key={index} className="flex gap-2 items-center mb-2">
                                                    <span className="text-sm text-gray-600">Até R$</span>
                                                    <input
                                                        type="number"
                                                        value={tier.max}
                                                        onChange={(e) => handleTierChange(index, 'max', parseFloat(e.target.value))}
                                                        className="w-24 p-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
                                                        placeholder="Max"
                                                    />
                                                    <span className="text-sm text-gray-600">Taxa: R$</span>
                                                    <input
                                                        type="number"
                                                        value={tier.value}
                                                        onChange={(e) => handleTierChange(index, 'value', parseFloat(e.target.value))}
                                                        className="w-24 p-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
                                                        placeholder="Valor"
                                                    />
                                                    <button onClick={() => handleRemoveTier(index)} className="text-red-500 hover:text-red-700 px-2 font-bold">✕</button>
                                                </div>
                                            ))}

                                            <button
                                                onClick={handleAddTier}
                                                className="text-xs bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 px-3 py-1 rounded text-gray-800 dark:text-gray-200 mt-1"
                                            >
                                                + Adicionar Faixa
                                            </button>
                                        </div>
                                    </div>
                                )}

                                <div className="flex justify-end gap-2 mt-4">
                                    <button onClick={handleSave} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded shadow-sm text-sm font-medium">Salvar Alterações</button>
                                    <button onClick={handleCancel} className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 px-4 py-2 rounded shadow-sm text-sm font-medium">Cancelar</button>
                                </div>
                            </div>
                        );
                    }

                    return (
                        <div key={fee.marketplace} className="flex items-center justify-between p-4 bg-white dark:bg-[#1e293b] border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-800/20 transition-colors">
                            <div>
                                <h4 className="font-medium text-gray-900 dark:text-gray-100">{fee.name}</h4>
                                <div className="flex gap-4 text-sm text-gray-500 mt-1">
                                    <span>Comissão: <strong>{fee.commission_percent}%</strong></span>
                                    <span>Fixo: <strong>R$ {fee.fixed_fee.toFixed(2)}</strong></span>
                                    <span>Imposto: <strong>{fee.tax_rate}%</strong></span>
                                </div>
                                {fee.rules_json?.fixed_fee_tiers && (
                                    <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                                        Possui {fee.rules_json.fixed_fee_tiers.length} regras de faixa de preço expecíficas.
                                    </div>
                                )}
                            </div>
                            <button
                                onClick={() => handleEdit(fee)}
                                className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 font-medium text-sm border border-blue-200 dark:border-blue-900/30 px-3 py-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/10"
                            >
                                Editar
                            </button>
                        </div>
                    );
                })}
            </div>

            <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/10 rounded-lg border border-yellow-200 dark:border-yellow-700/50">
                <h4 className="text-sm font-semibold text-yellow-800 dark:text-yellow-400 mb-1">Dica de Configuração</h4>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                    Use as <strong>Regras Avançadas</strong> para configurar taxas que variam conforme o preço do produto (ex: Mercado Livre cobra R$ 6 fixo apenas para produtos abaixo de R$ 79).
                </p>
            </div>
        </div>
    );
};

export default TaxasMarketplace;

