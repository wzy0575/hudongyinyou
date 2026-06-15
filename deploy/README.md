# 部署说明：将互动影游发布到 www.wzy-gameplayer.xin
#
# 前提：
#   - 服务器 IP：121.43.183.220（已安装 nginx）
#   - 有 SSH 登录权限（root 或 sudo 用户）
#   - 本地项目路径见下方 $LOCAL_DIR

## 一、本地文件结构（部署后服务器目录）

```
/var/www/xieqi-game/
├── index.html              ← Web 播放器入口
├── player.js
├── style.css
├── branchie-video.xml      ← 互动配置
├── EP01-CH01-branchie-video.xml
└── EP01-CH01-videos/       ← 视频素材（约 1GB）
    ├── EP01-CH01-01-陈阳休息室/
    │   └── EP01-CH01-01-陈阳休息室.mp4
    └── ...
```

## 二、一键上传（Windows PowerShell）

```powershell
# 修改为你的服务器登录信息
$SERVER = "root@121.43.183.220"
$REMOTE = "/var/www/xieqi-game"

# 1. 在服务器创建目录
ssh $SERVER "mkdir -p $REMOTE"

# 2. 上传整个项目（首次约 1GB，需耐心等待）
scp -r "D:\AI\Claudecode\projects\xuanhuan-content\邪气凛然互动影游\*" "${SERVER}:${REMOTE}/"

# 3. 上传 nginx 配置
scp "D:\AI\Claudecode\projects\xuanhuan-content\邪气凛然互动影游\deploy\nginx-wzy-gameplayer.conf" "${SERVER}:/etc/nginx/sites-available/wzy-gameplayer.conf"

# 4. 在服务器启用配置
ssh $SERVER @"
ln -sf /etc/nginx/sites-available/wzy-gameplayer.conf /etc/nginx/sites-enabled/wzy-gameplayer.conf
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
"@
```

## 三、访问地址

| 地址 | 说明 |
|------|------|
| http://www.wzy-gameplayer.xin/ | 选集菜单 |
| http://www.wzy-gameplayer.xin/?play=branchie-video.xml | 直接开始第一集 |
| http://www.wzy-gameplayer.xin/?play=EP01-CH01-branchie-video.xml | 章节版配置 |

## 四、后续更新（只改了视频或 XML）

```powershell
# 只同步变更文件
scp -r "D:\AI\Claudecode\projects\xuanhuan-content\邪气凛然互动影游\EP01-CH01-videos" "${SERVER}:/var/www/xieqi-game/"
scp "D:\AI\Claudecode\projects\xuanhuan-content\邪气凛然互动影游\branchie-video.xml" "${SERVER}:/var/www/xieqi-game/"
```

## 五、HTTPS（推荐）

```bash
# 在服务器上执行
apt install certbot python3-certbot-nginx -y
certbot --nginx -d wzy-gameplayer.xin -d www.wzy-gameplayer.xin
```

## 六、常见问题

**Q: 打开域名还是 nginx 默认页？**
A: 检查是否执行了步骤 4，并确认 `sites-enabled/default` 已删除。

**Q: 视频无法播放？**
A: 确认视频文件已上传，路径与 XML 中 `video="./EP01-CH01-videos/..."` 一致。

**Q: 中文路径乱码？**
A: 确保 nginx 配置中有 `charset utf-8;`（可在 server 块添加）。

**Q: 手机浏览器不能自动播放？**
A: 首次需用户点击屏幕，播放器已处理此情况。
