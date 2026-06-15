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
