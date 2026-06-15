
import * as React from 'react';
import { storeStyles, defaultStoreStyle } from '../utils/ecommerceUtils';

export interface UniversalPickingItem {
    _uniqueId: string | number;
    _idVenda: string;
    _sku: string;
    _store: string;
    _nome: string;
    _rastreio?: string;
    
    // Display fields
    title: string;      // e.g. Model or Product Name
    subtitle: string;   // e.g. Brand or Color/Size
    imageUrl?: string;
    
    // Logic fields
    isPersonalized: boolean;
    groupKey: string;    // Used for Summary Grouping (e.g. Brand)
    subGroupKey: string; // Used for Summary Items (e.g. Model)
}

interface UniversalPickingProps {
    items: UniversalPickingItem[];
    onRowClick: (item: any) => void;
    summaryLabels: {
        group: string; // e.g. "Marca"
        subGroup: string; // e.g. "Modelo"
    };
    filterOptions?: {
        showTransparentPersonalized?: boolean;
    };
}

const DonutChart: React.FC<{ size: number; strokeWidth: number; progress: number; text: string }> = ({ size, strokeWidth, progress, text }) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (progress / 100) * circumference;

    return (
        <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="transform -rotate-90">
                <circle stroke="currentColor" fill="transparent" strokeWidth={strokeWidth} className="text-gray-200 dark:text-gray-700" r={radius} cx={size / 2} cy={size / 2} />
                <circle stroke="currentColor" fill="transparent" strokeWidth={strokeWidth} strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className="text-indigo-500 transition-all duration-300" r={radius} cx={size / 2} cy={size / 2} />
            </svg>
            <span className="absolute text-xs font-bold text-gray-700 dark:text-gray-300">{text}</span>
        </div>
    );
};

const PickingItemCard: React.FC<{
    item: UniversalPickingItem;
    onVerify?: () => void;
    onUnverify?: () => void;
    onIdClick: () => void;
    isVerified?: boolean;
    stats: { verified: number; total: number };
}> = ({ item, onVerify, onUnverify, onIdClick, isVerified, stats }) => {
    const storeStyle = storeStyles[item._store] || defaultStoreStyle;
    const progress = stats.total > 0 ? (stats.verified / stats.total) * 100 : 0;

    return (
        <div className={`rounded-lg border overflow-hidden flex transition-all duration-300 ${isVerified ? 'bg-green-50 dark:bg-green-900/40 border-green-300 dark:border-green-600' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'}`}>
            <div className="w-28 flex-shrink-0 bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.title} className="h-full w-full object-cover" />
                ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                )}
            </div>
            <div className="flex-grow p-3 flex items-stretch justify-between">
                <div className="flex-grow min-w-0 flex flex-col justify-between">
                    <div>
                        <div className="flex justify-between items-start mb-1 gap-2">
                            <button onClick={onIdClick} className="font-mono font-bold text-primary-600 dark:text-primary-400 truncate hover:underline text-left text-lg" title={item._idVenda}>{item._idVenda}</button>
                            {item._rastreio && (
                                <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" /><path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v5.05a2.5 2.5 0 014.9 0H19a1 1 0 001-1V8a1 1 0 00-1-1h-5z" /></svg>
                                    <span className="font-mono">{item._rastreio}</span>
                                </div>
                            )}
                        </div>
                        <p className="text-base font-semibold text-purple-600 dark:text-purple-400">{item.title}</p>
                        <p className="text-sm text-gray-700 dark:text-gray-300">{item.subtitle}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{item._nome || 'Cliente não informado'}</p>
                    </div>
                    <div className="flex items-center gap-4 mt-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${storeStyle.bg} ${storeStyle.text}`}>{item._store}</span>
                        {!isVerified && <button onClick={onVerify} className="px-3 py-1 bg-gray-200 dark:bg-gray-600 text-xs font-semibold rounded-md hover:bg-gray-300 dark:hover:bg-gray-500">Verificar</button>}
                    </div>
                </div>
                <div className="flex-shrink-0 flex items-center gap-2 ml-3">
                    {isVerified ? (
                        <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-green-500 text-white flex items-center justify-center shadow-lg"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg></div>
                            <button onClick={onUnverify} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-100 dark:hover:bg-red-800/50 rounded-full"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg></button>
                        </div>
                    ) : <DonutChart size={60} strokeWidth={6} progress={progress} text={`${stats.verified}/${stats.total}`} />}
                </div>
            </div>
        </div>
    );
};

