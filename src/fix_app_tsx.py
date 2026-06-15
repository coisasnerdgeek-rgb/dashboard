# Script para reorganizar App.tsx - mover estampasRows antes de handleEstampaChange
import re

# Ler o arquivo
with open(r'c:\Users\micri\Downloads\copy-of-copy-of-copy-of-dashboard-de-pedidos-45\App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

lines = content.split('\n')

# Encontrar os índices
handle_estampa_idx = None
estampas_rows_start = None
estampas_rows_end = None

for i, line in enumerate(lines):
    if 'const handleEstampaChange = React.useCallback((updatedRow: EstampaRow)' in line:
        handle_estampa_idx = i
    elif 'const estampasRows: EstampaRow[] = React.useMemo(() =>' in line:
        estampas_rows_start = i
    elif estampas_rows_start and i > estampas_rows_start and 'trackingMappings]);' in line and 'allProcessedData' in line:
        estampas_rows_end = i

print(f"handleEstampaChange at line: {handle_estampa_idx}")
print(f"estampasRows starts at: {estampas_rows_start}")
print(f"estampasRows ends at: {estampas_rows_end}")

if handle_estampa_idx is not None and estampas_rows_start is not None and estampas_rows_end is not None:
    if estampas_rows_start > handle_estampa_idx:
        print("AÇÃO NECESSÁRIA: mover estampasRows para antes de handleEstampaChange")
        
        # Extrair o bloco de estampasRows
        estampas_block = lines[estampas_rows_start:estampas_rows_end+1]
        
        # Remover o bloco da posição atual
        new_lines = lines[:estampas_rows_start] + lines[estampas_rows_end+1:]
        
        # Inserir antes de handleEstampaChange (ajustar índice após remoção)
        insertion_point = handle_estampa_idx
        final_lines = new_lines[:insertion_point] + [''] + estampas_block + [''] + new_lines[insertion_point:]
        
        # Escrever de volta
        with open(r'c:\Users\micri\Downloads\copy-of-copy-of-copy-of-dashboard-de-pedidos-45\App.tsx', 'w', encoding='utf-8') as f:
            f.write('\n'.join(final_lines))
        
        print("✅ Arquivo reorganizado com sucesso!")
    else:
        print("✅ Já está na ordem correta")
else:
    print("❌ Não encontrei os blocos necessários")

