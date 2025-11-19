# Solidity 可视化工具

一个用于可视化 Solidity 智能合约的 Web 工具。该项目旨在通过生成和显示合约的视觉表示，帮助开发者更好地理解其代码结构。

## 功能

- 解析 Solidity 代码。
- 生成抽象语法树 (AST)。
- 以交互式树状图的形式展示 AST。
- (未来功能) 可视化控制流图。
- (未来功能) 高亮显示与可视化部分对应的源代码。

## 技术栈

- React
- Vite
- Tailwind CSS

## 如何开始

### 环境准备

- Node.js 和 npm (或 yarn/pnpm)

### 安装

1.  克隆仓库：
    ```bash
    git clone <仓库地址>
    ```
2.  进入项目目录：
    ```bash
    cd solidity-visualization
    ```
3.  安装依赖：
    ```bash
    npm install
    ```

### 运行开发服务器

```bash
npm run dev
```

此命令将启动 Vite 开发服务器。您可以在浏览器中通过 `http://localhost:5173` (如果端口被占用，可能会是其他端口) 查看应用。

### 构建生产版本

```bash
npm run build
```

此命令会将应用打包到 `dist` 目录，用于生产环境部署。
