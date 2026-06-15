const https = require('https');

async function resyncLast3Days() {
    console.log('🔄 Reprocessando últimos 3 dias...\n');

    const hostname = 'dashboard-pedidos.vercel.app';
    const path = '/api/sync-tiny';
    const postData = JSON.stringify({
        daysBack: 3,
        forceReprocess: true
    });

    const options = {
        hostname: hostname,
        port: 443,
        path: path,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    };

    return new Promise((resolve, reject) => {
        console.log('📡 Chamando API de sincronização...');
        console.log(`   URL: https://${hostname}${path}`);
        console.log('   Parâmetros: daysBack=3, forceReprocess=true\n');

        const req = https.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    const result = JSON.parse(data);

                    console.log('📊 Resultado:');
                    console.log(JSON.stringify(result, null, 2));

                    if (result.added > 0) {
                        console.log(`\n✅ ${result.added} pedidos adicionados à fila`);
                        console.log('📌 Agora clique em "Processar Fila" para processar');
                    } else {
                        console.log('\nℹ️  Nenhum pedido novo encontrado');
                        console.log('   Isso pode significar que todos já foram importados');
                    }

                    resolve(result);
                } catch (error) {
                    console.error('❌ Erro ao parsear resposta:', error.message);
                    console.log('Resposta raw:', data);
                    reject(error);
                }
            });
        });

        req.on('error', (error) => {
            console.error('❌ Erro na requisição:', error.message);
            reject(error);
        });

        req.write(postData);
        req.end();
    });
}

resyncLast3Days().catch(console.error);
