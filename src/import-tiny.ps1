# Script para importar pedidos do Tiny em lotes de 25 dias
# Periodo: 01/12/2024 a 28/12/2024

$baseUrl = "https://dashboard-pedidos.vercel.app"

# Definir periodos de 25 dias
$periods = @(
    @{ start = "01/12/2024"; end = "25/12/2024" },
    @{ start = "26/12/2024"; end = "28/12/2024" }
)

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host " Importacao de Pedidos do Tiny ERP" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

$totalImported = 0
$totalErrors = 0
$totalSkipped = 0

foreach ($period in $periods) {
    $start = $period.start
    $end = $period.end
    
    Write-Host "Importando periodo: $start ate $end" -ForegroundColor Yellow
    Write-Host "Aguarde..." -ForegroundColor Gray
    
    try {
        $body = @{
            dataInicial = $start
            dataFinal = $end
        } | ConvertTo-Json
        
        $response = Invoke-RestMethod -Uri "$baseUrl/api/import-tiny-orders" -Method Post -Body $body -ContentType "application/json" -TimeoutSec 300
        
        Write-Host "Sucesso!" -ForegroundColor Green
        Write-Host "  Total encontrado: $($response.total)" -ForegroundColor White
        Write-Host "  Importados: $($response.imported)" -ForegroundColor Green
        Write-Host "  Ja existiam: $($response.skipped)" -ForegroundColor Yellow
        Write-Host "  Erros: $($response.errors)" -ForegroundColor Red
        Write-Host ""
        
        $totalImported += $response.imported
        $totalSkipped += $response.skipped
        $totalErrors += $response.errors
        
        # Delay entre periodos
        Start-Sleep -Seconds 5
        
    } catch {
        Write-Host "Erro ao importar periodo $start - $end" -ForegroundColor Red
        Write-Host "  Detalhes: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host ""
        $totalErrors++
    }
}

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host " RESUMO FINAL" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Total Importados: $totalImported" -ForegroundColor Green
Write-Host "Total Ignorados: $totalSkipped" -ForegroundColor Yellow
Write-Host "Total Erros: $totalErrors" -ForegroundColor Red
Write-Host ""
Write-Host "Importacao concluida!" -ForegroundColor Cyan
