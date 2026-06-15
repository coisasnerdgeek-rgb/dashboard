import * as React from 'react';

interface DateRange {
    start: string | null;
    end: string | null;
}

interface AppContextType {
    selectedCnpj: 'MM' | 'MVF' | 'Todos';
    setSelectedCnpj: (cnpj: 'MM' | 'MVF' | 'Todos') => void;
    dateRange: DateRange;
    setDateRange: (range: DateRange) => void;
    globalSearchTerm: string;
    setGlobalSearchTerm: (term: string) => void;
    clearFilters: () => void;
    clearFiltersTimestamp: number;
    ruleVersion: number;
    refreshRules: () => void;
}

const AppContext = React.createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // 1. CNPJ state
    const [selectedCnpj, setSelectedCnpj] = React.useState<'MM' | 'MVF' | 'Todos'>(() => {
        const saved = localStorage.getItem('selectedCnpj');
        return (saved as 'MM' | 'MVF' | 'Todos') || 'Todos';
    });

    // 2. Date Range state
    const [dateRange, setDateRange] = React.useState<DateRange>(() => {
        try {
            const saved = localStorage.getItem('dateRange');
            return saved ? JSON.parse(saved) : { start: null, end: null };
        } catch (e) {
            return { start: null, end: null };
        }
    });

    // 3. Global Search Term
    const [globalSearchTerm, setGlobalSearchTerm] = React.useState('');

    // 4. Clear Filters Timestamp
    const [clearFiltersTimestamp, setClearFiltersTimestamp] = React.useState(0);

    // 5. SKU Rule Version (Global synchronization)
    const [ruleVersion, setRuleVersion] = React.useState(0);

    // Persistence Effects
    React.useEffect(() => {
        localStorage.setItem('selectedCnpj', selectedCnpj);
    }, [selectedCnpj]);

    React.useEffect(() => {
        localStorage.setItem('dateRange', JSON.stringify(dateRange));
    }, [dateRange]);

    const clearFilters = React.useCallback(() => {
        setSelectedCnpj('Todos');
        setDateRange({ start: null, end: null });
        setGlobalSearchTerm('');
        setClearFiltersTimestamp(Date.now());
    }, []);

    const refreshRules = React.useCallback(() => {
        setRuleVersion(v => v + 1);
    }, []);

    const value = React.useMemo(() => ({
        selectedCnpj,
        setSelectedCnpj,
        dateRange,
        setDateRange,
        globalSearchTerm,
        setGlobalSearchTerm,
        clearFilters,
        clearFiltersTimestamp,
        ruleVersion,
        refreshRules
    }), [selectedCnpj, dateRange, globalSearchTerm, clearFilters, clearFiltersTimestamp, ruleVersion, refreshRules]);

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppContext = () => {
    const context = React.useContext(AppContext);
    if (context === undefined) {
        throw new Error('useAppContext must be used within an AppProvider');
    }
    return context;
};
