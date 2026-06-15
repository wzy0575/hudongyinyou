# Deploy 邪气凛然互动影游 to www.wzy-gameplayer.xin
# Usage: .\deploy\deploy.ps1 [-Server root@121.43.183.220] [-SkipNginx]

param(
    [string]$Server = "root@121.43.183.220",
    [string]$RemotePath = "/var/www/xieqi-game",
    [switch]$SkipNginx,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

# Resolve local project dir (parent of deploy/)
$ProjectDir = Split-Path -Parent $PSScriptRoot

Write-Host "=== 邪气凛然互动影游 部署 ===" -ForegroundColor Cyan
Write-Host "本地目录: $ProjectDir"
Write-Host "目标服务器: $Server"
Write-Host "远程路径: $RemotePath"
Write-Host ""

if ($DryRun) {
    Write-Host "[DryRun] 将上传以下文件:" -ForegroundColor Yellow
    Get-ChildItem $ProjectDir -Recurse -File | Where-Object {
        $_.FullName -notmatch '\\deploy\\'
    } | ForEach-Object { Write-Host "  $($_.FullName.Replace($ProjectDir, ''))" }
    exit 0
}

# Check SSH connectivity
Write-Host "检查 SSH 连接..." -ForegroundColor Gray
ssh -o ConnectTimeout=10 $Server "echo ok" 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "无法连接服务器 $Server，请检查：" -ForegroundColor Red
    Write-Host "  1. SSH 密钥是否已配置（ssh $Server）"
    Write-Host "  2. 服务器 IP 和用户名是否正确"
    Write-Host "  3. 防火墙是否开放 22 端口"
    exit 1
}
Write-Host "SSH 连接正常" -ForegroundColor Green

# Create remote directory
Write-Host "创建远程目录..." -ForegroundColor Gray
ssh $Server "mkdir -p $RemotePath"

# Upload project files (exclude deploy folder)
Write-Host "上传项目文件（约 1GB，请耐心等待）..." -ForegroundColor Yellow
$items = @(
    "index.html", "player.js", "style.css",
    "branchie-video.xml", "EP01-CH01-branchie-video.xml",
    "EP01-CH01-videos"
)
foreach ($item in $items) {
    $local = Join-Path $ProjectDir $item
    if (-not (Test-Path $local)) {
        Write-Host "  跳过（不存在）: $item" -ForegroundColor DarkYellow
        continue
    }
    Write-Host "  上传: $item" -ForegroundColor Gray
    scp -r $local "${Server}:${RemotePath}/"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "上传失败: $item" -ForegroundColor Red
        exit 1
    }
}

if (-not $SkipNginx) {
    Write-Host "配置 nginx..." -ForegroundColor Gray
    $nginxConf = Join-Path $PSScriptRoot "nginx-wzy-gameplayer.conf"
    scp $nginxConf "${Server}:/etc/nginx/sites-available/wzy-gameplayer.conf"
    ssh $Server @"
ln -sf /etc/nginx/sites-available/wzy-gameplayer.conf /etc/nginx/sites-enabled/wzy-gameplayer.conf
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
echo 'nginx reloaded'
"@
    if ($LASTEXITCODE -ne 0) {
        Write-Host "nginx 配置失败，请手动检查" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "部署完成！" -ForegroundColor Green
Write-Host "访问: http://www.wzy-gameplayer.xin/" -ForegroundColor Cyan
Write-Host "直接玩: http://www.wzy-gameplayer.xin/?play=branchie-video.xml" -ForegroundColor Cyan
