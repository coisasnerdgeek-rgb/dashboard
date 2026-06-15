import { createClient } from '@supabase/supabase-js';

// 🔧 SUBSTITUA COM AS CHAVES DO SEU .env.local:
const SUPABASE_URL = 'https://nbxubdmsepnhhhsbpzoq.supabase.co'; // Cole aqui o VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = 'sb_publishable_AP8EfeGYT3ZWvHktRkIB7A_RlkemHAT'; // Cole aqui o VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('❌ ERRO: Atualize as chaves do Supabase no topo deste arquivo!');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkBucket() {
    console.log('🔍 Verificando configuração do bucket lote-images...\n');

    try {
        // 1. List all buckets
        console.log('1️⃣ Listando todos os buckets...');
        const { data: buckets, error: listError } = await supabase.storage.listBuckets();

        if (listError) {
            console.error('❌ Erro ao listar buckets:', listError);
            return;
        }

        console.log(`✅ Encontrados ${buckets?.length || 0} bucket(s):`);
        buckets?.forEach(bucket => {
            console.log(`   - ${bucket.name} (${bucket.public ? 'público' : 'privado'})`);
        });

        // 2. Check if lote-images exists
        console.log('\n2️⃣ Verificando bucket "lote-images"...');
        const loteImagesBucket = buckets?.find(b => b.name === 'lote-images');

        if (!loteImagesBucket) {
            console.error('❌ PROBLEMA: Bucket "lote-images" NÃO EXISTE!');
            console.log('\n📋 PRÓXIMOS PASSOS:');
            console.log('   1. Acesse: https://supabase.com/dashboard');
            console.log('   2. Selecione o projeto: nbxubdmsennhhsbpzog');
            console.log('   3. Vá para Storage → New bucket');
            console.log('   4. Nome: lote-images');
            console.log('   5. Marque como PÚBLICO');
            console.log('   6. Clique em Create');
            console.log('\n   Depois execute as políticas RLS (veja configuracao_bucket.md)');
            return;
        }

        console.log('✅ Bucket "lote-images" encontrado!');
        console.log(`   - Público: ${loteImagesBucket.public ? 'SIM ✅' : 'NÃO ❌'}`);

        if (!loteImagesBucket.public) {
            console.warn('⚠️ AVISO: Bucket não está marcado como público!');
            console.log('   Isso pode causar problemas ao carregar imagens.');
        }

        // 3. Try to list files
        console.log('\n3️⃣ Testando acesso ao bucket...');
        const { data: files, error: filesError } = await supabase
            .storage
            .from('lote-images')
            .list();

        if (filesError) {
            console.error('❌ Erro ao acessar bucket:', filesError);
            console.log('   Isso pode indicar problemas com políticas RLS.');
            return;
        }

        console.log(`✅ Acesso OK! Arquivos no bucket: ${files?.length || 0}`);
        if (files && files.length > 0) {
            files.slice(0, 5).forEach(file => {
                console.log(`   - ${file.name}`);
            });
            if (files.length > 5) {
                console.log(`   ... e mais ${files.length - 5} arquivo(s)`);
            }
        }

        // 4. Test upload (create a tiny test file)
        console.log('\n4️⃣ Testando upload...');
        const testFileName = `test-${Date.now()}.txt`;
        const testContent = 'test';

        const { data: uploadData, error: uploadError } = await supabase
            .storage
            .from('lote-images')
            .upload(testFileName, testContent, {
                contentType: 'text/plain'
            });

        if (uploadError) {
            console.error('❌ Erro no upload:', uploadError);
            console.log('   Verifique as políticas RLS (configuracao_bucket.md)');
            return;
        }

        console.log('✅ Upload de teste bem-sucedido!');

        // 5. Try to delete test file
        console.log('\n5️⃣ Testando deleção...');
        const { error: deleteError } = await supabase
            .storage
            .from('lote-images')
            .remove([testFileName]);

        if (deleteError) {
            console.error('⚠️ Erro ao deletar arquivo de teste:', deleteError);
        } else {
            console.log('✅ Deleção bem-sucedida!');
        }

        console.log('\n✅✅✅ TUDO OK! O bucket está configurado corretamente! ✅✅✅');

    } catch (error) {
        console.error('❌ Erro inesperado:', error);
    }
}

checkBucket();
