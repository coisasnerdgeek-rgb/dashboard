import fs from 'fs';
import path from 'path';

const filePath = 'c:\\Users\\micri\\Downloads\\copy-of-copy-of-copy-of-dashboard-de-pedidos-45\\components\\CriarPedido.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add removeMontagemExclusion in the first matching block (Restaurar)
content = content.replace(
    /onSetDeletedOrderIds\(prev => \{\s+const next = new Set\(prev\);\s+next\.delete\(id\);\s+return next;\s+\}\);/g,
    `onSetDeletedOrderIds(prev => {
                                                                                                        const next = new Set(prev);
                                                                                                        next.delete(id);
                                                                                                        removeMontagemExclusion(String(id));
                                                                                                        return next;
                                                                                                    });`
);

// 2. Fix the second block (Exclusão Permanente) - it used setDeletedOrderIds incorrectly
content = content.replace(
    /setDeletedOrderIds\(prev => \{\s+const next = new Set\(prev\);\s+next\.delete\(id\);\s+return next;\s+\}\);/g,
    `onSetDeletedOrderIds(prev => {
                                                                                                            const next = new Set(prev);
                                                                                                            next.delete(id);
                                                                                                            removeMontagemExclusion(String(id));
                                                                                                            return next;
                                                                                                        });`
);

fs.writeFileSync(filePath, content);
console.log('✅ CriarPedido.tsx fixed successfully!');
