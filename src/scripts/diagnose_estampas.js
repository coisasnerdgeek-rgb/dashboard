// Script de diagnóstico para verificar dados de Estampas
// Execute este script no console do navegador (F12)

console.log('=== DIAGNÓSTICO DE ESTAMPAS ===');

// 1. Verificar se há dados carregados
const spreadsheetData = localStorage.getItem('spreadsheetData');
if (spreadsheetData) {
    try {
        const data = JSON.parse(spreadsheetData);
        const allRows = Object.values(data).flatMap(d => d.rows);
        console.log('✅ Total de linhas carregadas:', allRows.length);

        // Verificar se há roupas personalizadas
        const roupasPersonalizadas = allRows.filter(row => {
            const sku = String(row['Codigo (SKU)'] || row['SKU'] || '').toLowerCase();
            return sku.includes('pers') || sku.includes('cabeleireira');
        });
        console.log('✅ Roupas personalizadas encontradas:', roupasPersonalizadas.length);

        if (roupasPersonalizadas.length > 0) {
            console.log('📋 Exemplo de roupa personalizada:', {
                sku: roupasPersonalizadas[0]['Codigo (SKU)'] || roupasPersonalizadas[0]['SKU'],
                status: roupasPersonalizadas[0]['Situação'] || roupasPersonalizadas[0]['Status'],
                pedido: roupasPersonalizadas[0]['Numero da ordem de compra']
            });
        }

        // Verificar status dos pedidos
        const statusCount = {};
        allRows.forEach(row => {
            const status = String(row['Situação'] || row['Status'] || 'Sem status');
            statusCount[status] = (statusCount[status] || 0) + 1;
        });
        console.log('📊 Distribuição de status:', statusCount);

    } catch (e) {
        console.error('❌ Erro ao parsear dados:', e);
    }
} else {
    console.log('❌ Nenhum dado encontrado no localStorage');
    console.log('💡 Você precisa importar uma planilha primeiro!');
}

// 2. Verificar estampasStatus
const estampasStatusStr = localStorage.getItem('estampasStatus');
if (estampasStatusStr) {
    try {
        const estampasStatus = JSON.parse(estampasStatusStr);
        console.log('✅ Registros em estampasStatus:', Object.keys(estampasStatus).length);
    } catch (e) {
        console.error('❌ Erro ao parsear estampasStatus:', e);
    }
} else {
    console.log('⚠️ Nenhum estampasStatus encontrado no localStorage');
}

console.log('=== FIM DO DIAGNÓSTICO ===');
