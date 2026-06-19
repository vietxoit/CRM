# Script tự động update IP LAN
# Chạy: .\update-ip.ps1

# Lấy IP LAN (192.168.x.x)
$lanIP = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -like "192.168.*" -and -not $_.InterfaceAlias.Contains("Docker") }).IPAddress | Select-Object -First 1

if (-not $lanIP) {
    Write-Host "❌ Không tìm thấy IP LAN 192.168.x.x" -ForegroundColor Red
    exit 1
}

Write-Host "✅ IP LAN mới: $lanIP" -ForegroundColor Green

# Cập nhật .env.local
$envPath = "$PSScriptRoot\.env.local"
$envContent = Get-Content $envPath -Raw
$envContent = $envContent -replace 'NEXT_PUBLIC_APP_URL=http://[^:]+:3000', "NEXT_PUBLIC_APP_URL=http://$lanIP`:3000"
Set-Content $envPath $envContent -Encoding UTF8

Write-Host "✅ Cập nhật .env.local: NEXT_PUBLIC_APP_URL=http://$lanIP:3000" -ForegroundColor Green

# Hướng dẫn cập nhật Supabase
Write-Host ""
Write-Host "📋 Lưu ý: Cần cập nhật Supabase Dashboard" -ForegroundColor Yellow
Write-Host "1. Vào https://app.supabase.com" -ForegroundColor Cyan
Write-Host "2. Settings > Authentication > Redirect URLs" -ForegroundColor Cyan
Write-Host "3. Xóa URL cũ, thêm: http://$lanIP`:3000" -ForegroundColor Cyan
Write-Host "4. Lưu & Restart dev server" -ForegroundColor Cyan
Write-Host ""
Write-Host "✨ Sẵn sàng UAT tại: http://$lanIP`:3000" -ForegroundColor Green
