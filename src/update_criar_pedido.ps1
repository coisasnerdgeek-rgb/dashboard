$content = Get-Content "c:\Users\micri\Downloads\copy-of-copy-of-copy-of-dashboard-de-pedidos-45\components\CriarPedido.tsx" -Raw
# Replace image lookup block
$oldImageBlock = @'
                                                                                <td className="py-1 px-2">
                                                                                    {imageMappings && (imageMappings[sku] || imageMappings[orderId]) ? (
                                                                                        <div className="relative group/img cursor-pointer" onClick={(e) => { e.stopPropagation(); handleImageClick(imageMappings[sku] || imageMappings[orderId], orderId); }}>
                                                                                            <img
                                                                                                src={imageMappings[sku] || imageMappings[orderId]}
                                                                                                alt="Ref"
                                                                                                className="w-8 h-8 object-cover rounded border border-gray-200 dark:border-gray-600 hover:scale-150 transition-transform z-0 hover:z-50 bg-white"
                                                                                                loading="lazy"
                                                                                            />
                                                                                        </div>
                                                                                    ) : (
                                                                                        <div className="w-8 h-8 bg-gray-100 dark:bg-gray-700 rounded flex items-center justify-center text-gray-300">
                                                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" /></svg>
                                                                                        </div>
                                                                                    )}
                                                                                </td>
'@

$newImageBlock = @'
                                                                                <td className="py-1 px-2">
                                                                                    {(() => {
                                                                                        const productImageUrl = imageMappings[sku] || imageMappings[transformSku(sku)] || imageMappings[orderId] || imageMappings[parseSku(sku)?.productName || ''];
                                                                                        if (productImageUrl) {
                                                                                            return (
                                                                                                <div className="relative group/img cursor-pointer" onClick={(e) => { e.stopPropagation(); handleImageClick(productImageUrl, orderId); }}>
                                                                                                    <img
                                                                                                        src={productImageUrl}
                                                                                                        alt="Ref"
                                                                                                        className="w-8 h-8 object-cover rounded border border-gray-200 dark:border-gray-600 hover:scale-150 transition-transform z-0 hover:z-50 bg-white"
                                                                                                        loading="lazy"
                                                                                                    />
                                                                                                </div>
                                                                                            );
                                                                                        }
                                                                                        return (
                                                                                            <div className="w-8 h-8 bg-gray-100 dark:bg-gray-700 rounded flex items-center justify-center text-gray-300">
                                                                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" /></svg>
                                                                                            </div>
                                                                                        );
                                                                                    })()}
                                                                                </td>
'@

$content = $content.Replace($oldImageBlock, $newImageBlock)

# Replace w-28 with w-20 for Canal data cell
$content = $content.Replace('<td className="py-1 px-2 w-28">', '<td className="py-1 px-2 w-20">')

$content | Set-Content "c:\Users\micri\Downloads\copy-of-copy-of-copy-of-dashboard-de-pedidos-45\components\CriarPedido.tsx"
