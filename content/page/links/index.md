---
title: 友链
links:
  - title: GitHub
    description: 全球最大的软件开发平台。
    website: https://github.com
    image: https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png
menu:
    main: 
        weight: 4
        params:
            icon: link

comments: false
---

在 frontmatter 中添加 `links` 字段即可使用此功能。

本页 frontmatter：

```yaml
links:
  - title: GitHub
    description: 全球最大的软件开发平台。
    website: https://github.com
    image: https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png
  - title: TypeScript
    description: JavaScript 的超集，编译为标准 JavaScript。
    website: https://www.typescriptlang.org
    image: ts-logo-128.jpg
```

`image` 字段同时支持本地和远程图片。