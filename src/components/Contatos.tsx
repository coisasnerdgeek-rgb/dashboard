import * as React from 'react';
import { Contact } from '../types';

interface ContatosProps {
    contacts: Contact[];
    stores: string[];
    onSave: (contact: Contact) => void;
    onDelete: (contactId: string) => void;
    onAddStore?: (storeName: string) => Promise<void>;
    onClose: () => void;
}

const Contatos: React.FC<ContatosProps> = ({ contacts, stores, onSave, onDelete, onAddStore, onClose }) => {
    const [localContacts, setLocalContacts] = React.useState(contacts);
    const [editingContact, setEditingContact] = React.useState<Partial<Contact> | null>(null);
    const [formState, setFormState] = React.useState<Partial<Contact>>({ store: stores[0] || '' });
    const [errors, setErrors] = React.useState<{ store?: string; comms?: string }>({});

    // State for adding new store
    const [isAddingStore, setIsAddingStore] = React.useState(false);
    const [newStoreName, setNewStoreName] = React.useState('');
    const [availableStores, setAvailableStores] = React.useState(stores);

    React.useEffect(() => {
        setLocalContacts(contacts);
    }, [contacts]);

    React.useEffect(() => {
        setAvailableStores(stores);
    }, [stores]);

    const groupedContacts = React.useMemo(() => {
        const groups: Record<string, Contact[]> = {};
        localContacts.forEach(contact => {
            if (!groups[contact.store]) {
                groups[contact.store] = [];
            }
            groups[contact.store].push(contact);
        });
        return groups;
    }, [localContacts]);

    const startEditing = (contact: Contact) => {
        setEditingContact(contact);
        setFormState(contact);
        setErrors({});
        setIsAddingStore(false);
    };

    const startAdding = () => {
        setEditingContact({}); // Use an empty object to signify "add mode"
        setFormState({ store: availableStores[0] || '' });
        setErrors({});
        setIsAddingStore(false);
    };

    const cancelEditing = () => {
        setEditingContact(null);
        setFormState({ store: availableStores[0] || '' });
        setErrors({});
        setIsAddingStore(false);
    };

    const handleFormChange = (field: keyof Contact, value: string) => {
        setFormState(prev => ({ ...prev, [field]: value }));
    };

    const validateForm = () => {
        const newErrors: { store?: string; comms?: string } = {};
        if (!formState.store) {
            newErrors.store = 'A loja é obrigatória.';
        }
        if (!formState.whatsapp && !formState.email) {
            newErrors.comms = 'É necessário preencher o WhatsApp ou o Email.';
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSave = () => {
        if (!validateForm()) return;

        const contactToSave: Contact = {
            id: formState.id || `contact-${Date.now()}`,
            store: formState.store!,
            name: formState.name,
            whatsapp: formState.whatsapp,
            email: formState.email,
        };
        onSave(contactToSave);

        setLocalContacts(prev => {
            const existingIndex = prev.findIndex(c => c.id === contactToSave.id);
            if (existingIndex > -1) {
                const newContacts = [...prev];
                newContacts[existingIndex] = contactToSave;
                return newContacts;
            } else {
                return [...prev, contactToSave];
            }
        });

        cancelEditing();
    };

    const handleDelete = (contactId: string) => {
        onDelete(contactId);
        setLocalContacts(prev => prev.filter(c => c.id !== contactId));
    };

    const handleAddNewStore = async () => {
        if (!newStoreName.trim()) return;
        if (onAddStore) {
            await onAddStore(newStoreName.trim());
            setAvailableStores(prev => [...prev, newStoreName.trim()].sort());
            setFormState(prev => ({ ...prev, store: newStoreName.trim() }));
            setIsAddingStore(false);
            setNewStoreName('');
        }
    };

    return (
        <div className="text-sm">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-1">
                    <h4 className="text-base font-semibold mb-2 text-gray-800 dark:text-gray-200">{editingContact?.id ? 'Editar Contato' : 'Adicionar Contato'}</h4>
                    <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-md border dark:border-gray-700 space-y-3">
                        <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">Loja *</label>

                            {!isAddingStore ? (
                                <div className="flex gap-2">
                                    <select
                                        value={formState.store || ''}
                                        onChange={e => handleFormChange('store', e.target.value)}
                                        className="mt-1 flex-grow p-2 text-sm rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                                    >
                                        {availableStores.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                    {onAddStore && (
                                        <button
                                            onClick={() => setIsAddingStore(true)}
                                            className="mt-1 px-2 py-1 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                                            title="Adicionar nova loja"
                                        >
                                            +
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="flex gap-2 mt-1">
                                    <input
                                        type="text"
                                        value={newStoreName}
                                        onChange={e => setNewStoreName(e.target.value)}
                                        placeholder="Nome da nova loja"
                                        className="flex-grow p-2 text-sm rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                                        autoFocus
                                    />
                                    <button
                                        onClick={handleAddNewStore}
                                        className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                                    >
                                        OK
                                    </button>
                                    <button
                                        onClick={() => setIsAddingStore(false)}
                                        className="px-3 py-1 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-400 dark:hover:bg-gray-500"
                                    >
                                        X
                                    </button>
                                </div>
                            )}

                            {errors.store && <p className="text-red-500 text-xs mt-1">{errors.store}</p>}
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">Nome (Opcional)</label>
                            <input type="text" value={formState.name || ''} onChange={e => handleFormChange('name', e.target.value)} className="mt-1 w-full p-2 text-sm rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">WhatsApp (Opcional)</label>
                            <input type="tel" value={formState.whatsapp || ''} onChange={e => handleFormChange('whatsapp', e.target.value)} placeholder="5511999998888" className="mt-1 w-full p-2 text-sm rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">Email (Opcional)</label>
                            <input type="email" value={formState.email || ''} onChange={e => handleFormChange('email', e.target.value)} placeholder="contato@empresa.com" className="mt-1 w-full p-2 text-sm rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700" />
                        </div>
                        {errors.comms && <p className="text-red-500 text-xs mt-1">{errors.comms}</p>}
                        <div className="flex gap-2 pt-2">
                            {editingContact && (
                                <button onClick={cancelEditing} className="w-full px-3 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 text-xs font-semibold rounded-md hover:bg-gray-300 dark:hover:bg-gray-500">
                                    Cancelar
                                </button>
                            )}
                            <button onClick={handleSave} className="w-full px-3 py-2 bg-primary-600 text-white text-xs font-semibold rounded-md hover:bg-primary-700">
                                {formState.id ? 'Salvar Alterações' : 'Adicionar Contato'}
                            </button>
                        </div>
                        {!editingContact && (
                            <button onClick={startAdding} className="w-full mt-2 px-3 py-2 border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 text-xs font-semibold rounded-md hover:border-primary-500 hover:text-primary-500">
                                + Novo Contato
                            </button>
                        )}
                    </div>
                </div>

                <div className="md:col-span-2">
                    <h4 className="text-base font-semibold mb-2 text-gray-800 dark:text-gray-200">Contatos Salvos</h4>
                    <div className="space-y-3 max-h-96 overflow-y-auto pr-2 bg-gray-50 dark:bg-gray-900/50 p-3 rounded-md border dark:border-gray-700">
                        {Object.keys(groupedContacts).length > 0 ? (
                            Object.entries(groupedContacts)
                                .sort(([storeA], [storeB]) => storeA.localeCompare(storeB))
                                // FIX: Explicitly type the destructured parameters to resolve a type inference issue where storeContacts was being inferred as 'unknown'.
                                .map(([store, storeContacts]: [string, Contact[]]) => (
                                    <div key={store}>
                                        <h5 className="font-bold text-primary-600 dark:text-primary-400">{store}</h5>
                                        <ul className="pl-2 space-y-2 mt-1">
                                            {storeContacts.map(contact => (
                                                <li key={contact.id} className="p-2 bg-white dark:bg-gray-800 rounded-md shadow-sm border dark:border-gray-700/50 flex justify-between items-center">
                                                    <div>
                                                        {contact.name && <p className="font-semibold text-gray-800 dark:text-gray-200">{contact.name}</p>}
                                                        {contact.whatsapp && <p className="text-gray-600 dark:text-gray-400">{contact.whatsapp}</p>}
                                                        {contact.email && <p className="text-gray-600 dark:text-gray-400">{contact.email}</p>}
                                                    </div>
                                                    <div className="flex gap-1">
                                                        <button onClick={() => startEditing(contact)} className="p-1.5 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-full"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>
                                                        <button onClick={() => handleDelete(contact.id)} className="p-1.5 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-full"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" /></svg></button>
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ))
                        ) : (
                            <p className="text-center text-gray-500 py-4">Nenhum contato salvo.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export { Contatos };