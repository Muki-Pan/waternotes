# Water Notes

一个轻量的展览收集册 / 视觉札记工具，用来整理图像、展览、笔记、链接与那些不想被信息流冲走的小小观察。

你可以把它用作：

* 展览收集册
* 视觉札记
* 个人图像档案
* 看展记录
* 灵感板
* 田野笔记系统
* 阅读 / 观看记录
* 轻量的图片型内容管理工具

这个项目适合那些想要拥有一个独立记录空间的人，而不是把所有观看经验都交给社交平台。

我的项目地址，供参考用法：

```text
https://waternotes.mukipan.com
```

---


## 功能

* 创建和管理展览 / 视觉笔记条目
* 添加标题、中英文标题、日期、地点、展馆、展期和简介
* 为每个条目保存 notes 和 related links
* 通过 Supabase Database 保存展览条目数据
* 通过 Supabase Storage 上传和展示图片
* 为条目设置封面图
* 支持公开读取已发布条目
* 支持登录后的 owner 编辑、上传、删除和更新
* 在没有 Supabase 登录时保留少量本地编辑能力，用于临时记录
* 以干净、以图像为中心的界面展示内容
* 可以部署到 Cloudflare Pages / Workers

---

## 技术栈

这个项目目前使用：

* **Astro**：前端框架与静态页面生成
* **Supabase**：数据库、图片存储和登录会话
* **@supabase/supabase-js**：浏览器端连接 Supabase
* **@astrojs/cloudflare**：Cloudflare 部署适配器
* **Wrangler**：Cloudflare 本地预览与部署工具
* **CSS**：项目内自定义样式，

页面主要由 Astro 页面、原生 JavaScript 和 `src/styles/global.css` 组成。

---

## 项目结构

```text
.
├── astro.config.mjs
├── package.json
├── supabase-schema.sql
├── public/
│   └── favicon.png
└── src/
    ├── data/
    │   └── records.js
    ├── pages/
    │   ├── index.astro
    │   ├── record.astro
    │   └── records/[id].astro
    ├── scripts/
    │   ├── index-page.js
    │   ├── record-page.js
    │   └── supabase-client.js
    └── styles/
        └── global.css
```

几个重要文件：

* `src/pages/index.astro`：首页，展示所有公开条目
* `src/pages/record.astro`：动态记录页，通过 `?id=` 读取 Supabase 中的条目
* `src/pages/records/[id].astro`：基于本地 `records.js` 生成的静态记录页
* `src/scripts/index-page.js`：首页数据同步、创建条目和登录辅助函数
* `src/scripts/record-page.js`：记录页读取、编辑、上传图片、设置封面等逻辑
* `src/scripts/supabase-client.js`：读取页面中的 Supabase 配置并创建客户端
* `supabase-schema.sql`：数据库表、Storage bucket 和 RLS policy

---

## 快速开始

### 1. 克隆仓库

```bash
git clone https://github.com/Muki-Pan/waternotes.git
cd waternotes
```

### 2. 安装依赖

```bash
npm install
```

### 3. 创建环境变量

在项目根目录创建 `.env` 文件：

```bash
PUBLIC_SUPABASE_URL=your_supabase_project_url
PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
PUBLIC_SUPABASE_BUCKET=field-notes
```

这些变量会在 Astro build 时写入前端页面。

注意：`PUBLIC_SUPABASE_PUBLISHABLE_KEY` 是浏览器端公开 key，不要把 Supabase 的 `service_role` key 放进这个项目的前端环境变量里，也不要提交到 GitHub。

### 4. 本地运行

```bash
npm run dev
```

然后打开：

```text
http://localhost:4321
```

### 5. 本地构建

```bash
npm run build
```

构建产物会输出到：

```text
dist/
```

---

## Supabase 设置

这个项目的数据库结构已经写在 `supabase-schema.sql` 中。你可以在 Supabase 的 SQL Editor 里运行这个文件。

它会创建：

* `public.exhibition_records`
* `public.exhibition_images`
* `field-notes` Storage bucket
* 公开读取已发布内容的 RLS policy
* 登录用户维护内容和图片的 RLS policy

### `exhibition_records`

用于保存每一条展览 / 视觉札记。