const UniversalPicking: React.FC<UniversalPickingProps> = ({ items, onRowClick, summaryLabels, filterOptions = { showTransparentPersonalized: true } }) => {
    const [verifiedIds, setVerifiedIds] = React.useState<Set<string | number>>(new Set());
    const [scanInput, setScanInput] = React.useState('');
    const [feedback, setFeedback] = React.useState<{ message: string; type: 'success' | 'warn' | 'error' } | null>(null);
    const [sortBy, setSortBy] = React.useState<'default' | 'title' | 'group' | 'store'>('default');
    const [filterType, setFilterType] = React.useState<'all' | 'transparent' | 'personalized'>('all');
    const [activeTab, setActiveTab] = React.useState<'summary' | 'bipagem'>('bipagem');
    const scanInputRef = React.useRef<HTMLInputElement>(null);
    const audioContextRef = React.useRef<AudioContext | null>(null);

    React.useEffect(() => {
        if (activeTab === 'bipagem') scanInputRef.current?.focus();
    }, [activeTab]);

    React.useEffect(() => {
        if (feedback) {
            const timer = setTimeout(() => setFeedback(null), 3500);
            return () => clearTimeout(timer);
        }
    }, [feedback]);

    const playSound = (type: 'success' | 'error') => {
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        const ctx = audioContextRef.current;
        if (ctx.state === 'suspended') ctx.resume();

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        if (type === 'success') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(600, ctx.currentTime);
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.15);
        } else {
            osc.type = 'square';
            osc.frequency.setValueAtTime(200, ctx.currentTime);
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.2);
        }
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.2);
    };

    const handleVerify = (item: UniversalPickingItem, source: 'scan' | 'manual') => {
        if (item) {
            if (verifiedIds.has(item._uniqueId)) {
                 if(source === 'scan') {
                     setFeedback({ message: `Item ${item._idVenda} já verificado!`, type: 'warn' });
                     playSound('error');
                 }
            } else {
                setVerifiedIds(prev => new Set(prev).add(item._uniqueId));
                setFeedback({ message: `Pedido ${item._idVenda} verificado!`, type: 'success' });
                playSound('success');
            }
        } else if (source === 'scan') {
            setFeedback({ message: `Item não encontrado`, type: 'error' });
            playSound('error');
        }
        if (source === 'scan') setScanInput('');
    };

    const handleScan = () => {
        const val = scanInput.trim();
        if (!val) return;
        const match = items.find(i => i._idVenda === val || i._rastreio === val);
        handleVerify(match!, 'scan');
    };

    const { pending, verified, stats } = React.useMemo(() => {
        let filtered = items;
        if (filterOptions.showTransparentPersonalized) {
            if (filterType === 'transparent') filtered = filtered.filter(i => !i.isPersonalized);
            if (filterType === 'personalized') filtered = filtered.filter(i => i.isPersonalized);
        }

        const pending: UniversalPickingItem[] = [];
        const verified: UniversalPickingItem[] = [];
        const counts: Record<string, { total: number; verified: number }> = {};

        items.forEach(i => {
             const key = i.subGroupKey; 
             if (!counts[key]) counts[key] = { total: 0, verified: 0 };
             counts[key].total++;
             if (verifiedIds.has(i._uniqueId)) counts[key].verified++;
        });

        filtered.forEach(i => {
            if (verifiedIds.has(i._uniqueId)) verified.push(i);
            else pending.push(i);
        });

        const sortFn = (a: UniversalPickingItem, b: UniversalPickingItem) => {
            if (sortBy === 'title') return a.title.localeCompare(b.title, undefined, { numeric: true });
            if (sortBy === 'group') return a.groupKey.localeCompare(b.groupKey);
            if (sortBy === 'store') return a._store.localeCompare(b._store);
            return 0;
        };

        if (sortBy !== 'default') {
            pending.sort(sortFn);
        }

        return { pending, verified, stats: counts };
    }, [items, verifiedIds, filterType, sortBy]);

    const summaryData = React.useMemo(() => {
        const groups: Record<string, Record<string, number>> = {};
        // Calculate based on PENDING items for the summary tab (usually picking summary shows what is left or total?)
        // Usually Picking Summary shows what needs to be picked. Let's show TOTAL pending.
        
        // Actually, let's show TOTAL items (Pending + Verified) so users know the full load, 
        // or just pending. Usually lists show what needs to be picked. 
        // Let's use Pending items for the Summary List.
        pending.forEach(item => {
            if (!groups[item.groupKey]) groups[item.groupKey] = {};
            groups[item.groupKey][item.subGroupKey] = (groups[item.groupKey][item.subGroupKey] || 0) + 1;
        });
        
        return Object.entries(groups).map(([group, subs]) => ({
            group,
            subs: Object.entries(subs).map(([sub, count]) => ({ sub, count })).sort((a, b) => b.count - a.count)
        })).sort((a, b) => a.group.localeCompare(b.group));
    }, [pending]);

    const progress = items.length > 0 ? Math.round((verifiedIds.size / items.length) * 100) : 0;

    return (
        <div className="flex flex-col h-full">
            <div className="flex items-center border-b border-gray-200 dark:border-gray-700 mb-4">
                <button onClick={() => setActiveTab('summary')} className={`py-3 px-4 text-sm font-semibold ${activeTab === 'summary' ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-500' : 'text-gray-500 hover:text-gray-700'}`}>Resumo</button>
                <button onClick={() => setActiveTab('bipagem')} className={`py-3 px-4 text-sm font-semibold relative ${activeTab === 'bipagem' ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-500' : 'text-gray-500 hover:text-gray-700'}`}>
                    Bipagem <span className="ml-2 inline-block px-2 py-0.5 text-xs font-bold text-white bg-cyan-500 rounded-full">{pending.length}</span>
                </button>
            </div>

            {activeTab === 'summary' && (
                <div className="animate-fade-in-scale">
                    <h2 className="text-lg font-bold mb-3">Resumo para Coletar (Pendentes)</h2>
                    <div className="max-h-[70vh] overflow-y-auto pr-2 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {summaryData.map(({ group, subs }) => (
                            <div key={group} className="p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700">
                                <h3 className="font-bold text-primary-600 dark:text-primary-400 border-b dark:border-gray-700 pb-1 mb-2">{group}</h3>
                                <div className="space-y-1">
                                    {subs.map(({ sub, count }) => (
                                        <div key={sub} className="flex justify-between items-center text-sm">
                                            <span className="text-gray-800 dark:text-gray-200">{sub}</span>
                                            <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-sm font-bold rounded-full">{count}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {activeTab === 'bipagem' && (
                <div className="animate-fade-in-scale">
                     <div className="mb-4">
                        <div className="flex justify-between items-center mb-1 text-sm font-medium">
                            <span className="text-gray-700 dark:text-gray-300">Progresso Geral</span>
                            <span className="font-bold text-gray-800 dark:text-gray-200">{verifiedIds.size} / {items.length} Concluído</span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 shadow-inner">
                            <div className="bg-green-500 h-4 rounded-full transition-all duration-500 ease-out flex items-center justify-center text-white text-xs font-bold progress-bar-animated" style={{ width: `${progress}%` }}>{progress > 10 && `${progress}%`}</div>
                        </div>
                    </div>
                    
                    <div className="sticky top-[14rem] bg-white/80 dark:bg-gray-800/80 backdrop-blur-md p-4 rounded-lg border dark:border-gray-700 z-10">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                            <div className="md:col-span-1">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Bipar ID da Venda ou Rastreio</label>
                                <div className="relative">
                                    <input ref={scanInputRef} type="text" value={scanInput} onChange={e => setScanInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleScan()} placeholder="Aguardando bip..." className="block w-full h-12 pl-3 pr-3 py-2 text-lg border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 rounded-lg shadow-inner" />
                                </div>
                            </div>
                             <div className="md:col-span-1 grid grid-cols-2 gap-4 text-center">
                                <div><p className="text-xs font-bold text-gray-500 uppercase">Pendente</p><p className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">{pending.length}</p></div>
                                <div><p className="text-xs font-bold text-gray-500 uppercase">Verificado</p><p className="text-3xl font-bold text-green-600 dark:text-green-400">{verifiedIds.size}</p></div>
                            </div>
                            <div className="md:col-span-1 flex justify-end">
                                <button onClick={() => { setVerifiedIds(new Set()); setFeedback({message:'Reiniciado', type:'warn'}); scanInputRef.current?.focus(); }} className="px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700">Reiniciar Sessão</button>
                            </div>
                        </div>
                        {feedback && <div className={`mt-3 p-2 rounded-lg border text-sm font-semibold text-center animate-fade-in-scale ${feedback.type === 'success' ? 'bg-green-100 text-green-800' : feedback.type === 'warn' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>{feedback.message}</div>}
                    </div>

                     <div className="flex-grow grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                        <section>
                            <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
                                <h2 className="text-lg font-bold">Pendentes ({pending.length})</h2>
                                {filterOptions.showTransparentPersonalized && (
                                    <div className="flex items-center rounded-md bg-gray-100 dark:bg-gray-700/50 p-0.5 border dark:border-gray-600 text-xs">
                                        <button onClick={() => setFilterType('all')} className={`px-2 py-1 rounded ${filterType === 'all' ? 'bg-white dark:bg-gray-900 shadow-sm' : ''}`}>Todos</button>
                                        <button onClick={() => setFilterType('transparent')} className={`px-2 py-1 rounded ${filterType === 'transparent' ? 'bg-white dark:bg-gray-900 shadow-sm' : ''}`}>Transp.</button>
                                        <button onClick={() => setFilterType('personalized')} className={`px-2 py-1 rounded ${filterType === 'personalized' ? 'bg-white dark:bg-gray-900 shadow-sm' : ''}`}>Perso.</button>
                                    </div>
                                )}
                                <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} className="text-xs p-1 rounded border dark:bg-gray-700 dark:border-gray-600">
                                    <option value="default">Padrão</option>
                                    <option value="title">{summaryLabels.subGroup}</option>
                                    <option value="group">{summaryLabels.group}</option>
                                    <option value="store">Loja</option>
                                </select>
                            </div>
                            <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-2">
                                {pending.map(item => (
                                    <PickingItemCard 
                                        key={item._uniqueId as string} 
                                        item={item} 
                                        onVerify={() => handleVerify(item, 'manual')} 
                                        onIdClick={() => onRowClick(item)} 
                                        stats={stats[item.subGroupKey] || { verified: 0, total: 0 }}
                                    />
                                ))}
                            </div>
                        </section>
                        <section>
                            <h2 className="text-lg font-bold mb-3">Verificados ({verified.length})</h2>
                            <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-2">
                                {verified.map(item => (
                                    <PickingItemCard 
                                        key={item._uniqueId as string} 
                                        item={item} 
                                        isVerified
                                        onUnverify={() => { setVerifiedIds(prev => { const n = new Set(prev); n.delete(item._uniqueId); return n; }); setFeedback({message:'Item removido', type:'warn'}); playSound('error'); }}
                                        onIdClick={() => onRowClick(item)} 
                                        stats={stats[item.subGroupKey] || { verified: 0, total: 0 }}
                                    />
                                ))}
                            </div>
                        </section>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UniversalPicking;
