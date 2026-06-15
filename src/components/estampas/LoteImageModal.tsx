import React, { useState } from 'react';
import ReactDOM from 'react-dom';

interface LoteImageModalProps {
    loteNumero: string;
    imagemUrl: string;
    imagens?: string[]; // Array of all images
    dataCriacao: string;
    onClose: () => void;
}

export const LoteImageModal: React.FC<LoteImageModalProps> = ({
    loteNumero,
    imagemUrl,
    imagens,
    dataCriacao,
    onClose
}) => {
    const [zoom, setZoom] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [currentImageIndex, setCurrentImageIndex] = useState(0);

    // Determine which images to show
    const imagesToShow = imagens && imagens.length > 0 ? imagens : [imagemUrl];
    const currentImage = imagesToShow[currentImageIndex];
    const totalImages = imagesToShow.length;

    // Debug logging
    console.log('[LoteImageModal] Props:', { loteNumero, imagens, imagemUrl, totalImages });

    const nextImage = () => {
        setCurrentImageIndex((prev) => (prev + 1) % totalImages);
        resetZoom();
    };

    const prevImage = () => {
        setCurrentImageIndex((prev) => (prev - 1 + totalImages) % totalImages);
        resetZoom();
    };

    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        setZoom(prev => Math.max(0.5, Math.min(3, prev + delta)));
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (zoom > 1) {
            setIsDragging(true);
            setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isDragging && zoom > 1) {
            setPosition({
                x: e.clientX - dragStart.x,
                y: e.clientY - dragStart.y
            });
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    const resetZoom = () => {
        setZoom(1);
        setPosition({ x: 0, y: 0 });
    };

    const formatDate = (isoDate: string) => {
        const date = new Date(isoDate);
        return date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    };

    return ReactDOM.createPortal(
        <div
            className="fixed inset-0 z-[100002] flex items-center justify-center bg-black/90 backdrop-blur-sm p-2"
            onClick={onClose}
        >
            <div
                className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl overflow-hidden flex flex-col"
                style={{ maxWidth: '95vw', maxHeight: '95vh', width: 'fit-content', height: 'fit-content' }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/70 to-transparent p-4 flex justify-between items-center">
                    <div className="text-white">
                        <h3 className="text-xl font-bold">Lote {loteNumero}</h3>
                        <p className="text-sm opacity-80">{formatDate(dataCriacao)}</p>
                        {totalImages > 1 && (
                            <p className="text-xs mt-1 bg-white/20 px-2 py-1 rounded inline-block">
                                Imagem {currentImageIndex + 1} de {totalImages}
                            </p>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="text-white hover:text-gray-300 transition-colors p-2 hover:bg-white/10 rounded-full"
                    >
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content Container */}
                <div
                    className="relative flex items-center justify-center overflow-hidden bg-gray-900"
                    style={{ minWidth: '800px', minHeight: '700px', maxWidth: '95vw', maxHeight: '95vh' }}
                    onWheel={handleWheel}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                >
                    {(currentImage.toLowerCase().includes('.pdf') || currentImage.includes('application/pdf') || currentImage.includes('drive.google.com')) ? (
                        <div className="w-full h-full flex flex-col items-center justify-center p-4">
                            {currentImage.includes('drive.google.com') ? (
                                <iframe
                                    src={currentImage.replace('/view', '/preview').replace('/edit', '/preview')}
                                    className="w-[90vw] h-[80vh] rounded-lg shadow-inner border-0"
                                    title={`Preview Lote ${loteNumero}`}
                                    allow="autoplay"
                                />
                            ) : currentImage.includes('.pdf') ? (
                                <embed
                                    src={currentImage}
                                    type="application/pdf"
                                    className="w-[90vw] h-[80vh] rounded-lg shadow-inner"
                                />
                            ) : (
                                <img
                                    src={currentImage}
                                    alt={`Lote ${loteNumero}`}
                                    className="max-w-full max-h-full object-contain transition-transform duration-200"
                                    style={{
                                        transform: `scale(${zoom}) translate(${position.x / zoom}px, ${position.y / zoom}px)`,
                                        cursor: zoom > 1 ? 'move' : 'default'
                                    }}
                                    draggable={false}
                                />
                            )}
                        </div>
                    ) : (
                        <img
                            src={currentImage}
                            alt={`Lote ${loteNumero}`}
                            className="max-w-full max-h-full object-contain transition-transform duration-200"
                            style={{
                                transform: `scale(${zoom}) translate(${position.x / zoom}px, ${position.y / zoom}px)`,
                                cursor: zoom > 1 ? 'move' : 'default'
                            }}
                            draggable={false}
                        />
                    )}
                </div>

                {/* Thumbnail Gallery */}
                {totalImages > 1 && (
                    <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 max-w-[90vw] px-4">
                        <div className="bg-black/70 backdrop-blur-md rounded-lg p-3 flex gap-2 overflow-x-auto max-w-full">
                            {imagesToShow.map((img, index) => (
                                <button
                                    key={index}
                                    onClick={() => {
                                        setCurrentImageIndex(index);
                                        resetZoom();
                                    }}
                                    className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${index === currentImageIndex
                                        ? 'border-white scale-110 shadow-lg'
                                        : 'border-transparent opacity-60 hover:opacity-100 hover:scale-105'
                                        }`}
                                >
                                    <img
                                        src={getLoteThumbnailUrl(img)}
                                        alt={`Thumbnail ${index + 1}`}
                                        className="w-full h-full object-cover"
                                        onLoad={() => console.log(`[LoteImageModal] Thumb ${index} loaded:`, getLoteThumbnailUrl(img))}
                                        onError={(e) => {
                                            console.error(`[LoteImageModal] Thumb ${index} failed:`, getLoteThumbnailUrl(img));
                                            (e.target as HTMLImageElement).src = img;
                                        }}
                                    />
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Zoom Controls - Hide for PDFs/Drive as they have native controls */}
                {!(currentImage.toLowerCase().includes('.pdf') || currentImage.includes('application/pdf') || currentImage.includes('drive.google.com')) && (
                    <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/70 text-white px-4 py-2 rounded-full flex items-center gap-3">
                        <button
                            onClick={() => setZoom(prev => Math.max(0.5, prev - 0.2))}
                            className="hover:bg-white/10 p-2 rounded transition-colors"
                            title="Zoom Out"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
                            </svg>
                        </button>
                        <span className="text-sm font-medium min-w-[60px] text-center">{Math.round(zoom * 100)}%</span>
                        <button
                            onClick={() => setZoom(prev => Math.min(3, prev + 0.2))}
                            className="hover:bg-white/10 p-2 rounded transition-colors"
                            title="Zoom In"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
                            </svg>
                        </button>
                        <button
                            onClick={resetZoom}
                            className="hover:bg-white/10 px-3 py-2 rounded transition-colors text-sm"
                            title="Reset Zoom"
                        >
                            Reset
                        </button>
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
};

/**
 * Auxiliar para obter URL de thumbnail otimizada do Google Drive
 */
function getLoteThumbnailUrl(url: string) {
    if (!url) return '';
    if (url.includes('drive.google.com')) {
        // Tenta extrair ID do formato /d/ID/... ou ?id=ID
        const match = url.match(/\/d\/([^\/\?#]+)/) || url.match(/[?&]id=([^&?#]+)/);
        if (match && match[1]) {
            // sz=w400 garante boa qualidade e evita problemas de carregamento de preview em <img>
            return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w400`;
        }
    }
    return url;
}