| 字段名 | 类型 | 说明 |
| --- | --- | --- |
| `id` | text | 主键，例如 `fn-001` |
| `title` | text | 条目标题 |
| `title_zh` | text | 中文标题 |
| `institution` | text | 展馆 / 机构 |
| `city` | text | 城市 |
| `visit_date` | date | 观看 / 记录日期 |
| `exhibition_dates` | text | 展期 |
| `summary` | text | 简介 |
| `notes` | jsonb | 笔记段落 |
| `related_links` | jsonb | 相关链接 |
| `cover_src` | text | 封面图片 URL |
| `published` | boolean | 是否公开显示 |
| `created_at` | timestamptz | 创建时间 |
| `updated_at` | timestamptz | 更新时间 |

首页只读取：

```sql
published = true
```

所以如果某条数据没有显示，先检查它的 `published` 是否为 `true`。

### `exhibition_images`

用于保存每个条目的图片信息。

| 字段名 | 类型 | 说明 |
| --- | --- | --- |
| `id` | uuid | 主键 |
| `record_id` | text | 对应的 `exhibition_records.id` |
| `storage_path` | text | Supabase Storage 中的图片路径 |
| `src` | text | 图片公开 URL |
| `sort_order` | integer | 排序 |
| `created_at` | timestamptz | 创建时间 |

### Storage bucket

默认 bucket 名称是：

```text
field-notes
```

如果你想换成其他名称，需要同步修改：

* Supabase Storage bucket
* `.env` 中的 `PUBLIC_SUPABASE_BUCKET`
* `supabase-schema.sql` 中的 bucket policy

---

## 登录与编辑

公开访客可以查看 `published = true` 的记录和图片。

Owner 登录后可以：

* 创建新记录
* 修改标题、地点、展期和简介
* 编辑 notes
* 编辑 related links
* 上传图片
* 删除图片
* 设置封面图

当前项目没有做可视化登录表单，owner 登录通过浏览器 Console 调用辅助函数完成。

在页面打开 DevTools Console 后运行：

```js
await fieldNotesSignIn("your-email@example.com", "your-password")
```

登出：

```js
await fieldNotesSignOut()
```

登录成功后，首页会显示 `Create Note` 按钮，记录页会显示编辑和上传工具。
注意：你需要先在 Supabase Auth 里创建自己的用户账号，才能用邮箱和密码登录。

---

## 部署到 Cloudflare

这个项目已经配置了 Cloudflare adapter。

Cloudflare Pages / Workers 里推荐配置：

| 项目 | 值 |
| --- | --- |
| Git repository | `yourname/waternotes` |
| Production branch | `main` |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| Version command | `npx wrangler versions upload` |
| Root directory | `/` |

部署前，在 Cloudflare 的 build variables 中添加：

```bash
PUBLIC_SUPABASE_URL=
PUBLIC_SUPABASE_PUBLISHABLE_KEY=
PUBLIC_SUPABASE_BUCKET=field-notes
```

这些变量必须是 build-time variables。因为 Astro 会在构建时读取 `import.meta.env.PUBLIC_*`，然后写入页面中的 `supabase-config`。

部署后可以在页面源码里搜索：

```text
supabase-config
```

如果看到：

```json
{"url":"","publishableKey":"","bucket":"field-notes"}
```

说明 Cloudflare build 没有读取到环境变量。请检查变量是否加在 Production build 环境，并重新部署。

---

## 自定义域名


在 Cloudflare 中可以通过：

```text
Workers & Pages -> water-notes -> Custom domains
```

添加：

```text
yourdomain.com
```

---

## 关于图片与版权

如果你上传的图片来自展览、书籍、网站、艺术家作品或其他公开资料，请注意版权和使用范围。

如果你的项目是公开访问的，建议你：

* 尽量使用自己拍摄的图片
* 标注艺术家、摄影师、美术馆、画廊和资料来源
* 不要未经允许上传高清版权图片
* 尽量以学习、评论、记录、研究为目的使用图像
* 如果权利方要求删除，请及时处理

这个项目鼓励个人记录和知识整理，但不鼓励不负责任地搬运他人作品。


---

## License

本项目使用 MIT License。

你可以 fork、修改，并基于它搭建自己的版本。具体许可内容见 `LICENSE` 文件。

---

## Credits

Created by Muki Pan. 
mukipan.com
