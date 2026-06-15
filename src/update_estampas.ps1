# Script para modificar Estampas.tsx

$file = "components\Estampas.tsx"
$content = Get-Content $file -Raw

# 1. POPOVER:  Mudar de "bottom-full right-0" para "right-full bottom-0" (à esquerda do ícone, alinhado ao fundo)
$content = $content -replace 'className="absolute bottom-full right-0 mb-1', 'className="absolute right-full bottom-0 mr-1'

# 2. ÍCONES DE ATRASO: Simplificar para círculos sólidos com símbolos simples
# Verde (em dia) - checkmark simples
$content = $content -replace 'bg-green-500'', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>', 'bg-green-500 rounded-full flex items-center justify-center'', icon: <span className="text-white text-xs font-black">✓</span>'

# Amarelo (em risco) - exclamação
$content = $content -replace 'bg-yellow-500'', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.21 3.03-1.742 3.03H4.42c-1.532 0-2.492-1.696-1.742-3.03l5.58-9.92zM10 13a1 1 0 110-2 1 1 0 010 2zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>', 'bg-yellow-500 rounded-full flex items-center justify-center'', icon: <span className="text-white text-xs font-black">!</span>'

# Vermelho (atrasado) - X
$content = $content -replace 'bg-red-500'', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>', 'bg-red-500 rounded-full flex items-center justify-center'', icon: <span className="text-white text-xs font-black">⚠</span>'

# Cinza (sem data) - traço
$content = $content -replace 'bg-gray-400'', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>', 'bg-gray-400 rounded-full flex items-center justify-center'', icon: <span className="text-white text-xs font-black">-</span>'

Set-Content $file $content -NoNewline
Write-Host "Estampas.tsx atualizado com sucesso!" -ForegroundColor Green
