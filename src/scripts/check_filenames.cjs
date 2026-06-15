const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '../.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim();
});

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

async function checkFilenames() {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    console.log('🔍 ANÁLISE DE FILENAMES\n');
    console.log('='.repeat(60));

    const { data } = await supabase
        .from('spreadsheet_data')
        .select('filename, id');

    const byFilename = {};
    data?.forEach(item => {
        const fname = item.filename || 'Unknown';
        byFilename[fname] = (byFilename[fname] || 0) + 1;
    });

    console.log('\n📁 PEDIDOS POR FILENAME:');
    Object.entries(byFilename)
        .sort(([, a], [, b]) => b - a)
        .forEach(([filename, count]) => {
            console.log(`   ${filename}: ${count} itens`);
        });

    console.log('\n' + '='.repeat(60));
    console.log(`\n💡 TOTAL DE FILENAMES: ${Object.keys(byFilename).length}`);
    console.log(`   TOTAL DE ITENS: ${data?.length || 0}`);

    if (Object.keys(byFilename).length > 1) {
        console.log('\n⚠️  ATENÇÃO:');
        console.log('   O app agrupa por filename. Se você vê apenas 10% dos pedidos,');
        console.log('   pode estar visualizando apenas 1 filename de vários!');
        console.log('   \n   No App, verifique se você está vendo TODOS os arquivos,');
        console.log('   não apenas "Tiny ERP Auto-Import"');
    }
}

checkFilenames().catch(console.error);
