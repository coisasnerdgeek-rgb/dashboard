
async function triggerSync() {
    console.log('📡 Chamando API de sincronização local (forceReprocess: true)...');
    try {
        const response = await fetch('http://localhost:5173/api/sync-tiny', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ daysBack: 3, forceReprocess: true })
        });

        if (response.status === 404) {
            console.log('⚠️ API /api/sync-tiny não encontrada no dev server local.');
            return;
        }

        const data = await response.json();
        console.log('✅ Resposta da API:', JSON.stringify(data, null, 2));
    } catch (error: any) {
        // Se o server não estiver rodando, vai dar erro de conexão
        console.error('❌ Erro:', error.message);
    }
}

triggerSync();
