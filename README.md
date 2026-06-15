# 互动影游 (hudongyinyou)

AI 驱动分支叙事互动影游平台。基于 [Branchie](https://github.com/oldrev/branchie) XML 格式，在浏览器中播放多分支视频剧情。

在线试玩：[www.wzy-gameplayer.xin/game/](http://www.wzy-gameplayer.xin/game/)

## 项目结构

```
├── index.html              # 作品库 + 播放器
├── player.js               # Branchie Web 播放器（含可拖动进度条）
├── style.css
├── data/series.json        # 作品目录
├── branchie-video.xml      # 邪气凛然 EP01 分支配置
├── EP01-CH01-branchie-video.xml
├── EP01-CH01-videos/       # 视频素材
└── deploy/                 # nginx 部署配置
```

## 视频存储（阿里云 OSS）

视频素材存放在 [阿里云 OSS `hudongyingyou`](https://oss.console.aliyun.com/bucket/oss-cn-hangzhou/hudongyingyou/object) 桶，代码仓库不含视频文件。

配置：`data/oss.json`

```json
{
  "videoBaseUrl": "https://hudongyingyou.oss-cn-hangzhou.aliyuncs.com/"
}
```

### 上传视频到 OSS

```bash
pip install oss2
python scripts/upload_videos_to_oss.py
```

OSS 路径与本地一致，例如：

`EP01-CH01-videos/EP01-CH01-01-陈阳休息室/EP01-CH01-01-陈阳休息室.mp4`

**注意**：Bucket 需开启公共读（或配置 CDN），否则浏览器无法播放。

## 本地运行

```bash
python -m http.server 8765
# 打开 http://localhost:8765/
```

## 部署到服务器

见 [deploy/README.md](deploy/README.md)

## 作品

| 作品 | 状态 | 配置 |
|------|------|------|
| 邪气凛然 · 第一集：混在夜总会 | 试玩上线 | `branchie-video.xml` |
