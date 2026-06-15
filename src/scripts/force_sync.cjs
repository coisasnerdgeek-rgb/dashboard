const https = require('https');

const postData = JSON.stringify({
    daysBack: 2,
    forceReprocess: true  // KEY: This skips spreadsheet_data check!
});

const options = {
    hostname: 'dashboard-pedidos.vercel.app',
    port: 443,
    path: '/api/sync-tiny',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
    }
};

console.log('📡 Calling sync with forceReprocess=TRUE...\n');

const req = https.request(options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        const result = JSON.parse(data);
        console.log(JSON.stringify(result, null, 2));

        if (result.stats?.added > 0) {
            console.log(`\n🎉 SUCCESS! ${result.stats.added} orders added!`);
            console.log('📌 Now click "Processar Fila" in the dashboard!\n');
        } else {
            console.log(`\n❌ Still blocked: ${result.stats?.known || 0} marked as known\n`);
        }
    });
});

req.on('error', err => console.error('Error:', err.message));
req.write(postData);
req.end();
