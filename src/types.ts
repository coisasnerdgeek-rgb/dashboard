export type View = 'dashboard' | 'upload' | 'data' | 'pedidos' | 'montar-pedido' | 'enviar-pedido' | 'atrasados' | 'estampas' | 'pagamento' | 'verificacao' | 'separacao' | 'preparando-envio' | 'precos' | 'sku' | 'capinhas' | 'imagem';

export type TableRow = {
  // Update index signature to be compatible with all properties, especially _updatedFields and _editHistory.
  [key: string]: string | number | boolean | Record<string, boolean> | TableRow[] | undefined | null;
  cnpj?: 'MM' | 'MVF';
  _updatedFields?: Record<string, boolean>;
  _editHistory?: TableRow[];
  _createdItems?: TableRow[];
  _uniqueId?: string | number;
  _isAvulso?: boolean;
  _isEdited?: boolean;
};

export type ProcessedTableRow = TableRow & {
  _idVenda: string;
  _ecommerceStore: string;
  _skuDescription: string;
  _categoryDisplay: string;
  _effectiveQuantity: number;
  _valorTotal: number;
  _isCancelled: boolean;
  _isKit: boolean;
  _productName: string;
  _colorName: string;
  _sizeName: string;
};


export type PriceData = Record<string, Record<string, number | null>>;

export interface PriceProduct {
  id: string;
  category: string;
  product: string;
  skuProductName: string | null;
  prices: PriceData;
}

export interface BackorderedItem {
  id: string;
  backorderDate: string;
  originalRow: TableRow;
  editedData?: {
    sku: string;
    quantity: number;
  }[];
  resolvedDate?: string;
  store?: string;
  observation?: string;
  itemType?: 'estampa' | 'capinha';
}

export interface EstampaRow {
  id: string;
  rastreio: string;
  codVenda: string;
  link: string;
  canal: string;
  fornecedor: string;
  status: string;
  peca: string;
  localEstampa: string;
  cor: string;
  tamanho: string;
  quantidade: number;
  observacao: string;
  tratado: boolean;
  data: string;
  L: string;
  fullDate: string;
  dataPrevista?: string;
  aramadoLetra?: string;
  aramadoNumero?: string;
  cliente: string;
  nomeEstampa?: string;
  sku: string;
  googleDriveFolderId?: string;
  googleDriveImages?: string; // JSON string of DriveImage[]
  linkPedido?: string; // URL personalizada do pedido
  arteProntaId?: string; // ID da pasta ou pedido para buscar imagens diretamente
  aramadoRetirado?: boolean;
  aramadoDataColocacao?: string;
  aramadoDataRetirada?: string;
  updatedAt?: string;
}

export interface OrderTotals {
  totalBranco: number;
  totalColorido: number;
  totalGeral: number;
  totalEspeciais?: number;
}

export interface SavedOrder {
  id: string;
  product: string;
  store: string;
  cnpj: 'MM' | 'MVF' | 'Ambos';
  quantities: Record<string, Record<string, number>>;
  colors: string[];
  sizes: string[];
  totals: OrderTotals;
  hasMissingItems?: boolean;
  editedCells?: Record<string, Record<string, 'edited' | 'deleted'>>;
  _sourceRowIds?: (string | number)[];
  _originalStore?: string; // Original store when FALTANTE in different store
}

export interface ArchivedSavedOrder extends SavedOrder {
  archivedDate: string;
}

export interface PaymentItem {
  id: string;
  product: string;
  store: string;
  cnpj: 'MM' | 'MVF' | 'Ambos';
  sentDate: string; // Data em que o pedido foi criado/enviado para pagamento
  totalValue: number;
  observation: string;
  totalItems: number;
  // Campos novos/atualizados para rastreamento de pagamento
  status: 'pending' | 'partially_paid' | 'paid';
  amountPaid: number;
  paymentHistory: {
    date: string;
    amount: number;
    proofUrl?: string; // Link para o comprovante (Drive ou externo)
  }[];
}

export interface Contact {
  id: string;
  store: string;
  name?: string;
  whatsapp?: string;
  email?: string;
}

export interface VerificationItemStatus {
  expected: number;
  received: number | null; // null significa não verificado
}

export interface VerificationStatus {
  notes: string;
  items: Record<string, Record<string, VerificationItemStatus>>; // { [color]: { [size]: status } }
  status: 'pending' | 'in-progress' | 'discrepancy' | 'verified';
  lastChecked?: string;
}

export interface PhoneCaseModel {
  name: string;
  inStock: boolean;
}

export interface ImageCategory {
  id: string;
  name: string;
  parentId?: string | null; // null or undefined = root category
}

export interface Store {
  id?: string;
  name: string;
  types: string[];
}

export interface DelayRules {
  [storeName: string]: {
    onTime: number;
    atRisk: number;
  };
}

export interface SyncProgress {
  isVisible: boolean;
  status: 'searching' | 'processing' | 'completed' | 'error';
  message: string;
  percentage: number;
  totalProcessed: number;
  totalPending: number;
  totalFailed: number;
  isMinimized?: boolean;
}

export interface DriveImage {
  id: string;
  name: string;
  thumbnailLink: string;
  webViewLink: string;
  webContentLink?: string;
  mimeType?: string;
}

export interface Lote {
  id: string;
  numeroLote: string; // Número do lote (ex: "11A", "001", "BATCH-123", etc.)
  imagemUrl: string; // Primary image URL (for backward compatibility)
  imagens?: string[]; // Array of all image URLs for this lote
  dataCriacao: string; // ISO date
  thumbnail?: string; // Optional thumbnail URL
}

export interface MarketplaceFee {
  id?: string;
  marketplace: string; // Code: SH, ML, AM, etc.
  name: string;
  commission_percent: number;
  fixed_fee: number;
  tax_rate: number;
  is_active: boolean;
  rules_json?: Record<string, any>; // Flexible for advanced rules
}

export interface MetricRow extends TableRow {
  channel: string;
  id: string;
  product: string;
  sku: string;
  valor: number;
  total: number;
  lucro: number;
  lucroPercent: number;
  taxas: number;
  imposto: number;
  custo: number;
  roi: number;
  quantidade: number;
  details?: string[];
}